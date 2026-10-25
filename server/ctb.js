// CTB: a company of workers run by language models — Z.ai's GLM models
// only (llm.js): the local Ollama the AI friend falls back to is too small
// for real work, so with Z.ai away CTB is closed — who do real work
// on this project. Their tasks are the project's GitHub issues labelled
// "ctb" (ctb-github.js), added on the admin page or on GitHub, or proposed by
// the workers themselves: a proposal is an issue first, and starts once it is
// labelled "ctb: approved" (Approve on the admin page does that). Players
// send ideas for the game from the game itself (the keeper keeps them): a
// worker reads each one, says yes or no to the player, kindly and in their
// own language, and files one it takes as a proposal (labelled "ctb:
// request" too), which waits for approval like the workers' own. A worker free for a task takes
// the oldest, works on it in a git worktree of its own on a branch
// ctb/issue-<n> (ctb-agent.js: reading, editing and running tests, one step
// at a time), runs the unit tests, and when they pass commits, pushes the
// branch and opens a pull request that closes the issue. Nothing reaches
// main without a person merging that pull request. Meanwhile they sit at
// their desks on the CTB island (ctb-office.js), saying what they are doing.
// Settings are on the admin page, saved in ctb.json in the keeper's data
// folder; the tokens the workers' models take are tallied beside them in
// ctb-usage.json. Before any are saved, KIDS_WORLD_CTB=off turns it off.
import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { EventEmitter } from 'node:events';
import { mkdir, readFile, rename, rm, stat, symlink, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { langOf } from '../public/js/shared/words.js';
import { cleanScore, USERNAME_MAX, usernameKey, WISH_TEXT_MAX } from '../public/js/shared/keeper.js';
import { Agent, layoutOf, testEnv } from './ctb-agent.js';
import { Runs, transcript } from './ctb-runs.js';
import { GitHub, LABELS, repoOf } from './ctb-github.js';
import { MAX_WORKERS, STAFF, workerName } from './ctb-office.js';
import { TokenUsage } from './friend.js';
import { KeepError } from './keeper.js';

export const SETTINGS_FILE = 'ctb.json';
export const USAGE_FILE = 'ctb-usage.json';
export const ISLAND_FILE = 'ctb-island.json';
// When a worker last proposed a task, so a restart does not bring another at once.
export const STATE_FILE = 'ctb-state.json';
const POLL_MS = 2 * 60000;
// The most of the README's "What you can do" a model is given (about 25,000
// tokens; the section is about 47,000 characters now).
const FEATURES_MAX = 100000;
// The tokens a model may take answering an idea or proposing one, its
// thinking included: weighing all of that, GLM thinks past 2,000 and is cut
// off before it answers.
const THINK_TOKENS = 8000;
// The full unit tests before a pull request (the end-to-end ones are left
// to the pre-push hook on main): how long they may take, and how many times
// a worker goes back to fix them.
const GATE_MS = 12 * 60000;
const GATE_ROUNDS = 2;
const GATE_STEPS = 20;
// What a worker's computer on the island shows: their last few steps, a
// thought cut to this many characters, and the task's title.
const SCREEN_STEPS = 6;
const SCREEN_THOUGHT = 240;
const SCREEN_TITLE = 120;
// How many run logs the admin page lists.
const RUNS_SHOWN = 40;
// How many more tries a task that ran out of steps gets at once, carrying
// on from the work kept, before it is marked stuck for a person to look at.
export const CARRY_ONS = 2;
// The subject of a commit keeping a task's unfinished work on its branch.
const KEPT_SUBJECT = 'Work so far on';
const MAX_PROPOSALS = 3;
const HISTORY = 80;
const STEPS_KEPT = 30;
const MODEL_NAME = /^[\w.:/-]{0,100}$/;
const TITLE_MAX = 200;
const BODY_MAX = 20000;

// Who a login is to the islands it joins, as its pages say (main.js islandWho).
export const islandWho = (player) => createHash('sha256').update(`kids-world island player ${player}`).digest('hex');

export function defaultSettings(env = process.env) {
  return { on: env.KIDS_WORLD_CTB !== 'off', workers: 2, propose: true, proposeHours: 6, model: '', owner: env.KIDS_WORLD_CTB_OWNER ?? 'izeye' };
}

export function changeSettings(settings, change) {
  const next = { ...settings };
  if (!change || typeof change !== 'object') throw new KeepError('bad-settings', 'Those settings are not readable.');
  for (const key of ['on', 'propose']) {
    if (key in change) {
      if (typeof change[key] !== 'boolean') throw new KeepError('bad-settings', `${key} is on or off.`);
      next[key] = change[key];
    }
  }
  if ('workers' in change) {
    if (!Number.isInteger(change.workers) || change.workers < 1 || change.workers > MAX_WORKERS) throw new KeepError('bad-settings', `There are 1 to ${MAX_WORKERS} workers.`);
    next.workers = change.workers;
  }
  if ('proposeHours' in change) {
    if (!Number.isInteger(change.proposeHours) || change.proposeHours < 1 || change.proposeHours > 168) throw new KeepError('bad-settings', 'Proposals come every 1 to 168 hours.');
    next.proposeHours = change.proposeHours;
  }
  if ('owner' in change) {
    // The CTB island's owner, by their username ('' for nobody).
    if (typeof change.owner !== 'string' || [...change.owner.trim()].length > USERNAME_MAX) throw new KeepError('bad-settings', 'That is not a username.');
    next.owner = change.owner.trim();
  }
  if ('model' in change) {
    if (typeof change.model !== 'string' || !MODEL_NAME.test(change.model)) throw new KeepError('bad-settings', 'That is not a model name.');
    next.model = change.model;
  }
  return next;
}

// A command's output; throws with what it said when it fails.
export function sh(file, args, { cwd, timeout = 120000, env = process.env } = {}) {
  return new Promise((done, fail) => {
    execFile(file, args, { cwd, timeout, env, maxBuffer: 32 * 1024 * 1024 }, (error, stdout, stderr) => {
      if (error) {
        const e = new Error(`${file} ${args[0]}: ${(stderr || stdout || error.message).trim().split('\n').slice(-3).join(' ')}`);
        e.output = `${stdout}${stderr}`;
        fail(e);
      } else done(stdout);
    });
  });
}

// How a worker scores an idea, in its parts (SCORING): the score is added
// up from them here (scoreFrom), never taken whole from the model, which
// gave every idea about 13 too many when it said a number by itself.
const SCORING_SCHEMA = {
  type: 'object',
  properties: {
    already: { type: 'boolean' },
    enjoy: { type: 'integer' },
    small: { type: 'integer' },
    checks: { type: 'integer' },
    newParts: { type: 'array', items: { type: 'string' } },
    risk: { type: 'integer' },
    bundled: { type: 'boolean' },
    polish: { type: 'boolean' },
    takesAway: { type: 'integer' },
  },
  required: ['already', 'enjoy', 'small', 'checks', 'newParts', 'risk', 'bundled', 'polish', 'takesAway'],
};

// A worker's answer to a player's idea, as the model gives it.
export const WISH_SCHEMA = {
  type: 'object',
  properties: { accept: { type: 'boolean' }, scoring: SCORING_SCHEMA, reply: { type: 'string' }, title: { type: 'string' }, tldr: { type: 'string' }, what: { type: 'string' }, done: { type: 'array', items: { type: 'string' } } },
  required: ['accept', 'scoring', 'reply'],
};

// What a worker's proposal says, as the model answers it.
export const PROPOSAL_SCHEMA = {
  type: 'object',
  properties: { title: { type: 'string' }, scoring: SCORING_SCHEMA, tldr: { type: 'string' }, what: { type: 'string' }, done: { type: 'array', items: { type: 'string' } } },
  required: ['title', 'scoring', 'tldr', 'what', 'done'],
};

// How a worker scores an idea, 0 to 100, the same for a player's idea and
// its own proposal (and as the rate-proposals skill does it), told to the
// model: in parts, added up by scoreFrom. The examples are scores the
// skill gave real proposals, so the worker has something to measure by.
const SCORING = 'Score the idea in parts, as "scoring" (the score is added up from them, starting at 50): already, true when the game has it already (look through what the game has now first; it then scores 15 at most); enjoy, 0 to 25, how much kids would enjoy it (20 or more only for real wonder or something new to play, like a new animal to ride; a small touch is 5 to 10); small, 0 to 15, how much of it copies something the game has nearly whole (one more piece of furniture or a stamp like the others is 12 to 15; a new kind of thing made from scratch is 0 to 5); checks, 0 to 5, for clear checks that tell it is done; newParts, each new thing the job has to make that the game has none of yet, in a few words: a new 3D model, a new block, something new kept in the save, something new sent to every player, a new kind of movement, a new window (each takes 8 off, up to 25 with risk); risk, 0 to 25, for anything else that makes it big or risky (the world itself, saving, who may do what on an island, many models at once); bundled, true for several things in one; polish, true for a polish nobody would notice; takesAway, 0 to 40, 20 or more for taking away something kids can do now (locks, limits, wearing out). Be strict: most ideas end up between 55 and 75, and few above 80. For example: a new rideable animal on the pony pattern scored 78; a pet bed (one piece of furniture and a small change to the pet at night) 72; a monster that burrows underground, with its own model and a moving dirt mound, 62; a whole new island theme with two new animals 45; making the Fire Suit wear out in lava 40; something the game already has 10.';

// A score from its parts (SCORING), each kept to its range, and what made
// it, for the issue: { score, why }, or null for no parts. A player's idea
// (request) gets 5 more.
export function scoreFrom(parts, { request = false } = {}) {
  if (!parts || typeof parts !== 'object') return null;
  const n = (v, max) => (Number.isFinite(Number(v)) ? Math.round(Math.min(max, Math.max(0, Number(v)))) : 0);
  const newParts = (Array.isArray(parts.newParts) ? parts.newParts : []).map((v) => String(v ?? '').replace(/\s+/gu, ' ').trim().slice(0, 80)).filter(Boolean).slice(0, 6);
  const plus = [['enjoy', n(parts.enjoy, 25)], ['small', n(parts.small, 15)], ['checks', n(parts.checks, 5)], ["a player's idea", request ? 5 : 0]];
  const minus = [['new', Math.min(25, n(parts.risk, 25) + 8 * newParts.length)], ['several in one', parts.bundled === true ? 10 : 0], ['polish', parts.polish === true ? 10 : 0], ['takes away', n(parts.takesAway, 40)]];
  let score = 50 + plus.reduce((t, [, v]) => t + v, 0) - minus.reduce((t, [, v]) => t + v, 0);
  if (parts.already === true) score = Math.min(15, score);
  const why = [...plus.filter(([, v]) => v).map(([k, v]) => `${k} +${v}`), ...minus.filter(([, v]) => v).map(([k, v]) => (k === 'new' && newParts.length ? `new: ${newParts.join(', ')} −${v}` : `${k} −${v}`)), ...(parts.already === true ? ['already in the game'] : [])];
  return { score: cleanScore(score), why: why.join(' · ') };
}

// A model's score as a number out of 100, or null: some give it as text.
const scoreOf = (v) => cleanScore(typeof v === 'string' && v.trim() ? Number(v) : v);
// An idea's score: added up from its parts, or (from a model that gave a
// number instead) that number.
const ideaScore = (idea, request) => scoreFrom(idea?.scoring, { request }) ?? (scoreOf(idea?.score) === null ? null : { score: scoreOf(idea.score), why: '' });

// Where a player's idea has got to, as its issue tells it ({ closed,
// completed, labels }, from GitHub.requests): a WISH_STAGES stage.
export function stageOf(issue) {
  if (issue.closed) return issue.completed ? 'done' : 'dropped';
  const has = (l) => issue.labels.includes(l);
  if (has(LABELS.stuck)) return 'stuck';
  if (has(LABELS.pr)) return 'checking';
  if (has(LABELS.working)) return 'building';
  if (has(LABELS.task) || has(LABELS.approved)) return 'approved';
  return 'proposed';
}

// News only goes forward: a task between two tries (no "working" label for a
// moment) is not told as picked again. Stuck and being built go back and forth.
const STAGE_STEP = { '': 0, proposed: 1, approved: 2, building: 3, stuck: 3, checking: 4, done: 5, dropped: 5 };
export const newsOf = (was, now) => now !== was && (STAGE_STEP[now] > STAGE_STEP[was] || (STAGE_STEP[now] === STAGE_STEP[was] && STAGE_STEP[now] === 3));
// How long each part of a proposal may be: issues are kept short.
const TLDR_MAX = 300;
const WHAT_MAX = 700;
const DONE_ITEMS = 4;
const DONE_MAX = 200;

// A proposal's issue, short and in the same shape every time: a TL;DR, what
// to change, and how to tell it is done, then who proposed it. '' when the
// model gave no TL;DR.
export function proposalBody(idea, footer, { request = false } = {}) {
  const line = (v, max) => String(v ?? '').replace(/\s+/gu, ' ').trim().slice(0, max);
  const tldr = line(idea?.tldr, TLDR_MAX);
  if (!tldr) return '';
  const what = line(idea?.what, WHAT_MAX);
  const done = (Array.isArray(idea?.done) ? idea.done : []).map((d) => line(d, DONE_MAX).replace(/^[-*]\s*/, '')).filter(Boolean).slice(0, DONE_ITEMS);
  const scored = ideaScore(idea, request);
  return [`## TL;DR\n\n${tldr}`, what ? `## What\n\n${what}` : '', done.length ? `## Done when\n\n${done.map((d) => `- ${d}`).join('\n')}` : '', scored ? `**Score: ${scored.score}/100**${scored.why ? ` (${scored.why})` : ''}` : '', `_${footer}_`].filter(Boolean).join('\n\n');
}

const issueBrief = (i) => (i ? { number: i.number, title: i.title, url: i.url } : null);

// A pull request's body: what was done, and that it closes the issue.
export function pullBody({ issue, summary, worker, model }) {
  const credit = creditIn(issue.body);
  return `${summary.trim() || 'Done as the issue asks.'}\n\nCloses #${issue.number}.${credit ? `\n\n💡 An idea from **${credit}**, playing Kids World — thank you!` : ''}\n\n— ${worker}, CTB (${model})`;
}

// A name as plain text in GitHub's Markdown: no formatting, links or @mentions.
export const mdText = (text) => String(text).replace(/[\\`*_[\]{}()#+\-.!|<>~@]/g, (c) => `\\${c}`);

// The player an issue credits for its idea (as proposalBody's footer says it), or ''.
export const creditIn = (body) => /💡 An idea from \*\*(.+?)\*\*/u.exec(String(body ?? ''))?.[1] ?? '';

// The workers and their work. llm: what they think with (llm.js), its model
// picked by the settings or the AI friend's. office: the CTB island, or null.
export class Company extends EventEmitter {
  constructor({ llm, github, repoDir, workDir, office = null, settings, friendModel = () => '', log = (text) => console.log(text), now = Date.now, git = (args, opts) => sh('git', args, opts), node = process.execPath, onUsage = () => {}, proposedAt = 0, onProposed = () => {}, wishes = null, runs = null }) {
    super();
    this.llm = llm;
    this.github = github;
    this.repoDir = repoDir;
    this.workDir = workDir;
    this.office = office;
    this.settings = settings;
    this.friendModel = friendModel;
    this.now = now;
    this.git = git;
    this.node = node;
    this.onUsage = onUsage;
    // The run logs (ctb-runs.js), or null.
    this.runs = runs;
    this.history = [];
    this.log = (text) => {
      this.history.push({ at: this.now(), text: String(text).replace(/^CTB: /, '') });
      if (this.history.length > HISTORY) this.history.splice(0, this.history.length - HISTORY);
      log(text);
    };
    this.workers = STAFF.map((s, k) => ({ k, name: workerName(k), doing: 'At their desk', issue: null, steps: [], startedAt: 0, done: 0, stuck: 0 }));
    this.tasks = [];
    this.proposals = [];
    this.pulls = [];
    this.problem = null;
    this.polling = null;
    this.proposedAt = proposedAt;
    this.onProposed = onProposed;
    // Players' ideas, at the keeper: { list(), answer(id, answer), stage(id,
    // stage) }, or null.
    this.wishes = wishes;
    this.reviewing = null;
    this.reviewer = 0;
    this.proposing = false;
    this.stopped = false;
    this.timer = null;
    // git in the checkout itself (fetch, worktrees, branches), one at a time:
    // two workers fetching at once trip over each other's locks.
    this.queue = Promise.resolve();
  }

  // fn run after whatever the checkout is busy with.
  serial(fn) {
    const run = this.queue.then(fn, fn);
    this.queue = run.catch(() => {});
    return run;
  }

  get model() {
    return this.settings.model || this.friendModel() || this.llm.model;
  }

  async start() {
    await this.check();
    // Tasks a worker was on when this last stopped go back on the board.
    if (!this.problem) {
      for (const i of this.tasks.filter((t) => t.labels.includes(LABELS.working))) {
        await this.github.label(i.number, { remove: [LABELS.working] }).catch(() => {});
        i.labels = i.labels.filter((l) => l !== LABELS.working);
      }
    }
    this.timer = setInterval(() => this.poll(), POLL_MS);
    this.timer.unref?.();
    this.poll();
    return this;
  }

  // '' when GitHub, git and the model are there, or what is wrong.
  async check() {
    let problem = '';
    if (!this.github.repo) problem = 'this folder has no GitHub remote named origin';
    problem ||= await this.github.problem();
    if (!problem) {
      try {
        await this.git(['rev-parse', '--git-dir'], { cwd: this.repoDir });
      } catch {
        problem = `${this.repoDir} is not a git checkout`;
      }
    }
    if (!problem) {
      this.llm.model = this.model;
      problem = await this.llm.problem().catch((e) => e.message);
    }
    if (problem !== this.problem) this.log(problem ? `CTB: closed (${problem}).` : `CTB: open for business on ${this.github.repo}, with ${this.model}.`);
    this.problem = problem;
    if (!problem) await this.refresh();
    return problem;
  }

  // The board as GitHub has it now.
  async refresh() {
    try {
      [this.tasks, this.proposals] = await Promise.all([this.github.tasks(), this.github.proposals()]);
      this.pulls = await this.github.pulls().catch(() => this.pulls);
    } catch (error) {
      this.log(`CTB: could not read the issues (${error.message}).`);
    }
  }

  // Free workers take the oldest tasks nobody is on; with nothing to do, one
  // proposes something now and then.
  poll() {
    if (this.polling || this.stopped || !this.settings.on) return this.polling;
    this.polling = (async () => {
      if (this.problem !== '' && (await this.check())) return;
      await this.refresh();
      // Proposals labelled approved: go.
      const go = this.proposals.filter((p) => p.labels.includes(LABELS.approved));
      for (const p of go) {
        await this.github.label(p.number, { add: [LABELS.task], remove: [LABELS.proposal] });
        this.log(`CTB: proposal #${p.number} was approved, so it is a task now.`);
      }
      if (go.length) await this.refresh();
      const busy = new Set(this.workers.filter((w) => w.issue).map((w) => w.issue.number));
      const open = this.tasks.filter((t) => !busy.has(t.number) && ![LABELS.working, LABELS.pr, LABELS.stuck, LABELS.proposal].some((l) => t.labels.includes(l)));
      for (const w of this.workers.slice(0, this.settings.workers)) {
        if (w.issue || !open.length) continue;
        this.work(w, open.shift());
      }
      this.reviewWishes();
      await this.followWishes();
      const idle = this.workers.slice(0, this.settings.workers).every((w) => !w.issue);
      if (idle && !open.length && this.settings.propose && this.now() - this.proposedAt >= this.settings.proposeHours * 3600000 && this.proposals.length < MAX_PROPOSALS) {
        // Not waited for: a slow model must not hold up the board.
        this.propose(this.workers[0]);
      }
    })()
      .catch((error) => this.log(`CTB: a mistake looking for work: ${error.message}`))
      .finally(() => {
        this.polling = null;
      });
    return this.polling;
  }

  // What a worker says on the island, and keeps for the admin page.
  tell(w, doing, say = '') {
    w.doing = doing;
    if (say) this.office?.say(w.k, say);
    this.showScreens();
    this.emit('change');
  }

  // Each worker's computer on the island shows their real work: the task,
  // what they are doing and their last few steps, with their thoughts.
  showScreens() {
    this.office?.showScreens?.(
      this.workers.map((w) => ({
        name: w.name,
        issue: w.issue ? { n: w.issue.number, title: String(w.issue.title).slice(0, SCREEN_TITLE) } : null,
        doing: w.doing,
        steps: w.issue ? w.steps.slice(-SCREEN_STEPS).map((s) => ({ n: s.n, tool: s.tool, what: s.what, thought: s.thought.slice(0, SCREEN_THOUGHT) })) : [],
        since: w.issue ? w.startedAt : 0,
      })),
    );
  }

  step(w, step, n) {
    const what = {
      list: `looking in ${step.path || 'the project'}`,
      read: `reading ${step.path}`,
      search: `searching for “${String(step.query ?? '').slice(0, 40)}”`,
      write: `writing ${step.path}`,
      edit: `editing ${step.path}`,
      test: `running ${step.path}`,
      diff: 'looking over the changes',
      done: 'finishing up',
      give_up: 'giving up',
    }[step.tool];
    w.steps.push({ at: this.now(), n, tool: step.tool, what, thought: String(step.thought ?? '').slice(0, 400) });
    if (w.steps.length > STEPS_KEPT) w.steps.splice(0, w.steps.length - STEPS_KEPT);
    this.tell(w, `#${w.issue.number}: ${what}`, ['edit', 'write', 'test'].includes(step.tool) && n % 3 === 0 ? `#${w.issue.number}: ${what}…` : '');
  }

  // One task, from the issue to a pull request.
  async work(w, issue) {
    w.issue = issue;
    w.steps = [];
    w.startedAt = this.now();
    const n = issue.number;
    const branch = `ctb/issue-${n}`;
    const dir = join(this.workDir, `issue-${n}`);
    const model = this.model;
    this.tell(w, `#${n}: getting started`, `On it: #${n} ${issue.title}`);
    this.office?.emote(w.k, 'wave');
    this.log(`CTB: ${w.name} took #${n} “${issue.title}”.`);
    let outcome = null;
    let run = null;
    let kept = false;
    try {
      await this.github.label(n, { add: [LABELS.working] });
      await this.github.comment(n, `${w.name} at CTB is on it, with ${model}.`);
      // Cut off by a restart last time: carried on, worktree and all.
      let resumed = await this.interrupted(n, dir);
      let earlier = resumed ? await this.reopen(dir).catch(() => null) : null;
      if (!earlier) {
        resumed = null;
        earlier = await this.checkout(dir, branch);
      }
      this.llm.model = model;
      const agent = new Agent({
        llm: this.llm,
        root: dir,
        name: STAFF[w.k].name,
        task: issue,
        layout: await layoutOf(dir),
        node: this.node,
        ...(resumed ? { base: earlier.base } : earlier),
        onStep: (step, k) => this.step(w, step, k),
        onUsage: (entries) => this.onUsage(entries),
        onCall: (call) => run?.call(call),
        onResult: (k, step, content) => run?.step(k, step, content),
        stopped: () => this.stopped,
      });
      if (resumed) {
        if (resumed.task) agent.messages[1].content = resumed.task;
        agent.changed = new Set(earlier.changed);
        agent.resume(resumed.steps);
      }
      run = await this.startRun({ kind: 'task', w, model, issue, messages: agent.messages.slice(0, 2), resumed: resumed?.id });
      if (resumed) run?.note(`Carrying on from run ${resumed.id}, which the server stopping cut off: its ${agent.steps} steps are given back to the model, and its working copy is as it left it${earlier.changed.length ? ` (changed: ${earlier.changed.join(', ')})` : ''}.`);
      else if (earlier.changed.length) run?.note(`Carrying on from work kept from an earlier try: ${earlier.changed.join(', ')}.`);
      if (earlier.fresh) run?.note(earlier.fresh);
      let result = await agent.run();
      // The unit tests, all of them, before a pull request: a failure goes
      // back to the worker to fix, a couple of times.
      for (let round = 0; result.ok && round <= GATE_ROUNDS; round++) {
        this.tell(w, `#${n}: running all the unit tests`);
        const failed = await this.gate(dir);
        if (!failed) break;
        if (round === GATE_ROUNDS) {
          result = { ok: false, why: `the unit tests still fail:\n\n\`\`\`\n${failed.slice(-3000)}\n\`\`\`` };
          break;
        }
        agent.tell({ tool: 'gate' }, `All the unit tests were run, and some fail. Fix them, then finish again.\n${failed.slice(-8000)}`);
        agent.maxSteps = agent.steps + GATE_STEPS;
        result = await agent.run();
      }
      if (!result.ok && result.outOfSteps) {
        // A note for the next try, kept with the work.
        this.tell(w, `#${n}: writing down where it got to`);
        const note = await agent.handoff();
        if (note) result.why = `${result.why}\n\n${note}`;
      }
      if (!result.ok) throw Object.assign(new Error(result.why), { stuck: true, steps: result.steps, outOfSteps: Boolean(result.outOfSteps) });
      this.tell(w, `#${n}: opening a pull request`);
      const url = await this.publish({ dir, branch, issue, result, w, model });
      await this.github.label(n, { add: [LABELS.pr], remove: [LABELS.working] });
      await this.github.comment(n, `${w.name} opened ${url}.`);
      w.done++;
      outcome = { ok: true, url };
      this.tell(w, `Opened a pull request for #${n}`, `Done! A pull request for #${n}: ${issue.title}`);
      this.office?.emote(w.k, 'cheer');
      this.log(`CTB: ${w.name} opened ${url} for #${n} (${result.steps} steps).`);
    } catch (error) {
      w.stuck++;
      outcome = { ok: false, why: error.message };
      // What it changed is kept on its branch, for the next try to carry on from.
      kept = this.stopped ? false : await this.keep({ dir, branch, issue, w, why: error.message }).catch((e) => (this.log(`CTB: the work on #${n} could not be kept (${e.message}).`), false));
      // Out of steps with work kept: the next try is taken at once, a few times.
      const tries = kept ? await this.tries(dir, n) : 0;
      if (!this.stopped && error.outOfSteps && kept && tries <= CARRY_ONS) {
        outcome.why = `${error.message}\n\n(Carried on in the next try, ${tries + 1} of ${CARRY_ONS + 1}.)`;
        this.log(`CTB: ${w.name} ran out of steps on #${n}; the next try carries on (${tries + 1} of ${CARRY_ONS + 1}).`);
        this.tell(w, `#${n}: out of steps, carrying on`, `#${n} is big! I'll carry on with it.`);
        await this.github.label(n, { remove: [LABELS.working] }).catch(() => {});
        await this.github.comment(n, `${w.name} at CTB ran out of steps on this, try ${tries} of ${CARRY_ONS + 1}:\n\n${error.message}\n\nThe work so far is kept on the branch \`${branch}\`, and the next try carries on from it now.`).catch(() => {});
        return;
      }
      this.log(`CTB: ${w.name} could not finish #${n}: ${error.message.split('\n')[0]}`);
      this.tell(w, `Stuck on #${n}`, `I got stuck on #${n}. A grown-up will have a look.`);
      if (!this.stopped) {
        await this.github.label(n, { add: [LABELS.stuck], remove: [LABELS.working] }).catch(() => {});
        await this.github.comment(n, `${w.name} at CTB could not finish this${error.stuck ? '' : ' (something went wrong)'}:\n\n${error.message}\n\n${kept ? `The work so far is kept on the branch \`${branch}\`, and the next try carries on from it. ` : ''}Remove the “${LABELS.stuck}” label to have the workers try again.`).catch(() => {});
      } else {
        await this.github.label(n, { remove: [LABELS.working] }).catch(() => {});
      }
    } finally {
      // Stopped, its worktree stays for the next start to carry on in.
      await run?.end(this.stopped ? { ok: false, why: 'The server stopped in the middle of it.', stopped: true } : (outcome ?? { ok: false, why: 'stopped' }));
      if (!this.stopped) await this.cleanUp(dir, branch);
      w.issue = null;
      w.last = { issue: issueBrief(issue), at: this.now(), ...outcome };
      this.tell(w, 'At their desk');
      if (!this.stopped) setTimeout(() => this.poll(), 1000).unref?.();
    }
  }

  // The run of task n a restart cut off last, if its worktree is still
  // there: { id, task (its first message), steps (its step events, and
  // those of the runs it carried on from) }, or null.
  async interrupted(n, dir) {
    if (!this.runs || !(await stat(dir).catch(() => null))) return null;
    const last = this.runs.list().find((r) => r.kind === 'task' && r.issue?.number === n);
    if (!last?.stopped) return null;
    const run = await this.runs.read(last.id);
    if (!run) return null;
    return { id: last.id, task: run.events[0].messages?.[1]?.content ?? '', steps: await this.stepsOf(last.id) };
  }

  // A run's step events, after those of the runs it carried on from.
  async stepsOf(id, depth = 0) {
    const run = await this.runs.read(id);
    if (!run) return [];
    const before = run.events[0].resumed && depth < 20 ? await this.stepsOf(run.events[0].resumed, depth + 1) : [];
    return [...before, ...run.events.filter((e) => e.type === 'step')];
  }

  // A worktree left by a run a restart cut off, as it is: what it changed
  // since it left main ({ base, changed }).
  reopen(dir) {
    return this.serial(async () => {
      await this.git(['fetch', '--quiet', 'origin', 'main'], { cwd: this.repoDir }).catch(() => {});
      const base = (await this.git(['merge-base', 'HEAD', 'origin/main'], { cwd: dir })).trim();
      const changed = [...(await this.git(['diff', '--name-only', base], { cwd: dir })).split('\n'), ...(await this.git(['ls-files', '--others', '--exclude-standard'], { cwd: dir })).split('\n')];
      return { base, changed: [...new Set(changed)].filter((p) => p && p !== 'node_modules' && !p.startsWith('node_modules/')) };
    });
  }

  // A worktree on the branch, with this checkout's node_modules for the
  // tests: from the work an earlier try kept on the branch on GitHub, with
  // main as GitHub has it merged in, or else fresh from main. What the agent
  // is told of that work: { base, changed, earlier }, and fresh, why the
  // kept work could not be used.
  checkout(dir, branch) {
    return this.serial(async () => {
      await this.removeWorktree(dir, branch);
      await mkdir(dirname(dir), { recursive: true });
      await this.git(['fetch', '--quiet', 'origin', 'main'], { cwd: this.repoDir });
      const kept = await this.git(['fetch', '--quiet', 'origin', `+refs/heads/${branch}:refs/remotes/origin/${branch}`], { cwd: this.repoDir }).then(
        () => true,
        () => false,
      );
      let out = { base: 'origin/main', changed: [], earlier: '' };
      if (kept) {
        await this.git(['worktree', 'add', '--quiet', '-B', branch, dir, `origin/${branch}`], { cwd: this.repoDir });
        try {
          await this.git(['-c', 'user.name=CTB', '-c', 'user.email=ctb@localhost', 'merge', '--quiet', '--no-edit', '--no-verify', 'origin/main'], { cwd: dir });
          const changed = (await this.git(['diff', '--name-only', 'origin/main'], { cwd: dir })).split('\n').filter(Boolean);
          const earlier = (await this.git(['log', '-1', '--format=%B', `origin/${branch}`], { cwd: dir })).trim();
          out = { base: 'origin/main', changed, earlier: earlier.startsWith(KEPT_SUBJECT) ? earlier.slice(earlier.indexOf('\n') + 1).trim() : '' };
        } catch (error) {
          await this.removeWorktree(dir, branch);
          out.fresh = `The work kept from an earlier try could not be merged with main (${error.message.split('\n')[0]}), so this try starts afresh.`;
          await this.git(['worktree', 'add', '--quiet', '-B', branch, dir, 'origin/main'], { cwd: this.repoDir });
        }
      } else {
        await this.git(['worktree', 'add', '--quiet', '-B', branch, dir, 'origin/main'], { cwd: this.repoDir });
      }
      const modules = join(this.repoDir, 'node_modules');
      if (await stat(modules).catch(() => null)) await symlink(modules, join(dir, 'node_modules'), 'dir');
      return out;
    });
  }

  // A task not finished: what it changed, committed as the worker and pushed
  // to its branch (no pull request), with why it stopped. Whether there was
  // anything to keep.
  async keep({ dir, branch, issue, w, why }) {
    if (!(await stat(dir).catch(() => null))) return false;
    const email = (await this.git(['config', 'user.email'], { cwd: this.repoDir }).catch(() => '')).trim() || 'ctb@localhost';
    const paths = await this.changedPaths(dir);
    if (paths.length) {
      await this.git(['add', '--', ...paths], { cwd: dir });
      await this.commit(dir, w, email, `${KEPT_SUBJECT} #${issue.number}\n\n${why}`);
    }
    if (!Number((await this.git(['rev-list', '--count', 'origin/main..HEAD'], { cwd: dir })).trim())) return false;
    await this.git(['push', '--quiet', '--force', 'origin', `HEAD:refs/heads/${branch}`], { cwd: dir });
    this.log(`CTB: ${w.name}'s work on #${issue.number} is kept on ${branch}.`);
    return true;
  }

  // How many tries at task n kept their work on its branch (this one too).
  async tries(dir, n) {
    const subjects = (await this.git(['log', '--format=%s', 'origin/main..HEAD'], { cwd: dir }).catch(() => '')).split('\n');
    return subjects.filter((l) => l === `${KEPT_SUBJECT} #${n}`).length;
  }

  // What is changed in a worktree and not committed, but its node_modules.
  async changedPaths(dir) {
    const status = (await this.git(['status', '--porcelain', '--untracked-files=all'], { cwd: dir })).split('\n').filter(Boolean);
    return status.map((l) => l.slice(3).replace(/^.* -> /, '')).filter((p) => p !== 'node_modules' && !p.startsWith('node_modules/'));
  }

  // A commit as the worker, its message from a file beside the worktree, so it can be any length.
  async commit(dir, w, email, message) {
    const file = `${dir}.message`;
    await writeFile(file, message);
    try {
      await this.git(['-c', `user.name=${STAFF[w.k].name} (CTB)`, '-c', `user.email=${email}`, 'commit', '--quiet', '--no-verify', '-F', file], { cwd: dir });
    } finally {
      await rm(file, { force: true });
    }
  }

  cleanUp(dir, branch) {
    return this.serial(() => this.removeWorktree(dir, branch));
  }

  async removeWorktree(dir, branch) {
    if (await stat(dir).catch(() => null)) {
      await this.git(['worktree', 'remove', '--force', dir], { cwd: this.repoDir }).catch(() => rm(dir, { recursive: true, force: true }));
    }
    await this.git(['worktree', 'prune'], { cwd: this.repoDir }).catch(() => {});
    await this.git(['branch', '-D', branch], { cwd: this.repoDir }).catch(() => {});
  }

  // The unit tests (not the end-to-end ones): '' when they pass, or their output.
  async gate(dir) {
    const files = (await this.git(['ls-files', 'test/*.test.js'], { cwd: dir }))
      .split('\n')
      .filter((f) => f && !f.endsWith('e2e.test.js'));
    try {
      await sh(this.node, ['--test', '--test-force-exit', '--test-timeout=180000', ...files], { cwd: dir, timeout: GATE_MS, env: testEnv() });
      return '';
    } catch (error) {
      return error.output || error.message;
    }
  }

  // Committed as the worker, pushed, and a pull request opened: its URL.
  async publish({ dir, branch, issue, result, w, model }) {
    const email = (await this.git(['config', 'user.email'], { cwd: this.repoDir }).catch(() => '')).trim() || 'ctb@localhost';
    const paths = await this.changedPaths(dir);
    // Work kept from an earlier try is committed already.
    const ahead = Number((await this.git(['rev-list', '--count', 'origin/main..HEAD'], { cwd: dir })).trim()) || 0;
    if (!paths.length && !ahead) throw Object.assign(new Error('there was nothing to commit'), { stuck: true });
    if (paths.length) {
      await this.git(['add', '--', ...paths], { cwd: dir });
      await this.commit(dir, w, email, `${result.title}\n\n${result.summary.trim()}\n\nCloses #${issue.number}.`);
    }
    await this.git(['push', '--quiet', '--force', 'origin', `HEAD:refs/heads/${branch}`], { cwd: dir });
    return this.github.pullRequest({ branch, title: result.title, body: pullBody({ issue, summary: result.summary, worker: w.name, model }) });
  }

  // What the game has now, as the README's "What you can do" tells it, for
  // the model to weigh an idea against: all of it, as cutting it short left
  // out everything past the first quarter (monsters, hearts, bopping, taming
  // a dragon), and a worker told a child the game had no fighting.
  async features() {
    const readme = await readFile(join(this.repoDir, 'README.md'), 'utf8').catch(() => '');
    return (/## What you can do\s*\n([\s\S]*?)\n## /.exec(readme)?.[1] ?? readme).slice(0, FEATURES_MAX);
  }

  // A run log for a worker's talk with its model (ctb-runs.js), or null
  // without them or when one cannot be started.
  async startRun({ kind, w, model, issue = null, title = '', messages, resumed = '' }) {
    if (!this.runs) return null;
    return this.runs.start({ kind, k: w.k, worker: w.name, model, issue: issueBrief(issue), title: title || issue?.title || '', messages, ...(resumed ? { resumed } : {}) }).catch((error) => {
      this.log(`CTB: a run log could not be started (${error.message}).`);
      return null;
    });
  }

  // One question to the model, as worker w, with its tokens counted and
  // written in a run log of its own: { answer, run }, the run left open for
  // what comes of the answer. A model that fails ends the run, and throws.
  async think(w, { kind, title }, messages, schema, opts) {
    const trace = {};
    this.llm.model = this.model;
    const run = await this.startRun({ kind, w, model: this.model, title, messages });
    const t0 = Date.now();
    try {
      const answer = await this.llm.chat(messages, schema, trace, opts);
      run?.call({ ms: Date.now() - t0, trace });
      return { answer, run };
    } catch (error) {
      run?.call({ ms: Date.now() - t0, trace, error });
      run?.end({ ok: false, why: error.message });
      throw error;
    } finally {
      if (trace.usage?.length) this.onUsage(trace.usage);
    }
  }

  // A worker's idea for the project, as an issue waiting for approval.
  async propose(w) {
    if (this.proposing) return null;
    this.proposing = true;
    this.proposedAt = this.now();
    this.onProposed(this.proposedAt);
    this.tell(w, 'Thinking of something to propose');
    let run = null;
    try {
      const features = await this.features();
      const recent = await this.git(['log', '--format=%s', '-n', '25', 'origin/main'], { cwd: this.repoDir }).catch(() => '');
      const open = [...this.tasks, ...this.proposals].map((i) => `#${i.number} ${i.title}`).join('\n') || '(none)';
      const thought = await this.think(w, { kind: 'proposal', title: 'A proposal' }, [
        { role: 'system', content: `You are ${STAFF[w.k].name}, a software engineer at CTB, which builds kids-world, a 3D block-building island game for kids played together in the browser: cozy building and pets, and adventures too, with monsters to bop, hearts and potions, toy weapons and a dragon to tame. Propose ONE small, concrete improvement a single engineer could make in a day: a bug fix, a polish of one thing that exists, or one small new thing kids would enjoy. Narrow and specific: it changes one thing, named in the title (like "Make the bus honk when tapped" or "Show the pet's name over its head"), touching a few files at most. Never a summary, a recap, a log or a list of several things; never "improve X" or "update Y" without saying exactly what. Not something already done or already proposed. Be concise: plain words, no filler. ${SCORING} Answer as JSON: {"title": a short imperative issue title, "scoring": its score in parts, "tldr": one or two sentences saying what and why, "what": the change itself in at most three short sentences, "done": two to four short checks that tell it is done}.` },
        { role: 'user', content: `What the game has now:\n${features}\n\nRecent changes:\n${recent}\n\nOpen tasks and proposals:\n${open}` },
      ], PROPOSAL_SCHEMA, { maxTokens: THINK_TOKENS, timeoutMs: 180000, temperature: 0.8 });
      run = thought.run;
      const idea = thought.answer;
      const title = String(idea?.title ?? '').trim().slice(0, TITLE_MAX);
      if (!title) throw new Error('the model proposed nothing');
      // A proposal with no checks to tell it is done is too vague to file.
      if (!Array.isArray(idea.done) || idea.done.filter((d) => String(d ?? '').trim()).length < 2) throw new Error(`“${title}” is too vague: no way to tell it is done`);
      const body = proposalBody(idea, `Proposed by ${w.name}, CTB (${this.model}). Label it “${LABELS.approved}” to start it (Approve on the admin page does that); close it to turn it down.`);
      if (!body) throw new Error('the model proposed nothing');
      const made = await this.github.create({ title, body, labels: [LABELS.proposal] });
      this.log(`CTB: ${w.name} proposed #${made.number} “${title}”.`);
      run?.end({ ok: true, why: `Proposed #${made.number} “${title}”.`, url: made.url ?? '' });
      this.office?.say(w.k, `I have an idea: ${title}`);
      await this.refresh();
      return made;
    } catch (error) {
      this.log(`CTB: no proposal this time (${error.message}).`);
      run?.end({ ok: false, why: error.message });
      return null;
    } finally {
      this.proposing = false;
      this.tell(w, 'At their desk');
    }
  }

  // Players' ideas waiting for an answer, read one after another, the
  // oldest first, each by the next worker in turn (busy or not: reading one
  // takes a moment). One the model or GitHub fails on waits for next time.
  reviewWishes() {
    if (!this.wishes || this.reviewing || this.stopped || !this.settings.on || this.problem) return this.reviewing;
    this.reviewing = (async () => {
      const waiting = (await this.wishes.list()).filter((w) => w.state === 'waiting').sort((a, b) => a.at - b.at);
      for (const wish of waiting) {
        if (this.stopped || this.problem) break;
        const w = this.workers[this.reviewer++ % Math.max(1, this.settings.workers)];
        try {
          await this.reviewWish(w, wish);
        } catch (error) {
          this.log(`CTB: ${w.name} could not answer an idea yet (${error.message}).`);
          break;
        }
      }
    })()
      .catch((error) => this.log(`CTB: a mistake reading ideas: ${error.message}`))
      .finally(() => {
        this.reviewing = null;
      });
    return this.reviewing;
  }

  // Accepted ideas' news, from their issues: each that has got further since
  // is told to its player. Ideas done with (in the game, or not picked) are
  // not looked up again.
  async followWishes() {
    if (!this.wishes?.stage) return;
    try {
      const open = (await this.wishes.list()).filter((w) => w.state === 'accepted' && w.issue?.number && STAGE_STEP[w.stage ?? ''] < 5);
      if (!open.length) return;
      const issues = new Map((await this.github.requests()).map((i) => [i.number, i]));
      for (const wish of open) {
        const issue = issues.get(wish.issue.number);
        if (!issue) continue;
        const stage = stageOf(issue);
        if (!newsOf(wish.stage ?? '', stage)) continue;
        await this.wishes.stage(wish.id, stage);
        this.log(`CTB: a player's idea #${issue.number} is ${stage} now; they were told.`);
      }
    } catch (error) {
      this.log(`CTB: could not look up players' ideas (${error.message}).`);
    }
  }

  // One idea read by one worker: yes or no, said back to the player, and a
  // proposal filed for a yes.
  async reviewWish(w, wish) {
    const doing = w.doing;
    this.tell(w, 'Reading an idea from a player');
    let run = null;
    try {
      const features = await this.features();
      const thought = await this.think(w, { kind: 'idea', title: `An idea: ${String(wish.text).slice(0, 80)}` }, [
        { role: 'system', content: `You are ${STAFF[w.k].name}, a software engineer at CTB, which builds Kids World, a 3D block-building island game for kids (about 5 to 12) played together in the browser: cozy building and pets, and adventures too, with monsters to bop, hearts and potions, toy weapons and a dragon to tame. A child playing the game sent an idea for it. Decide whether CTB takes it on. Say yes to an idea that fits the game, is kind and fun for kids, and could be built — perhaps as a small first version of it. Read what the game has now first, all of it, and never tell the child the game has no such thing when it does; an idea that grows something the game has (more of it, stronger, for more animals) is a new idea, not one it has. Say no to one the game already has exactly so (and tell the child where to find it), one that is not about the game, one that is unkind, scary or not for kids, or one far too big to build. Then write to the child: one or two short, warm sentences in simple words, in the language the child wrote in, saying yes or no and why; never say when it will be ready, and do not promise it will be built exactly so. For a yes, also write the GitHub issue for the engineers, in English: one specific change, named in a short imperative title, a TL;DR of one or two sentences, what to change in at most three short sentences (naming what in the game it builds on, when it builds on something), and two to four short checks that tell it is done. ${SCORING} Score a no too. Answer as JSON: {"accept": true or false, "scoring": its score in parts, "reply": the words to the child, "title": "", "tldr": "", "what": "", "done": []} (the issue's parts empty for a no).` },
        { role: 'user', content: `What the game has now:\n${features}\n\nThe child's idea:\n${String(wish.text).slice(0, WISH_TEXT_MAX)}` },
      ], WISH_SCHEMA, { maxTokens: THINK_TOKENS, timeoutMs: 180000, temperature: 0.4 });
      run = thought.run;
      const answer = thought.answer;
      const reply = String(answer?.reply ?? '').replace(/\s+/gu, ' ').trim().slice(0, 300);
      if (!reply || typeof answer.accept !== 'boolean') throw new Error('the model gave no answer to say');
      let issue = null;
      if (answer.accept) {
        const title = String(answer.title ?? '').trim().slice(0, TITLE_MAX);
        // Credited to the player by the name they play under (never their
        // username, which they log in with), carried on to the pull request.
        const name = mdText(String(wish.name || '').trim() || 'a player');
        const body = proposalBody(answer, `💡 An idea from **${name}**, playing Kids World — thank you! Accepted by ${w.name}, CTB (${this.model}). Label it “${LABELS.approved}” to start it (Approve on the admin page does that); close it to turn it down.`, { request: true });
        if (!title || !body) throw new Error('the model said yes but wrote no issue');
        issue = await this.github.create({ title, body, labels: [LABELS.proposal, LABELS.request] });
        this.log(`CTB: ${w.name} took a player's idea as #${issue.number} “${title}”.`);
      } else {
        this.log(`CTB: ${w.name} turned down a player's idea.`);
      }
      const score = ideaScore(answer, true)?.score ?? null;
      await this.wishes.answer(wish.id, { state: answer.accept ? 'accepted' : 'declined', by: w.name, reply, score, ...(issue ? { issue: { number: issue.number, url: issue.url } } : {}) });
      run?.end({ ok: true, why: `${answer.accept ? `Accepted, as #${issue.number}` : 'Declined'} (score ${score ?? '?'}): “${reply}”`, url: issue?.url ?? '' });
      this.office?.say(w.k, answer.accept ? 'I just read a great idea from a player — we are taking it on!' : 'I just read an idea from a player and wrote back to them.');
      if (issue) await this.refresh();
    } catch (error) {
      run?.end({ ok: false, why: error.message });
      throw error;
    } finally {
      this.tell(w, doing);
    }
  }

  // What a worker says when a child talks to them on the island. A line with
  // Hangul in it (langOf) gets the same answer in Korean; the issue's number
  // and title stay as they are.
  answer(k, name, text) {
    const w = this.workers[k];
    const ko = langOf(text) === 'ko';
    const hi = ko ? `안녕 ${name}!` : `Hi ${name}!`;
    if (!this.settings.on) return `${hi} ${ko ? 'CTB는 지금 문을 닫았어요.' : 'CTB is closed right now.'}`;
    if (k >= this.settings.workers) return `${hi} ${ko ? '지금은 쉬는 중이에요.' : "I'm on a break."}`;
    if (/\b(who|what).*(ctb|you)\b|\bctb\b/i.test(text) && k === 0) return `${hi} ${ko ? '우리는 CTB예요. 키즈 월드를 더 좋게 만들어요: 버그를 고치고 이 게임에 새로운 것을 더해요!' : "We're CTB. We make Kids World better: we fix bugs and add new things to this game!"}`;
    if (w.issue) return ko ? `${hi} 지금 #${w.issue.number}번을 하고 있어요: ${w.issue.title}` : `${hi} I'm working on #${w.issue.number}: ${w.issue.title}`;
    const waiting = this.tasks.length;
    if (ko) return waiting ? `${hi} 지금은 다음 일을 기다리는 중이에요. 할 일 보드에 ${waiting}개 있어요!` : `${hi} 지금 할 일이 없어서 새로운 아이디어를 생각하고 있어요.`;
    return waiting ? `${hi} I'm between tasks. ${waiting} on the board!` : `${hi} No tasks right now, so I'm thinking up new ideas.`;
  }

  // A task from the admin page: a new issue on the board.
  async addTask(title, body) {
    const t = typeof title === 'string' ? title.trim() : '';
    if (!t || t.length > TITLE_MAX) throw new KeepError('bad-task', `A task needs a title, up to ${TITLE_MAX} characters.`);
    const b = typeof body === 'string' ? body.slice(0, BODY_MAX) : '';
    const made = await this.github.create({ title: t, body: b, labels: [LABELS.task] });
    this.log(`CTB: a new task #${made.number} “${t}”.`);
    await this.refresh();
    setTimeout(() => this.poll(), 200).unref?.();
    return made;
  }

  // A proposal labelled approved, which the next look at the board turns into a task.
  async approve(number) {
    await this.github.label(number, { add: [LABELS.approved] });
    this.log(`CTB: proposal #${number} approved.`);
    await this.refresh();
    setTimeout(() => this.poll(), 200).unref?.();
  }

  async reject(number) {
    await this.github.close(number, 'Not this time — closed from the admin page.');
    this.log(`CTB: proposal #${number} turned down.`);
    await this.refresh();
  }

  status() {
    return {
      repo: this.github.repo,
      problem: this.problem ?? '',
      model: this.model,
      workers: this.workers.slice(0, Math.max(this.settings.workers, this.workers.filter((w) => w.issue).length)).map((w) => ({ name: w.name, doing: w.doing, issue: issueBrief(w.issue), startedAt: w.startedAt, steps: [...w.steps].reverse(), done: w.done, stuck: w.stuck, last: w.last ?? null })),
      tasks: this.tasks.map((t) => ({ ...issueBrief(t), labels: t.labels })),
      proposals: this.proposals.map((p) => ({ ...issueBrief(p), body: p.body.slice(0, 2000) })),
      pulls: this.pulls,
      proposing: this.proposing,
      proposedAt: this.proposedAt,
      history: [...this.history].reverse(),
    };
  }

  async stop() {
    this.stopped = true;
    clearInterval(this.timer);
  }
}

// CTB as the admin page runs it: its settings, saved in ctb.json, and its
// island, workers and token tally. make* are for tests.
export class CtbControl {
  constructor({ dir, repoDir, llm, rooms = null, keeper = null, rtc = null, server = null, iceServers = [], friendModel = () => '', friendName = () => '', env = process.env, now = Date.now, github = null, makeOffice = null, git = undefined, log = (text) => console.log(text) }) {
    this.file = join(dir, SETTINGS_FILE);
    this.usage = new TokenUsage(join(dir, USAGE_FILE), now);
    this.islandFile = join(dir, ISLAND_FILE);
    this.stateFile = join(dir, STATE_FILE);
    this.workDir = join(dir, 'ctb-work');
    // Every talk of a worker with its model, for the admin page (ctb-runs.js).
    this.runs = new Runs({ dir, now, log });
    this.repoDir = repoDir;
    this.llm = llm;
    this.rooms = rooms;
    this.keeper = keeper;
    this.rtc = rtc;
    this.server = server;
    this.iceServers = iceServers;
    this.friendModel = friendModel;
    this.friendName = friendName;
    this.settings = defaultSettings(env);
    this.saved = false;
    this.github = github;
    this.makeOffice = makeOffice;
    this.git = git;
    this.log = log;
    this.company = null;
    this.office = null;
  }

  async start() {
    await this.usage.load();
    await this.runs.load().catch((error) => this.log(`CTB: its run logs could not be read (${error.message}).`));
    try {
      this.settings = changeSettings(this.settings, JSON.parse(await readFile(this.file, 'utf8')));
      this.saved = true;
    } catch (error) {
      if (error.code !== 'ENOENT') this.log(`CTB: its settings in ${this.file} could not be read (${error.message}); using the defaults.`);
    }
    if (!this.github) {
      const url = await sh('git', ['remote', 'get-url', 'origin'], { cwd: this.repoDir }).catch(() => '');
      this.github = new GitHub({ repo: repoOf(url) });
    }
    if (this.settings.on) await this.open();
    return this;
  }

  async open() {
    this.company = new Company({
      llm: this.llm,
      github: this.github,
      repoDir: this.repoDir,
      workDir: this.workDir,
      settings: this.settings,
      friendModel: this.friendModel,
      log: this.log,
      onUsage: (entries) => this.usage.add(entries),
      runs: this.runs,
      proposedAt: await this.readProposedAt(),
      onProposed: (at) => this.saveProposedAt(at),
      // Players' ideas, kept by the keeper, and its way to answer them.
      wishes: this.keeper ? { list: () => this.keeper.store.wishes(), answer: (id, a) => this.keeper.answerWish(id, a), stage: (id, s) => this.keeper.stageWish(id, s) } : null,
      ...(this.git ? { git: this.git } : {}),
    });
    if (this.rooms) {
      const { Office } = await import('./ctb-office.js');
      const make = this.makeOffice ?? ((opts) => new Office(opts));
      this.office = make({ rooms: this.rooms, file: this.islandFile, keeper: this.keeper, rtc: this.rtc, server: this.server, iceServers: this.iceServers, log: this.log, answer: (k, name, text) => this.company?.answer(k, name, text) ?? '', ignores: (name) => name === this.friendName(), ownerWho: await this.ownerWho() });
      await this.office.open(this.settings.workers);
      this.company.office = this.office;
      this.company.showScreens();
    }
    await this.company.start();
    // A new idea from a player is read at once, not at the next look at the board.
    this.onWish = () => this.company?.reviewWishes();
    this.keeper?.on?.('wish', this.onWish);
  }

  // The island's owner as their pages tell islands who they are (main.js
  // islandWho): a hash of their login's folder at the keeper, found by
  // their username. '' when there is no such login (or no keeper).
  async ownerWho() {
    const name = this.settings.owner;
    if (!name || !this.keeper?.store) return '';
    const key = usernameKey(name);
    const found = (await this.keeper.store.logins()).find((l) => usernameKey(l.login.username ?? '') === key);
    if (!found) {
      this.log(`CTB: there is no login "${name}" to own the island; nobody owns it.`);
      return '';
    }
    return islandWho(found.device);
  }

  async readProposedAt() {
    try {
      const at = JSON.parse(await readFile(this.stateFile, 'utf8'))?.proposedAt;
      return Number.isFinite(at) ? at : 0;
    } catch {
      return 0;
    }
  }

  async saveProposedAt(at) {
    try {
      await mkdir(dirname(this.stateFile), { recursive: true });
      await writeFile(`${this.stateFile}.tmp`, `${JSON.stringify({ proposedAt: at })}\n`);
      await rename(`${this.stateFile}.tmp`, this.stateFile);
    } catch (error) {
      this.log(`CTB: could not save when it last proposed (${error.message}).`);
    }
  }

  async close() {
    if (this.onWish) this.keeper?.off?.('wish', this.onWish);
    this.onWish = null;
    const c = this.company;
    this.company = null;
    await c?.stop();
    await this.office?.close();
    this.office = null;
  }

  async change(change) {
    const before = this.settings;
    const next = changeSettings(before, change);
    const tmp = `${this.file}.tmp`;
    await mkdir(dirname(tmp), { recursive: true });
    await writeFile(tmp, `${JSON.stringify(next, null, 2)}\n`);
    await rename(tmp, this.file);
    this.settings = next;
    this.saved = true;
    if (!next.on) await this.close();
    else if (!this.company) await this.open();
    else {
      this.company.settings = next;
      this.office?.staff(next.workers);
      if (next.model !== before.model) await this.company.check();
      if (next.owner !== before.owner) this.office?.setOwner(await this.ownerWho());
      this.company.poll();
    }
    return next;
  }

  async status() {
    return {
      settings: this.settings,
      saved: this.saved,
      running: Boolean(this.company),
      maxWorkers: MAX_WORKERS,
      models: await this.llm.models().catch(() => []),
      friendModel: this.friendModel(),
      island: this.office?.summary() ?? null,
      ...(this.company ? this.company.status() : { repo: this.github?.repo ?? '', problem: '', workers: [], tasks: [], proposals: [], pulls: [], history: [] }),
      usage: this.usage.summary(),
      // The newest run logs, of every worker.
      runs: this.runs.list().slice(0, RUNS_SHOWN),
      // Players' ideas lately, from the keeper, each with its answer.
      ideas: this.keeper?.store ? (await this.keeper.store.wishes()).slice(0, 30).map((w) => ({ at: w.at, name: w.name, username: w.username, text: w.text, state: w.state, by: w.by, reply: w.reply, score: w.score ?? null, stage: w.stage ?? '', issue: w.issue ?? null })) : [],
    };
  }

  // One run log whole ({ summary, events }), or as a plain-text transcript; null when there is none.
  async run(id, { text = false } = {}) {
    const run = await this.runs.read(id);
    return run && text ? transcript(run) : run;
  }

  // The admin page's actions; each needs CTB running.
  need() {
    if (!this.company) throw new KeepError('ctb-off', 'CTB is off.');
    if (this.company.problem) throw new KeepError('ctb-closed', `CTB is closed: ${this.company.problem}`);
    return this.company;
  }

  addTask(title, body) {
    return this.need().addTask(title, body);
  }

  approve(n) {
    return this.need().approve(n);
  }

  reject(n) {
    return this.need().reject(n);
  }

  async propose() {
    const made = await this.need().propose(this.company.workers[0]);
    if (!made) throw new KeepError('no-proposal', 'No proposal came: see the activity log.');
    return made;
  }

  async check() {
    if (this.company) {
      await this.company.check();
      this.company.poll();
    }
  }

  async stop() {
    await this.close();
    await this.usage.save();
  }
}
