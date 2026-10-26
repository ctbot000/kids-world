// The AI friend (buddy.js) as the admin page runs it: its settings, saved in
// the keeper's data folder as ai-friend.json, and what the page sees of it.
// Settings: on or off, its name, its model (any Z.ai has; when Z.ai cannot
// answer, the local Ollama answers with its own, from KIDS_WORLD_AI_MODEL),
// whether it visits islands by itself, on how many islands at once, and
// whether it keeps an island of its own (saved beside them as
// ai-friend-island.json). Until they are first saved, they come from the
// environment (KIDS_WORLD_AI=off, KIDS_WORLD_AI_NAME, KIDS_WORLD_ZAI_MODEL,
// KIDS_WORLD_AI_WANDER=off, KIDS_WORLD_AI_HOME=off).
// The tokens its models took, a day at a time, are tallied beside them in
// ai-friend-usage.json, for the admin page.
// Changes apply at once: a new name from its next visit on, as the islands it
// is on know it by the old one; turned off, it goes home from every island.
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { isValidName, NAME_MAX } from '../public/js/shared/words.js';
import { DEFAULT_NAME } from './buddy.js';
import { KeepError } from './keeper.js';
import { costOf, DEFAULT_ZAI_MODEL } from './llm.js';

export const SETTINGS_FILE = 'ai-friend.json';
export const HOME_FILE = 'ai-friend-island.json';
export const USAGE_FILE = 'ai-friend-usage.json';
export const MAX_VISITS = 5;
// How many days of token counts are kept, and how soon after an answer they are saved.
const USAGE_DAYS = 400;
const USAGE_SAVE_MS = 10000;
const DAY_MS = 86400000;
const MODEL_NAME = /^[\w.:/-]{1,100}$/;

export function defaultSettings(env = process.env) {
  return {
    on: env.KIDS_WORLD_AI !== 'off',
    name: env.KIDS_WORLD_AI_NAME || DEFAULT_NAME,
    model: env.KIDS_WORLD_ZAI_MODEL || DEFAULT_ZAI_MODEL,
    wander: env.KIDS_WORLD_AI_WANDER !== 'off',
    maxVisits: 2,
    home: env.KIDS_WORLD_AI_HOME !== 'off',
  };
}

// Settings with what changes in them, each checked; throws a KeepError for one that is wrong.
export function changeSettings(settings, change) {
  const next = { ...settings };
  if (!change || typeof change !== 'object') throw new KeepError('bad-settings', 'Those settings are not readable.');
  for (const key of ['on', 'wander', 'home']) {
    if (key in change) {
      if (typeof change[key] !== 'boolean') throw new KeepError('bad-settings', `${key} is on or off.`);
      next[key] = change[key];
    }
  }
  if ('name' in change) {
    const name = typeof change.name === 'string' ? change.name.normalize('NFC').trim().replace(/\s+/gu, ' ') : '';
    if (!isValidName(name) || [...name].length > NAME_MAX) throw new KeepError('bad-settings', `A name needs 1 to ${NAME_MAX} characters you can see.`);
    next.name = name;
  }
  if ('model' in change) {
    if (typeof change.model !== 'string' || !MODEL_NAME.test(change.model)) throw new KeepError('bad-settings', 'That is not a model name.');
    next.model = change.model;
  }
  if ('maxVisits' in change) {
    if (!Number.isInteger(change.maxVisits) || change.maxVisits < 1 || change.maxVisits > MAX_VISITS) throw new KeepError('bad-settings', `It can be on 1 to ${MAX_VISITS} islands at once.`);
    next.maxVisits = change.maxVisits;
  }
  return next;
}

// A day on this computer's own calendar, as YYYY-MM-DD.
export function dayOf(ms) {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

let saves = 0;
const count = (n) => (Number.isInteger(n) && n >= 0 ? n : 0);

// The tokens the AI friend's models took: for each day, a row for each model
// (by who serves it: Z.ai, Ollama), with how many answers and how many tokens
// went in (the prompt) and came out. Saved a little after each answer, and on
// stop.
export class TokenUsage {
  constructor(file, now = Date.now) {
    this.file = file;
    this.now = now;
    // day → [{ name, model, answers, promptTokens, tokens }]
    this.days = {};
    this.timer = null;
    this.saving = Promise.resolve();
  }

  async load() {
    try {
      const days = JSON.parse(await readFile(this.file, 'utf8'))?.days;
      for (const [day, rows] of Object.entries(days && typeof days === 'object' ? days : {})) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || !Array.isArray(rows)) continue;
        this.days[day] = rows
          .filter((r) => r && typeof r.name === 'string' && typeof r.model === 'string')
          .map((r) => ({ name: r.name, model: r.model, answers: count(r.answers), promptTokens: count(r.promptTokens), tokens: count(r.tokens) }));
      }
    } catch (error) {
      if (error.code !== 'ENOENT') console.log(`AI friend: its token counts in ${this.file} could not be read (${error.message}); starting again.`);
    }
    return this;
  }

  // Usage entries from one answer (llm.js), counted today.
  add(entries) {
    const day = dayOf(this.now());
    const rows = (this.days[day] ??= []);
    for (const e of entries) {
      let row = rows.find((r) => r.name === e.name && r.model === e.model);
      if (!row) rows.push((row = { name: e.name, model: e.model, answers: 0, promptTokens: 0, tokens: 0 }));
      row.answers++;
      row.promptTokens += count(e.promptTokens);
      row.tokens += count(e.tokens);
    }
    const oldest = dayOf(this.now() - (USAGE_DAYS - 1) * DAY_MS);
    for (const d of Object.keys(this.days)) if (d < oldest) delete this.days[d];
    if (!this.timer) {
      this.timer = setTimeout(() => this.save(), USAGE_SAVE_MS);
      this.timer.unref?.();
    }
  }

  // Saved now (one save at a time); a failed save is only logged.
  save() {
    clearTimeout(this.timer);
    this.timer = null;
    const text = `${JSON.stringify({ days: this.days })}\n`;
    this.saving = this.saving.then(async () => {
      try {
        // Its own name, so two tallies on one folder never trip on each other's.
        const tmp = `${this.file}.${process.pid}-${++saves}.tmp`;
        await mkdir(dirname(tmp), { recursive: true });
        await writeFile(tmp, text);
        await rename(tmp, this.file);
      } catch (error) {
        console.log(`AI friend: its token counts could not be saved in ${this.file} (${error.message}).`);
      }
    });
    return this.saving;
  }

  // What the admin page shows: today, the last 7 and 30 days (today among
  // them) and every day kept, each a row per model and the totals, with what
  // they cost in US dollars (null for a model of unknown price; the total
  // then counts only the known ones, and says so with unpriced); and for its
  // chart each of the last 30 days, oldest first, a row per model used that
  // day (none on a day with no answers).
  summary() {
    const today = this.now();
    const kept = Object.keys(this.days).sort();
    const period = (key, days) => {
      const from = days ? dayOf(today - (days - 1) * DAY_MS) : '';
      const rows = [];
      for (const day of kept) {
        if (day < from) continue;
        for (const r of this.days[day]) {
          let row = rows.find((o) => o.name === r.name && o.model === r.model);
          if (!row) rows.push((row = { name: r.name, model: r.model, answers: 0, promptTokens: 0, tokens: 0 }));
          row.answers += r.answers;
          row.promptTokens += r.promptTokens;
          row.tokens += r.tokens;
        }
      }
      for (const row of rows) row.cost = costOf(row.name, row.model, row.promptTokens, row.tokens);
      rows.sort((a, b) => b.promptTokens + b.tokens - (a.promptTokens + a.tokens) || a.name.localeCompare(b.name) || a.model.localeCompare(b.model));
      const total = rows.reduce(
        (t, r) => ({ answers: t.answers + r.answers, promptTokens: t.promptTokens + r.promptTokens, tokens: t.tokens + r.tokens, cost: t.cost + (r.cost ?? 0), unpriced: t.unpriced || r.cost === null }),
        { answers: 0, promptTokens: 0, tokens: 0, cost: 0, unpriced: false },
      );
      return { key, rows, total };
    };
    const days = [];
    for (let i = 29; i >= 0; i--) {
      const day = dayOf(today - i * DAY_MS);
      days.push({ day, rows: (this.days[day] ?? []).map((r) => ({ ...r, cost: costOf(r.name, r.model, r.promptTokens, r.tokens) })) });
    }
    return { since: kept[0] ?? null, periods: [period('today', 1), period('week', 7), period('month', 30), period('all', 0)], days };
  }
}

export class FriendControl {
  // dir: where its settings are saved. llm: what it talks with (llm.js: Z.ai
  // with the local Ollama as a standby), whose model the settings pick.
  // make(settings, { homeFile }): a new Buddy, keeping its own island in
  // homeFile.
  constructor({ dir, llm, make, env = process.env, now = Date.now }) {
    this.file = join(dir, SETTINGS_FILE);
    this.usage = new TokenUsage(join(dir, USAGE_FILE), now);
    this.homeFile = join(dir, HOME_FILE);
    this.llm = llm;
    this.make = make;
    this.settings = defaultSettings(env);
    this.saved = false;
    this.buddy = null;
    // The last one that ran, so what it did can still be seen once it is off.
    this.last = null;
  }

  async start() {
    await this.usage.load();
    try {
      this.settings = changeSettings(this.settings, JSON.parse(await readFile(this.file, 'utf8')));
      this.saved = true;
    } catch (error) {
      if (error.code !== 'ENOENT') console.log(`AI friend: its settings in ${this.file} could not be read (${error.message}); using the defaults.`);
    }
    this.llm.model = this.settings.model;
    if (this.settings.on) await this.wake();
    return this;
  }

  async wake() {
    this.buddy = this.make(this.settings, { homeFile: this.homeFile });
    this.buddy.onUsage = (entries) => this.usage.add(entries);
    this.last = this.buddy;
    await this.buddy.start();
  }

  // Changes settings (some of them), saves them, and applies them at once.
  async change(change) {
    const before = this.settings;
    const next = changeSettings(before, change);
    const tmp = `${this.file}.tmp`;
    await mkdir(dirname(tmp), { recursive: true });
    await writeFile(tmp, `${JSON.stringify(next, null, 2)}\n`);
    await rename(tmp, this.file);
    this.settings = next;
    this.saved = true;
    this.llm.model = next.model;
    if (!next.on) {
      const b = this.buddy;
      this.buddy = null;
      await b?.stop();
    } else if (!this.buddy) {
      await this.wake();
    } else {
      const b = this.buddy;
      b.rename(next.name);
      b.wander = next.wander;
      b.maxVisits = next.maxVisits;
      if (next.home !== before.home) await b.setHome(next.home);
      if (next.model !== before.model) await b.check();
    }
    return next;
  }

  // Off home from one island, as if its owner had sent it (but back another day).
  sendHome(code) {
    const visit = this.buddy?.visits.get(code);
    if (!visit) return false;
    visit.end('sent home');
    return true;
  }

  // Something said on an island it is on (its own too), as its own words:
  // '' when said, or why not; null when it is not on that island.
  say(code, text) {
    const b = this.buddy;
    const visit = b?.visits.get(code) ?? (b?.home?.island.code === code ? b.home : null);
    return visit && !visit.ended ? visit.sayForAdmin(text) : null;
  }

  // Something said to it on an island it is on (its own too), the way a
  // player's words reach it, for the admin page to exercise it: '' when it
  // will answer, or why not; null when it is not on that island.
  chat(code, text) {
    const b = this.buddy;
    const visit = b?.visits.get(code) ?? (b?.home?.island.code === code ? b.home : null);
    return visit && !visit.ended ? visit.chatForAdmin(text) : null;
  }

  // Whether the model is there, checked now rather than in a minute.
  async check() {
    await this.buddy?.check();
  }

  // What the admin page shows.
  async status() {
    const b = this.buddy;
    const seen = b ?? this.last;
    return {
      settings: this.settings,
      saved: this.saved,
      running: Boolean(b),
      ready: Boolean(b?.ready),
      problem: b ? (b.problem ?? '') : '',
      url: this.llm.url,
      models: await this.llm.models(),
      llms: this.llm.states?.() ?? null,
      maxVisits: MAX_VISITS,
      listed: b ? b.listing().online : false,
      home: b?.home && !b.home.ended ? b.home.summary() : null,
      visits: b ? [...b.visits.values()].filter((v) => !v.ended).map((v) => v.summary()) : [],
      stats: seen ? { ...seen.stats } : null,
      history: seen ? [...seen.history].reverse() : [],
      usage: this.usage.summary(),
    };
  }

  // The model log: its last questions to the model, newest first, with
  // everything sent and what came back (the last one that ran, once it is off).
  calls() {
    return [...((this.buddy ?? this.last)?.calls ?? [])].reverse();
  }

  // Stopped, with its own island saved.
  async stop() {
    const b = this.buddy;
    this.buddy = null;
    await b?.stop();
    await this.usage.save();
  }
}
