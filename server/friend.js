// The AI friend (buddy.js) as the admin page runs it: its settings, saved in
// the keeper's data folder as ai-friend.json, and what the page sees of it.
// Settings: on or off, its name, its model (any Ollama has), whether it
// visits islands by itself, and on how many islands at once. Until they are
// first saved, they come from the environment (KIDS_WORLD_AI=off,
// KIDS_WORLD_AI_NAME, KIDS_WORLD_AI_MODEL, KIDS_WORLD_AI_WANDER=off).
// Changes apply at once: a new name from its next visit on, as the islands it
// is on know it by the old one; turned off, it goes home from every island.
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { isValidName, NAME_MAX } from '../public/js/shared/words.js';
import { DEFAULT_NAME } from './buddy.js';
import { KeepError } from './keeper.js';
import { DEFAULT_MODEL } from './llm.js';

export const SETTINGS_FILE = 'ai-friend.json';
export const MAX_VISITS = 5;
const MODEL_NAME = /^[\w.:/-]{1,100}$/;

export function defaultSettings(env = process.env) {
  return {
    on: env.KIDS_WORLD_AI !== 'off',
    name: env.KIDS_WORLD_AI_NAME || DEFAULT_NAME,
    model: env.KIDS_WORLD_AI_MODEL || DEFAULT_MODEL,
    wander: env.KIDS_WORLD_AI_WANDER !== 'off',
    maxVisits: 2,
  };
}

// Settings with what changes in them, each checked; throws a KeepError for one that is wrong.
export function changeSettings(settings, change) {
  const next = { ...settings };
  if (!change || typeof change !== 'object') throw new KeepError('bad-settings', 'Those settings are not readable.');
  for (const key of ['on', 'wander']) {
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

export class FriendControl {
  // dir: where its settings are saved. llm: the Ollama (llm.js) it talks
  // with, whose model the settings pick. make(settings): a new Buddy.
  constructor({ dir, llm, make, env = process.env }) {
    this.file = join(dir, SETTINGS_FILE);
    this.llm = llm;
    this.make = make;
    this.settings = defaultSettings(env);
    this.saved = false;
    this.buddy = null;
    // The last one that ran, so what it did can still be seen once it is off.
    this.last = null;
  }

  async start() {
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
    this.buddy = this.make(this.settings);
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
      this.buddy?.stop();
      this.buddy = null;
    } else if (!this.buddy) {
      await this.wake();
    } else {
      const b = this.buddy;
      b.rename(next.name);
      b.wander = next.wander;
      b.maxVisits = next.maxVisits;
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

  // Something said on an island it is on, as its own words: '' when said,
  // or why not; null when it is not on that island.
  say(code, text) {
    const visit = this.buddy?.visits.get(code);
    return visit && !visit.ended ? visit.sayForAdmin(text) : null;
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
      maxVisits: MAX_VISITS,
      listed: b ? b.listing().online : false,
      visits: b ? [...b.visits.values()].filter((v) => !v.ended).map((v) => v.summary()) : [],
      stats: seen ? { ...seen.stats } : null,
      history: seen ? [...seen.history].reverse() : [],
    };
  }

  stop() {
    this.buddy?.stop();
    this.buddy = null;
  }
}
