// A CTB worker's hands (ctb.js): one task done on a copy of this project,
// a git worktree of its own, by a language model — one of Z.ai's GLM models
// (llm.js), with no local standby — that looks around, edits
// and runs tests one step at a time. Each step is one JSON answer naming a
// tool (JSON mode, as the AI friend answers, so even a model with no tool
// calling of its own can work): list, read, search, write, edit, test, diff,
// and done or give_up at the end. Every path stays inside the worktree, and
// the only command it can run is node's test runner on a test file there.
import { execFile } from 'node:child_process';
import { lstat, mkdir, readdir, readFile, realpath, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';

export const TOOLS = ['list', 'read', 'search', 'write', 'edit', 'test', 'diff', 'done', 'give_up'];

// The shape of every step.
export const STEP_SCHEMA = {
  type: 'object',
  properties: {
    thought: { type: 'string' },
    tool: { type: 'string', enum: TOOLS },
    path: { type: 'string' },
    from: { type: 'integer' },
    to: { type: 'integer' },
    query: { type: 'string' },
    content: { type: 'string' },
    old: { type: 'string' },
    new: { type: 'string' },
    title: { type: 'string' },
    summary: { type: 'string' },
  },
  required: ['thought', 'tool'],
};

// Steps for one task. A change across a few big files took a worker more
// than 60 just to read its way round them.
export const MAX_STEPS = 100;
// With nothing changed yet, the share of the steps after which a worker is
// told to make the change, and after which looking around (list, read,
// search) is refused until it does: told to, a worker still went on with
// "a few final reads" for twenty steps.
const NUDGE_AT = 0.4;
const LOOK_UNTIL = 0.6;
const LOOKING = new Set(['list', 'read', 'search']);
// The model's failures in a row (an empty answer now and then) a task survives.
const FAILURES = 5;
// How much of a tool's result the model sees, and how much of the older ones.
const RESULT_MAX = 12000;
const OLD_RESULT_MAX = 400;
// The newest results kept whole, up to this many characters in all (about
// 45,000 tokens); older ones are cut short, to keep the prompt a manageable
// size. Keeping only the newest ten whole, a worker on a change across a few
// big files forgot what it had read, read it again, and ran out of steps
// without one edit.
const KEEP_CHARS = 160000;
const READ_LINES = 300;
const SEARCH_HITS = 80;
const TEST_MS = 6 * 60000;
const SKIP = new Set(['.git', 'node_modules']);
// The model's answers: long enough for a file, given time to write it.
export const LLM_OPTS = { maxTokens: 16000, timeoutMs: 5 * 60000, temperature: 0.2 };

// The project's rules for whoever works on it, as the system prompt says them.
export function systemPrompt({ name, company = 'CTB', project = 'kids-world', layout = '' }) {
  return [
    `You are ${name}, a software engineer at ${company}, a company that builds ${project}: a 3D block-building island game for kids, played together in the browser, with pets and animals to ride and adventures with monsters to bop (three.js, plain ES modules, no build step; a Node server in server/; tests with node:test in test/).`,
    'You are given one task, a GitHub issue. Do it by changing the code in your working copy, then finish. You work one step at a time: every answer is one JSON object naming one tool and its arguments, with a short thought first.',
    'Tools:',
    '- list {path}: the files and folders in a folder ("" for the top).',
    `- read {path, from, to}: a file's lines, numbered (at most ${READ_LINES} at a time; from and to are 1-based line numbers).`,
    '- search {query, path}: lines containing the text query (exact, case-sensitive), in path or everywhere.',
    '- write {path, content}: a new file, or a whole file replaced. Prefer edit for existing files.',
    '- edit {path, old, new}: replace the text old, which must appear exactly once in the file (copy it exactly, with its indentation), with new.',
    '- test {path}: run one test file with node --test, such as test/school.test.js. Run the tests for what you changed, and add or update tests for new behaviour.',
    '- diff {}: what you have changed so far.',
    '- done {title, summary}: finished. title is the pull request title (short, imperative); summary says what you changed and how you tested it, in Markdown.',
    '- give_up {summary}: the task cannot be done (unclear, too big, or impossible); say why.',
    'What you read stays above, so read each part of a file once and go back to it there. Rules: read the code around a change before making it, and match its style, naming and comment density (comments in plain words saying what and why). Keep the change focused on the task. Never edit package-lock.json, public/vendor/ or public/keeper.json. If the change is visible to players, update README.md where it describes that part of the game. Do not finish before the tests you ran pass.',
    layout ? `The project's layout, from its README:\n${layout}` : '',
  ]
    .filter(Boolean)
    .join('\n');
}

// A path the model gave, inside the worktree (resolved through symlinks
// that already exist), or an Error saying why not.
export async function inside(root, path) {
  const rel = String(path ?? '').trim().replace(/^(\.\/)+/, '');
  if (isAbsolute(rel) || rel.split(/[\\/]/).includes('..')) return new Error(`${path} is not a path inside the project.`);
  if (rel.split(/[\\/]/)[0] === '.git') return new Error('.git is off limits.');
  const full = resolve(root, rel);
  const realRoot = await realpath(root);
  // The deepest part of the path that exists, resolved, must stay inside.
  let probe = full;
  for (;;) {
    try {
      const real = await realpath(probe);
      if (real !== realRoot && !real.startsWith(realRoot + sep)) return new Error(`${path} leads outside the project.`);
      break;
    } catch {
      const up = dirname(probe);
      if (up === probe) break;
      probe = up;
    }
  }
  return full;
}

function run(file, args, { cwd, timeout = 60000, env = process.env } = {}) {
  return new Promise((done) => {
    execFile(file, args, { cwd, timeout, env, maxBuffer: 32 * 1024 * 1024 }, (error, stdout, stderr) => {
      done({ code: error ? (typeof error.code === 'number' ? error.code : 1) : 0, out: `${stdout}${stderr}`, killed: Boolean(error?.killed) });
    });
  });
}

// The environment for running tests: as this process's, but never as a
// test runner's child (NODE_TEST_CONTEXT), which would report to a parent
// that is not there and exit 0 whatever the tests do.
export function testEnv(env = process.env) {
  const { NODE_TEST_CONTEXT, ...rest } = env;
  return { ...rest, CI: '1' };
}

const cut = (text, max) => (text.length <= max ? text : `${text.slice(0, max)}\n… (${text.length - max} more characters cut)`);
// The end of a long output, where test failures and totals are.
const tail = (text, max) => (text.length <= max ? text : `… (${text.length - max} characters cut)\n${text.slice(-max)}`);

// One task, worked through: run() resolves to { ok, title, summary, steps }
// (ok false with why on giving up, running out of steps, or the model
// failing). onStep is told of each step, for the island and the admin page.
export class Agent {
  constructor({ llm, root, name, task, layout = '', maxSteps = MAX_STEPS, onStep = () => {}, onUsage = () => {}, node = process.execPath, stopped = () => false }) {
    this.llm = llm;
    this.root = root;
    this.name = name;
    this.task = task;
    this.maxSteps = maxSteps;
    this.onStep = onStep;
    this.onUsage = onUsage;
    this.node = node;
    this.stopped = stopped;
    this.messages = [
      { role: 'system', content: systemPrompt({ name, layout }) },
      { role: 'user', content: `Your task, GitHub issue #${task.number}: ${task.title}\n\n${task.body || '(no description)'}` },
    ];
    this.steps = 0;
    this.changed = new Set();
    // Reads whose lines are still in view: { path, start, end, step, message }.
    this.reads = [];
  }

  // The model's next step, the tokens it took counted.
  async next() {
    const trace = {};
    try {
      const messages = this.messages.map(({ role, content }) => ({ role, content }));
      return await this.llm.chat(messages, STEP_SCHEMA, trace, LLM_OPTS);
    } finally {
      if (trace.usage?.length) this.onUsage(trace.usage);
    }
  }

  // Older results cut short, so the prompt stays a manageable size.
  shorten() {
    let kept = 0;
    for (const m of this.messages.filter((m) => m.role === 'user' && m.result).reverse()) {
      kept += m.content.length;
      if (kept > KEEP_CHARS && m.content.length > OLD_RESULT_MAX && !m.cut) {
        m.content = `${m.content.slice(0, OLD_RESULT_MAX)}\n… (older result cut short; read it again if you need it)`;
        m.cut = true;
      }
    }
  }

  // A read of lines still in view, whole, from an earlier read (and the file
  // not changed since): which step that was, or 0.
  seenAt(path, from, to) {
    const want = this.span(path, from, to);
    return this.reads.find((r) => !r.message.cut && r.path === want.path && r.start <= want.start && r.end >= want.end)?.step ?? 0;
  }

  // The file and lines a read asks for, as read() takes them (the end
  // unknown until it is read: what it asks for at most).
  span(path, from, to) {
    const rel = String(path ?? '').trim().replace(/^(\.\/)+/, '');
    const start = Math.max(1, Number.isInteger(from) ? from : 1);
    return { path: rel, start, end: Math.min(Number.isInteger(to) && to >= start ? to : start + READ_LINES - 1, start + READ_LINES - 1) };
  }

  // What a result says after it: the step, and a push to get on with it
  // once NUDGE_AT of the steps are gone with nothing changed, or to finish
  // near the end.
  footer() {
    const left = this.maxSteps - this.steps;
    if (left <= 5) return `\n(Step ${this.steps} of ${this.maxSteps}: ${left} left. Finish now with done, or give_up and say why.)`;
    if (!this.changed.size && this.steps >= this.maxSteps * NUDGE_AT) return `\n(Step ${this.steps} of ${this.maxSteps}, and nothing changed yet: stop looking around and make the change now, a small first version if need be.)`;
    return `\n(Step ${this.steps} of ${this.maxSteps}.)`;
  }

  async run() {
    let failures = 0;
    while (this.steps < this.maxSteps) {
      if (this.stopped()) return { ok: false, why: 'stopped', steps: this.steps };
      let step;
      try {
        step = await this.next();
      } catch (error) {
        if (++failures >= FAILURES) return { ok: false, why: `the model failed: ${error.message}`, steps: this.steps };
        continue;
      }
      failures = 0;
      this.steps++;
      if (!step || typeof step !== 'object' || !TOOLS.includes(step.tool)) {
        this.messages.push({ role: 'assistant', content: JSON.stringify(step ?? null) }, { role: 'user', content: `That is not a step: answer with one JSON object whose tool is one of ${TOOLS.join(', ')}.`, result: true });
        continue;
      }
      this.messages.push({ role: 'assistant', content: JSON.stringify(step) });
      this.onStep(step, this.steps);
      if (step.tool === 'done') {
        if (!this.changed.size) {
          this.messages.push({ role: 'user', content: 'You have changed nothing yet. Make the change first, or give_up if it cannot be done.', result: true });
          continue;
        }
        return { ok: true, title: String(step.title || this.task.title).slice(0, 120), summary: String(step.summary || ''), steps: this.steps, changed: [...this.changed] };
      }
      if (step.tool === 'give_up') return { ok: false, why: String(step.summary || 'gave up'), steps: this.steps };
      let result;
      const seen = step.tool === 'read' ? this.seenAt(step.path, step.from, step.to) : 0;
      const enough = LOOKING.has(step.tool) && !this.changed.size && this.steps > this.maxSteps * LOOK_UNTIL;
      try {
        if (enough) result = 'No more looking around until you have changed something: you have read enough. Make the change now with edit or write, a small first version if need be, from what is above; or give_up and say why.';
        else if (seen) result = `You read these lines at step ${seen}, and they are still above, whole and unchanged: use them there instead of reading them again.`;
        else result = await this.use(step);
      } catch (error) {
        result = `Error: ${error.message}`;
      }
      const message = { role: 'user', content: `Result of ${step.tool}:\n${cut(result, RESULT_MAX)}${this.footer()}`, result: true };
      this.messages.push(message);
      if (['write', 'edit'].includes(step.tool)) {
        const rel = this.span(step.path).path;
        this.reads = this.reads.filter((r) => r.path !== rel);
      }
      // Lines read up to the file's end cover any read further down it too.
      const lines = !seen && !enough && step.tool === 'read' && /^.* \(lines (\d+)-(\d+) of (\d+)\)\n/.exec(result);
      if (lines && result.length <= RESULT_MAX) this.reads.push({ ...this.span(step.path), start: Number(lines[1]), end: lines[2] === lines[3] ? Infinity : Number(lines[2]), step: this.steps, message });
      this.shorten();
    }
    return { ok: false, why: `ran out of steps (${this.maxSteps})`, steps: this.steps };
  }

  // What a tool gives back, in words for the model.
  async use(step) {
    switch (step.tool) {
      case 'list':
        return this.list(step.path);
      case 'read':
        return this.read(step.path, step.from, step.to);
      case 'search':
        return this.search(step.query, step.path);
      case 'write':
        return this.write(step.path, step.content);
      case 'edit':
        return this.edit(step.path, step.old, step.new);
      case 'test':
        return this.test(step.path);
      case 'diff':
        return this.diff();
    }
    return 'Unknown tool.';
  }

  async file(path) {
    const full = await inside(this.root, path);
    if (full instanceof Error) throw full;
    return full;
  }

  async list(path = '') {
    const full = await this.file(path || '.');
    const entries = await readdir(full, { withFileTypes: true });
    const names = entries.filter((e) => !SKIP.has(e.name)).map((e) => (e.isDirectory() ? `${e.name}/` : e.name));
    return names.sort().join('\n') || '(empty)';
  }

  async read(path, from, to) {
    const lines = (await readFile(await this.file(path), 'utf8')).split('\n');
    const start = Math.max(1, Number.isInteger(from) ? from : 1);
    const end = Math.min(lines.length, Number.isInteger(to) && to >= start ? to : start + READ_LINES - 1, start + READ_LINES - 1);
    const out = lines.slice(start - 1, end).map((line, k) => `${start + k}\t${line}`);
    return `${path} (lines ${start}-${end} of ${lines.length})\n${out.join('\n')}`;
  }

  async search(query, path = '') {
    if (!query) return 'Error: search needs a query.';
    const where = path ? await this.file(path) : this.root;
    const { out } = await run('git', ['grep', '-n', '-I', '-F', '--untracked', '-e', query, '--', relative(this.root, where) || '.'], { cwd: this.root });
    const hits = out.split('\n').filter(Boolean);
    if (!hits.length) return 'No matches.';
    return `${hits.slice(0, SEARCH_HITS).map((l) => cut(l, 300)).join('\n')}${hits.length > SEARCH_HITS ? `\n… and ${hits.length - SEARCH_HITS} more matches` : ''}`;
  }

  async write(path, content) {
    if (typeof content !== 'string') return 'Error: write needs content.';
    const full = await this.file(path);
    if (/(^|\/)(package-lock\.json|public\/vendor\/|public\/keeper\.json)/.test(relative(this.root, full))) return 'Error: that file is not to be changed.';
    await mkdir(dirname(full), { recursive: true });
    const old = await lstat(full).catch(() => null);
    if (old?.isSymbolicLink()) return 'Error: that is a symbolic link.';
    await writeFile(full, content);
    this.changed.add(relative(this.root, full));
    return `Wrote ${path} (${content.split('\n').length} lines).`;
  }

  async edit(path, old, now) {
    if (typeof old !== 'string' || !old || typeof now !== 'string') return 'Error: edit needs old (not empty) and new.';
    const full = await this.file(path);
    if (/(^|\/)(package-lock\.json|public\/vendor\/|public\/keeper\.json)/.test(relative(this.root, full))) return 'Error: that file is not to be changed.';
    const text = await readFile(full, 'utf8');
    const at = text.indexOf(old);
    if (at < 0) return 'Error: old is not in the file. Read the file again and copy the text exactly.';
    if (text.indexOf(old, at + 1) >= 0) return 'Error: old appears more than once. Include more of the lines around it.';
    await writeFile(full, text.slice(0, at) + now + text.slice(at + old.length));
    this.changed.add(relative(this.root, full));
    const line = text.slice(0, at).split('\n').length;
    return `Edited ${path} at line ${line}.`;
  }

  async test(path) {
    const full = await this.file(path);
    const rel = relative(this.root, full);
    if (!/^test\/[\w.-]+\.test\.js$/.test(rel.split(sep).join('/'))) return 'Error: test runs one file in test/, named *.test.js.';
    const { code, out, killed } = await run(this.node, ['--test', '--test-force-exit', '--test-timeout=180000', rel], { cwd: this.root, timeout: TEST_MS, env: testEnv() });
    return `${killed ? 'Timed out. ' : ''}${code === 0 ? 'PASSED' : 'FAILED'} (exit ${code})\n${tail(out, RESULT_MAX - 200)}`;
  }

  async diff() {
    const { out } = await run('git', ['diff', '--stat'], { cwd: this.root });
    const { out: full } = await run('git', ['diff'], { cwd: this.root });
    const { out: added } = await run('git', ['ls-files', '--others', '--exclude-standard'], { cwd: this.root });
    const said = `${out}${added.trim() ? `New files:\n${added}` : ''}\n${full}`;
    return said.trim() ? said : 'No changes.';
  }
}

// What the README says the project's files are, for the system prompt.
export async function layoutOf(root) {
  try {
    const text = await readFile(join(root, 'README.md'), 'utf8');
    const m = /## Project layout\s*\n+```\n([\s\S]*?)```/.exec(text);
    return m ? m[1].trim() : '';
  } catch {
    return '';
  }
}
