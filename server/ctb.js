// CTB: a company of workers run by language models — the AI friend's, Z.ai's
// GLM models with the local Ollama as a standby (llm.js) — who do real work
// on this project. Their tasks are the project's GitHub issues labelled
// "ctb" (ctb-github.js), added on the admin page or on GitHub, or proposed by
// the workers themselves: a proposal is an issue first, and starts once it is
// labelled "ctb: approved" (Approve on the admin page does that). A worker free for a task takes
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
import { EventEmitter } from 'node:events';
import { mkdir, readFile, rename, rm, stat, symlink, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { langOf } from '../public/js/shared/words.js';
import { Agent, layoutOf, testEnv } from './ctb-agent.js';
import { GitHub, LABELS, repoOf } from './ctb-github.js';
import { MAX_WORKERS, STAFF, workerName } from './ctb-office.js';
import { TokenUsage } from './friend.js';
import { KeepError } from './keeper.js';

export const SETTINGS_FILE = 'ctb.json';
export const USAGE_FILE = 'ctb-usage.json';
export const ISLAND_FILE = 'ctb-island.json';
const POLL_MS = 2 * 60000;
// The full unit tests before a pull request (the end-to-end ones are left
// to the pre-push hook on main): how long they may take, and how many times
// a worker goes back to fix them.
const GATE_MS = 12 * 60000;
const GATE_ROUNDS = 2;
const GATE_STEPS = 20;
const MAX_PROPOSALS = 3;
const HISTORY = 80;
const STEPS_KEPT = 30;
const MODEL_NAME = /^[\w.:/-]{0,100}$/;
const TITLE_MAX = 200;
const BODY_MAX = 20000;

export function defaultSettings(env = process.env) {
  return { on: env.KIDS_WORLD_CTB !== 'off', workers: 2, propose: true, proposeHours: 6, model: '' };
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

// What a worker's proposal says, as the model answers it.
export const PROPOSAL_SCHEMA = {
  type: 'object',
  properties: { title: { type: 'string' }, tldr: { type: 'string' }, what: { type: 'string' }, done: { type: 'array', items: { type: 'string' } } },
  required: ['title', 'tldr', 'what', 'done'],
};
// How long each part of a proposal may be: issues are kept short.
const TLDR_MAX = 300;
const WHAT_MAX = 700;
const DONE_ITEMS = 4;
const DONE_MAX = 200;

// A proposal's issue, short and in the same shape every time: a TL;DR, what
// to change, and how to tell it is done, then who proposed it. '' when the
// model gave no TL;DR.
export function proposalBody(idea, footer) {
  const line = (v, max) => String(v ?? '').replace(/\s+/gu, ' ').trim().slice(0, max);
  const tldr = line(idea?.tldr, TLDR_MAX);
  if (!tldr) return '';
  const what = line(idea?.what, WHAT_MAX);
  const done = (Array.isArray(idea?.done) ? idea.done : []).map((d) => line(d, DONE_MAX).replace(/^[-*]\s*/, '')).filter(Boolean).slice(0, DONE_ITEMS);
  return [`## TL;DR\n\n${tldr}`, what ? `## What\n\n${what}` : '', done.length ? `## Done when\n\n${done.map((d) => `- ${d}`).join('\n')}` : '', `_${footer}_`].filter(Boolean).join('\n\n');
}

const issueBrief = (i) => (i ? { number: i.number, title: i.title, url: i.url } : null);

// A pull request's body: what was done, and that it closes the issue.
export function pullBody({ issue, summary, worker, model }) {
  return `${summary.trim() || 'Done as the issue asks.'}\n\nCloses #${issue.number}.\n\n— ${worker}, CTB (${model})`;
}

// The workers and their work. llm: what they think with (llm.js), its model
// picked by the settings or the AI friend's. office: the CTB island, or null.
export class Company extends EventEmitter {
  constructor({ llm, github, repoDir, workDir, office = null, settings, friendModel = () => '', log = (text) => console.log(text), now = Date.now, git = (args, opts) => sh('git', args, opts), node = process.execPath, onUsage = () => {} }) {
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
    this.proposedAt = 0;
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
    this.emit('change');
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
    try {
      await this.github.label(n, { add: [LABELS.working] });
      await this.github.comment(n, `${w.name} at CTB is on it, with ${model}.`);
      await this.checkout(dir, branch);
      this.llm.model = model;
      const agent = new Agent({
        llm: this.llm,
        root: dir,
        name: STAFF[w.k].name,
        task: issue,
        layout: await layoutOf(dir),
        node: this.node,
        onStep: (step, k) => this.step(w, step, k),
        onUsage: (entries) => this.onUsage(entries),
        stopped: () => this.stopped,
      });
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
        agent.messages.push({ role: 'user', content: `All the unit tests were run, and some fail. Fix them, then finish again.\n${failed.slice(-8000)}`, result: true });
        agent.maxSteps = agent.steps + GATE_STEPS;
        result = await agent.run();
      }
      if (!result.ok) throw Object.assign(new Error(result.why), { stuck: true, steps: result.steps });
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
      this.log(`CTB: ${w.name} could not finish #${n}: ${error.message.split('\n')[0]}`);
      this.tell(w, `Stuck on #${n}`, `I got stuck on #${n}. A grown-up will have a look.`);
      if (!this.stopped) {
        await this.github.label(n, { add: [LABELS.stuck], remove: [LABELS.working] }).catch(() => {});
        await this.github.comment(n, `${w.name} at CTB could not finish this${error.stuck ? '' : ' (something went wrong)'}:\n\n${error.message}\n\nRemove the “${LABELS.stuck}” label to have the workers try again.`).catch(() => {});
      } else {
        await this.github.label(n, { remove: [LABELS.working] }).catch(() => {});
      }
    } finally {
      await this.cleanUp(dir, branch);
      w.issue = null;
      w.last = { issue: issueBrief(issue), at: this.now(), ...outcome };
      this.tell(w, 'At their desk');
      if (!this.stopped) setTimeout(() => this.poll(), 1000).unref?.();
    }
  }

  // A fresh worktree on the branch, from main as GitHub has it, with this
  // checkout's node_modules for the tests.
  checkout(dir, branch) {
    return this.serial(async () => {
      await this.removeWorktree(dir, branch);
      await mkdir(dirname(dir), { recursive: true });
      await this.git(['fetch', '--quiet', 'origin', 'main'], { cwd: this.repoDir });
      await this.git(['worktree', 'add', '--quiet', '-B', branch, dir, 'origin/main'], { cwd: this.repoDir });
      const modules = join(this.repoDir, 'node_modules');
      if (await stat(modules).catch(() => null)) await symlink(modules, join(dir, 'node_modules'), 'dir');
    });
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
    const status = (await this.git(['status', '--porcelain', '--untracked-files=all'], { cwd: dir })).split('\n').filter(Boolean);
    const paths = status.map((l) => l.slice(3).replace(/^.* -> /, '')).filter((p) => p !== 'node_modules' && !p.startsWith('node_modules/'));
    if (!paths.length) throw Object.assign(new Error('there was nothing to commit'), { stuck: true });
    await this.git(['add', '--', ...paths], { cwd: dir });
    const message = `${result.title}\n\n${result.summary.trim()}\n\nCloses #${issue.number}.`;
    // The message from a file beside the worktree, so it can be any length.
    const file = `${dir}.message`;
    await writeFile(file, message);
    try {
      await this.git(['-c', `user.name=${STAFF[w.k].name} (CTB)`, '-c', `user.email=${email}`, 'commit', '--quiet', '--no-verify', '-F', file], { cwd: dir });
    } finally {
      await rm(file, { force: true });
    }
    await this.git(['push', '--quiet', '--force', 'origin', `HEAD:refs/heads/${branch}`], { cwd: dir });
    return this.github.pullRequest({ branch, title: result.title, body: pullBody({ issue, summary: result.summary, worker: w.name, model }) });
  }

  // A worker's idea for the project, as an issue waiting for approval.
  async propose(w) {
    if (this.proposing) return null;
    this.proposing = true;
    this.proposedAt = this.now();
    this.tell(w, 'Thinking of something to propose');
    try {
      const readme = await readFile(join(this.repoDir, 'README.md'), 'utf8').catch(() => '');
      const features = /## What you can do\s*\n([\s\S]*?)\n## /.exec(readme)?.[1] ?? readme.slice(0, 6000);
      const recent = await this.git(['log', '--format=%s', '-n', '25', 'origin/main'], { cwd: this.repoDir }).catch(() => '');
      const open = [...this.tasks, ...this.proposals].map((i) => `#${i.number} ${i.title}`).join('\n') || '(none)';
      const trace = {};
      this.llm.model = this.model;
      const idea = await this.llm
        .chat(
          [
            { role: 'system', content: `You are ${STAFF[w.k].name}, a software engineer at CTB, which builds kids-world, a cozy 3D block-building island game for kids played together in the browser. Propose ONE small, concrete improvement a single engineer could make in a day: a bug fix, a polish of something that exists, or a small new thing kids would enjoy. Not something already done or already proposed. Be concise: plain words, no filler. Answer as JSON: {"title": a short imperative issue title, "tldr": one or two sentences saying what and why, "what": the change itself in at most three short sentences, "done": two to four short checks that tell it is done}.` },
            { role: 'user', content: `What the game has now:\n${features.slice(0, 12000)}\n\nRecent changes:\n${recent}\n\nOpen tasks and proposals:\n${open}` },
          ],
          PROPOSAL_SCHEMA,
          trace,
          { maxTokens: 2000, timeoutMs: 120000, temperature: 0.8 },
        )
        .finally(() => trace.usage?.length && this.onUsage(trace.usage));
      // The small local standby's ideas are not worth an issue: wait for Z.ai.
      if (this.llm.primary && this.llm.using !== this.llm.primary) throw new Error(`only the local standby (${this.llm.using?.model}) answered`);
      const title = String(idea?.title ?? '').trim().slice(0, TITLE_MAX);
      if (!title) throw new Error('the model proposed nothing');
      const body = proposalBody(idea, `Proposed by ${w.name}, CTB (${this.model}). Label it “${LABELS.approved}” to start it (Approve on the admin page does that); close it to turn it down.`);
      if (!body) throw new Error('the model proposed nothing');
      const made = await this.github.create({ title, body, labels: [LABELS.proposal] });
      this.log(`CTB: ${w.name} proposed #${made.number} “${title}”.`);
      this.office?.say(w.k, `I have an idea: ${title}`);
      await this.refresh();
      return made;
    } catch (error) {
      this.log(`CTB: no proposal this time (${error.message}).`);
      return null;
    } finally {
      this.proposing = false;
      this.tell(w, 'At their desk');
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
    this.workDir = join(dir, 'ctb-work');
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
      ...(this.git ? { git: this.git } : {}),
    });
    if (this.rooms) {
      const { Office } = await import('./ctb-office.js');
      const make = this.makeOffice ?? ((opts) => new Office(opts));
      this.office = make({ rooms: this.rooms, file: this.islandFile, keeper: this.keeper, rtc: this.rtc, server: this.server, iceServers: this.iceServers, log: this.log, answer: (k, name, text) => this.company?.answer(k, name, text) ?? '', ignores: (name) => name === this.friendName() });
      await this.office.open(this.settings.workers);
      this.company.office = this.office;
    }
    await this.company.start();
  }

  async close() {
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
    };
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
