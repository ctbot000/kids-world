// Adventure Isle, the public adventure island this server keeps for everyone
// to conquer together: on the list of open islands even while nobody is on
// it (as 🌟 Adventure Isle, heading the list). Players come and go as on any
// island; its toy box stays shut (nobody builds on it, and nothing is brought
// to it or sent away) and nobody flies on their own on it — it is everyone's
// adventure, on foot. Freed, the island is retired and the next stage's takes
// its place at once, a little harder (see shared/adventure.js), up to the last
// chapter of its story (shared/isle-story.js). The story has episodes, one
// after another among the stages: win the last chapter of one and its ending
// plays for everyone there (ui.js), and the next episode's first stage is up;
// win the last of them all, and a new journey starts at stage 1. Nothing else
// starts it over, so a stage stays where it got to for as long as it takes.
//
// More than one game can go on at once (a run, here), each kept apart at its
// own stage: anyone can start a new one from the first stage of an episode
// (newRun) — from the title, or from the isle — while the others keep going
// for whoever is on
// them. Each game is listed as an island of its own, and keeps its stage, its
// journey (times round the story) and its camps freed so far over a restart
// (in `file`, when given). The island of a stage of a game is always the same
// one, so a restart puts back just the island it had.
//
// The keeper's admin page lists the games, and can start one over from stage 1
// (resetRun) or remove it (removeRun): whoever is on it is sent on, to stage 1
// or to another game.
//
// A retired island stays open a while for whoever is on it to enjoy their win,
// and once everyone has left it, it goes.
import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { generateCode } from '../public/js/shared/codes.js';
import { chapterOf, episodeOf, firstStage, stageName, STAGES } from '../public/js/shared/isle-story.js';
import { Room } from '../public/js/shared/room.js';
import { cleanName, NAME_MAX } from '../public/js/shared/words.js';
import { PeerHost } from './host.js';

export const PUBLIC_ISLAND_NAME = 'Adventure Isle';
// How long a retired island is kept after everyone leaves it.
export const RETIRED_KEEP_MS = 10 * 60 * 1000;
// How many games may go on at once; how long one nobody has played is kept
// before a new one may take its place once there are that many; and how soon
// after one is started another may be (one asked for sooner joins that one).
export const MAX_RUNS = 8;
export const RUN_IDLE_MS = 3 * 24 * 60 * 60 * 1000;
export const NEW_RUN_MS = 20 * 1000;
// How often a game being played writes down when it was last played.
const PLAYED_KEEP_MS = 10 * 60 * 1000;

// The island of one stage of one journey of one game: always the same one, so
// a restart brings back the very island that stage had. (The first game's
// islands are as they were before there could be more.)
function seedFor(run, journey, stage) {
  let h = 2166136261;
  for (const c of `${run > 1 ? `${run}/` : ''}${journey}:${stage}`) {
    h ^= c.charCodeAt(0);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) || 1;
}

const whoStarted = (name) => [...cleanName(name)].slice(0, NAME_MAX).join('');

export class PublicAdventure {
  // rooms: the server's islands (see server.js), which the island of each
  // stage of each run is one of. retiredKeepMs: how long a conquered island is
  // kept after everyone leaves it. file: where the runs are kept over a
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
    // The games going on, the first one first: each { id, journey (times
    // round the story, 1 the first), stage, by (who started it, '' for the
    // first), startedAt, playedAt, entry (its island now), retired, freed }.
    this.runs = [];
    this.nextId = 1;
    // The islands of games removed (removeRun), kept until whoever is on them
    // has gone on, as a game's retired ones are.
    this.leftover = { retired: [] };
    this.stopped = false;
  }

  // The first run's: its island now, its stage and its journey (the one a
  // single journey's isle always had).
  get first() {
    return this.runs[0] ?? null;
  }

  get room() {
    const entry = this.first?.entry;
    return entry && !entry.room.closed ? entry.room : null;
  }

  get entry() {
    return this.first?.entry ?? null;
  }

  get stage() {
    return this.first?.stage ?? 0;
  }

  get journey() {
    return this.first?.journey ?? 1;
  }

  // Every run's island now.
  currentRooms() {
    return this.runs.map((r) => r.entry?.room).filter((room) => room && !room.closed);
  }

  runById(id) {
    return this.runs.find((r) => r.id === id) ?? null;
  }

  // Makes the island of each game at the stage it had got to, kept from before
  // a restart with the camps freed by then, or a first game at stage 1. A file
  // from before there could be more keeps its one game, and a new one starts
  // beside it from stage 1, first, so the story can be begun from the start. Call
  // tick() now and then (the server does, about ten times a second) for the
  // stages to follow.
  start() {
    if (this.runs.length) return this;
    const kept = this.readKept();
    const now = this.now();
    const runs = kept?.runs ?? [];
    this.nextId = Math.max(kept?.next ?? 1, ...runs.map((r) => r.id + 1));
    if (kept?.single) runs.unshift({ id: this.nextId++, journey: 1, stage: 1, by: '', startedAt: now, playedAt: now, freed: [] });
    if (!runs.length) runs.push({ id: this.nextId++, journey: 1, stage: 1, by: '', startedAt: now, playedAt: now, freed: [] });
    for (const r of runs) {
      const run = { id: r.id, journey: r.journey, stage: r.stage, by: r.by, startedAt: r.startedAt, playedAt: r.playedAt, entry: null, retired: [], freed: 0, keptPlayed: r.playedAt };
      this.runs.push(run);
      this.open(run, r.stage, r.journey, r.freed);
    }
    this.keep();
    for (const run of this.runs) this.say(`game ${run.id} is up: ${stageName(run.stage)} (stage ${run.stage} of ${STAGES} in all), journey ${run.journey} (code ${run.entry.code}).`);
    return this;
  }

  // What was kept, checked: { runs, next }, or { runs: [that one], single } for
  // a file from before there were runs; null if nothing makes sense. (A file
  // from the days when the stages started over each day, or went past the last
  // chapter, has no journey: on from there, the first one.)
  readKept() {
    if (!this.file) return null;
    let kept;
    try {
      kept = JSON.parse(readFileSync(this.file, 'utf8'));
    } catch (error) {
      if (error.code !== 'ENOENT') this.say(`its games in ${this.file} could not be read (${error.message}).`);
      return null;
    }
    const now = this.now();
    const int = (v, lo, fallback) => (Number.isInteger(v) && v >= lo ? v : fallback);
    const one = (r, id) => {
      if (!Number.isInteger(r?.stage) || r.stage < 1) return null;
      const journey = int(r.journey, 1, 1);
      const time = (v) => (Number.isFinite(v) && v > 0 && v <= now ? v : now);
      const base = { id, by: typeof r.by === 'string' ? whoStarted(r.by) : '', startedAt: time(r.startedAt), playedAt: time(r.playedAt) };
      if (r.stage > STAGES) return { ...base, journey: journey + 1, stage: 1, freed: [] };
      return { ...base, journey, stage: r.stage, freed: Array.isArray(r.freed) ? r.freed.filter(Number.isInteger) : [] };
    };
    if (Array.isArray(kept?.runs)) {
      const runs = [];
      for (const r of kept.runs.slice(0, MAX_RUNS)) {
        const id = int(r?.id, 1, 0);
        const run = id && !runs.some((o) => o.id === id) ? one(r, id) : null;
        if (run) runs.push(run);
      }
      return runs.length ? { runs, next: int(kept.next, 1, 1) } : null;
    }
    const single = one(kept, 1);
    return single ? { runs: [single], next: 2, single: true } : null;
  }

  // Every run's journey, stage and camps freed, and when it was started and last
  // played, written as any of them changes: a small file, rarely.
  keep() {
    if (!this.file) return;
    const runs = this.runs.map((r) => ({
      id: r.id,
      journey: r.journey,
      stage: r.stage,
      freed: r.entry ? r.entry.room.adventure.camps.filter((c) => c.freed).map((c) => c.id) : [],
      ...(r.by ? { by: r.by } : {}),
      startedAt: r.startedAt,
      playedAt: r.playedAt,
    }));
    try {
      mkdirSync(dirname(this.file), { recursive: true });
      writeFileSync(`${this.file}.tmp`, `${JSON.stringify({ runs, next: this.nextId })}\n`);
      renameSync(`${this.file}.tmp`, this.file);
    } catch (error) {
      this.say(`its games could not be kept (${error.message}).`);
    }
  }

  // A run's island of a stage in place of the one it had: that one is retired —
  // left open a while for whoever is on it — and this one is the run's public
  // island from here on. freed: the camps freed on it already (those kept over a
  // restart), freed again now, with nobody there to see.
  open(run, stage, journey, freed = []) {
    run.stage = stage;
    run.journey = journey;
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
      seed: seedFor(run.id, journey, stage),
      settings: chapter.day ? { day: chapter.day } : null,
      log: (error) => this.log(`Adventure Isle: a mistake on game ${run.id}, stage ${stage}: ${error?.message ?? error}`),
    });
    room.public = true;
    // Which run it is, for the list of open islands (room.listing), and a new
    // run started from it (room.js, an `isle` message or a join asking for one).
    room.isleRun = { id: run.id, by: run.by };
    // (Its pages are told which game it is: its intro plays at each game's start, ui.js.)
    room.adventure.run = run.id;
    room.onIsleNew = (name, episode = 1) => this.newRun(name, this.now(), episode);
    for (const id of freed) {
      const camp = room.adventure.campById(id);
      if (camp?.kind === 'camp' && !camp.freed) room.campFreed(room.adventure.free(camp, [], room.monsters));
    }
    run.entry = { code, room, emptySince: 0, public: true };
    run.freed = room.adventure.camps.filter((c) => c.freed).length;
    this.rooms.set(code, run.entry);
    this.onOpen?.(room);
    return run.entry;
  }

  freeCode() {
    for (;;) {
      const code = generateCode();
      if (!this.rooms.has(code)) return code;
    }
  }

  // A new game from the first stage of an episode (the first, unless said),
  // kept apart from the others, as `by` asked: { code, stage } of its island;
  // or, a moment after another of that episode was started, that one's (they
  // start it together); or { error } when there are as many games as there may
  // be and none of them can make room (nobody has played it for RUN_IDLE_MS).
  newRun(by = '', now = this.now(), episode = 1) {
    if (this.stopped) return { error: 'Adventure Isle is closing. Try again in a moment!' };
    const start = firstStage(episodeOf(episode).n);
    const last = this.runs.at(-1);
    if (last && this.runs.length > 1 && now - last.startedAt < NEW_RUN_MS && last.stage === start && last.journey === 1) return { code: last.entry.code, stage: start };
    if (this.runs.length >= MAX_RUNS) {
      const idle = this.runs.filter((r) => r.entry.room.online === 0 && r.retired.every((o) => o.room.online === 0) && now - r.playedAt >= RUN_IDLE_MS).sort((a, b) => a.playedAt - b.playedAt)[0];
      if (!idle) return { error: `There are ${MAX_RUNS} games on Adventure Isle already — come and join one of them!` };
      this.drop(idle, now);
    }
    const run = { id: this.nextId++, journey: 1, stage: start, by: whoStarted(by), startedAt: now, playedAt: now, entry: null, retired: [], freed: 0, keptPlayed: now };
    this.runs.push(run);
    this.open(run, start, 1);
    this.keep();
    this.say(`${run.by || 'someone'} started game ${run.id} at ${stageName(start, true)} (code ${run.entry.code}).`);
    return { code: run.entry.code, stage: start };
  }

  // A run gone for good, to make room (nobody had played it for a long time):
  // its islands go with it.
  drop(run, now) {
    this.retire(run, now, '');
    for (const r of run.retired) {
      r.room.close();
      this.rooms.delete(r.code);
      this.onGone?.(r.room);
    }
    run.retired = [];
    this.runs.splice(this.runs.indexOf(run), 1);
    this.say(`game ${run.id} (stage ${run.stage}, unplayed since ${new Date(run.playedAt).toISOString()}) made room for a new one.`);
  }

  // The games as the admin page shows them: each one's number, stage and
  // journey, who started it and when, when it was last played, its island's
  // code, how many are on its islands now, and how many of its camps are free.
  adminList() {
    return this.runs.map((r, i) => {
      const room = r.entry?.room;
      const camps = room ? room.adventure.camps.filter((c) => c.kind === 'camp') : [];
      return {
        id: r.id,
        first: i === 0,
        stage: r.stage,
        journey: r.journey,
        by: r.by,
        startedAt: r.startedAt,
        playedAt: r.playedAt,
        code: r.entry?.code ?? '',
        players: (room?.online ?? 0) + r.retired.reduce((n, o) => n + o.room.online, 0),
        camps: camps.length,
        freed: camps.filter((c) => c.freed).length,
      };
    });
  }

  // A game started over from stage 1 of the episode it is in (the admin
  // page's ↺ Start over): its island now retired, and whoever is on it sent on
  // to its new stage 1, as after a win. Returns { code, stage } of its new
  // island, or null for no such game.
  resetRun(id, now = this.now()) {
    const run = this.runById(id);
    if (!run || this.stopped) return null;
    const done = run.entry;
    const start = firstStage(chapterOf(run.stage).episode.n);
    this.open(run, start, 1);
    run.startedAt = now;
    run.playedAt = now;
    run.keptPlayed = now;
    const next = { code: run.entry.code, stage: start };
    this.retire(run, now, `This game of ${PUBLIC_ISLAND_NAME} starts over from stage 1! 🌟 Off you all go there in a moment.`, done, next);
    this.keep();
    this.say(`game ${run.id} started over at ${stageName(start, true)} (code ${next.code}).`);
    return next;
  }

  // A game removed for good (the admin page's 🗑 Remove): whoever is on its
  // islands is sent on to another game — the first left, or a new one from
  // stage 1 if it was the only one, as there is always one. Returns { code,
  // stage } of where they go, or null for no such game.
  removeRun(id, now = this.now()) {
    const run = this.runById(id);
    if (!run || this.stopped) return null;
    this.runs.splice(this.runs.indexOf(run), 1);
    if (!this.runs.length) {
      const fresh = { id: this.nextId++, journey: 1, stage: 1, by: '', startedAt: now, playedAt: now, entry: null, retired: [], freed: 0, keptPlayed: now };
      this.runs.push(fresh);
      this.open(fresh, 1, 1);
    }
    const to = this.runs[0];
    const next = { code: to.entry.code, stage: to.stage };
    const text = `This game of ${PUBLIC_ISLAND_NAME} is over — off you all go to another one in a moment!`;
    this.retire(run, now, text, run.entry, next);
    // Its islands of stages won before, and anyone still on them, go the same way.
    for (const r of run.retired) {
      r.room.next = next;
      if (r.room.online > 0) {
        r.room.broadcast({ t: 'notice', level: 'info', text });
        r.room.broadcast({ t: 'next', ...next });
      }
    }
    this.leftover.retired.push(...run.retired);
    run.retired = [];
    run.entry = null;
    this.keep();
    this.say(`game ${run.id} (stage ${run.stage}) removed; its players go on to game ${to.id} (code ${next.code}).`);
    return next;
  }

  // Moves each run on: won, to its next stage (the next episode's first,
  // after an episode's last) — and the last stage of all won, the story told,
  // back to stage 1 on its next journey round.
  tick(now = this.now()) {
    if (this.stopped || !this.runs.length) return;
    this.sweep(this.leftover, now);
    let changed = false;
    for (const run of this.runs) {
      this.sweep(run, now);
      const room = run.entry.room;
      if (room.closed) {
        // Gone by itself (the server shutting down): never while ticking.
        this.retire(run, now, '');
        this.open(run, run.stage, run.journey);
        changed = true;
        continue;
      }
      if (room.online > 0 || run.retired.some((r) => r.room.online > 0)) {
        run.playedAt = now;
        if (now - run.keptPlayed >= PLAYED_KEEP_MS) {
          run.keptPlayed = now;
          changed = true;
        }
      }
      const adv = room.adventure;
      if (adv?.won) {
        // The next stage's island first, so everyone on this one can be told
        // where it is: their pages fly them on there by themselves (ui.js).
        const done = run.entry;
        const won = chapterOf(run.stage);
        const last = run.stage >= STAGES;
        this.open(run, last ? 1 : run.stage + 1, last ? run.journey + 1 : run.journey);
        const next = { code: run.entry.code, stage: run.stage };
        const to = chapterOf(next.stage);
        if (last) {
          this.retire(run, now, `${won.episode.title} is told! ${won.episode.icon} A new journey starts from stage 1 — come along when you are ready!`, done, next);
          this.say(`game ${run.id}: the last stage conquered; journey ${run.journey} starts at stage 1 (code ${next.code}).`);
        } else if (won.final) {
          this.retire(run, now, `${won.episode.title} is told! ${to.episode.icon} The story goes on with Episode ${to.episode.n}, ${to.episode.title} — come along when you are ready!`, done, next);
          this.say(`game ${run.id}: episode ${won.episode.n} conquered; ${stageName(next.stage, true)} is up (code ${next.code}).`);
        } else {
          this.retire(run, now, `On to stage ${to.n}! ${to.episode.icon} Off you all go there in a moment — come and conquer it together!`, done, next);
          this.say(`game ${run.id}: stage ${next.stage - 1} conquered; stage ${next.stage} is up (code ${next.code}).`);
        }
        changed = true;
        continue;
      }
      // A camp freed since last time: kept, so a restart does not take it back.
      const freed = adv ? adv.camps.filter((c) => c.freed).length : 0;
      if (freed !== run.freed) {
        run.freed = freed;
        changed = true;
      }
    }
    if (changed) this.keep();
  }

  // The island that was a run's public one: no longer the island to conquer, no
  // longer listed as public, told where the next one is (next: the next stage's
  // { code, stage }, when it was won), and kept until everyone has left it (and
  // a while).
  retire(run, now, text, entry = run.entry, next = null) {
    const { code, room } = entry;
    room.public = false;
    entry.public = false;
    // Anyone coming to it from here on (a page reconnecting) is told too.
    if (next) room.next = next;
    run.retired.push({ code, room, emptySince: room.online > 0 ? 0 : now });
    if (room.online > 0) {
      if (text) room.broadcast({ t: 'notice', level: 'info', text });
      if (next) room.broadcast({ t: 'next', ...next });
    }
    this.onRetire?.(room);
  }

  // A run's retired islands go once everyone has left them and a while has passed.
  sweep(run, now) {
    for (let i = run.retired.length - 1; i >= 0; i--) {
      const r = run.retired[i];
      if (r.room.closed) {
        this.rooms.delete(r.code);
        run.retired.splice(i, 1);
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
      run.retired.splice(i, 1);
      this.onGone?.(r.room);
    }
  }

  say(text) {
    this.log(`Adventure Isle: ${text}`);
  }

  stop() {
    this.stopped = true;
    for (const entry of this.leftover.retired) {
      if (!entry.room.closed) entry.room.close();
      this.rooms.delete(entry.code);
      this.onGone?.(entry.room);
    }
    this.leftover.retired = [];
    for (const run of this.runs) {
      if (run.entry) this.onRetire?.(run.entry.room);
      for (const entry of [run.entry, ...run.retired].filter(Boolean)) {
        if (!entry.room.closed) entry.room.close();
        this.rooms.delete(entry.code);
        this.onGone?.(entry.room);
      }
      run.entry = null;
      run.retired = [];
    }
    this.runs = [];
  }
}

// The shared isle over WebRTC as well, the way the AI friend's island is
// (buddy.js): each stage of each of its games hosted peer to peer under its
// code and on the keeper's list of open islands, so pages anywhere — the game on
// GitHub Pages — can come and conquer it together. Returns a function that
// stops it.
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
  for (const room of isle.currentRooms()) share(room);
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
