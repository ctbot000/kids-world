// CTB: a company whose workers, run by the AI friend's models, do real work
// on this project. A worker's agent reads, edits and tests inside its own
// worktree and nowhere else; a task (a GitHub issue labelled "ctb") becomes a
// branch, a commit and a pull request once all the unit tests pass, or the
// issue is marked stuck with why; with nothing to do a worker proposes a
// task, which the admin page approves or turns down. The workers sit at
// their desks in the office on the CTB island, and answer children who talk
// to them. GitHub and the model are stand-ins here; git is real, on
// repositories made for each test.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { appendFile, mkdir, mkdtemp, readFile, rm, stat, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, test } from 'node:test';
import * as B from '../public/js/shared/blocks.js';
import { cleanListing } from '../public/js/shared/listing.js';
import { PROTOCOL } from '../public/js/shared/room.js';
import { placeTemplate } from '../public/js/shared/stamps.js';
import { World } from '../public/js/shared/world.js';
import { adminHandler } from '../server/admin.js';
import { Agent, inside, layoutOf, STEP_SCHEMA } from '../server/ctb-agent.js';
import { LABELS, repoOf } from '../server/ctb-github.js';
import { deskSpots, GROUNDS, GUIDE, ISLAND_NAME, Office, OFFICE_VERSION, officeCells, workerName } from '../server/ctb-office.js';
import { RUNS_DIR, Runs, transcript } from '../server/ctb-runs.js';
import { changeSettings, Company, CtbControl, defaultSettings, islandWho, proposalBody, pullBody } from '../server/ctb.js';
import { KeeperStore } from '../server/keeper.js';
import { createGameServer } from '../server/server.js';

const dirs = [];
async function tempDir() {
  const dir = await mkdtemp(join(tmpdir(), 'kids-world-ctb-'));
  dirs.push(dir);
  return dir;
}
after(() => Promise.all(dirs.map((dir) => rm(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 }))));

const git = (cwd, ...args) => execFileSync('git', args, { cwd, encoding: 'utf8', env: { ...process.env, GIT_AUTHOR_NAME: 'T', GIT_AUTHOR_EMAIL: 't@example.com', GIT_COMMITTER_NAME: 'T', GIT_COMMITTER_EMAIL: 't@example.com' } }).trim();

// A project with a passing test, pushed to a bare "origin", and a checkout of it.
async function project() {
  const dir = await tempDir();
  const origin = join(dir, 'origin.git');
  const repo = join(dir, 'repo');
  git(dir, 'init', '--quiet', '--bare', '-b', 'main', origin);
  git(dir, 'init', '--quiet', '-b', 'main', repo);
  git(repo, 'config', 'user.email', 'ctb@example.com');
  git(repo, 'config', 'user.name', 'Repo');
  await mkdir(join(repo, 'test'));
  await writeFile(join(repo, 'README.md'), '# Toy\n\n## Project layout\n\n```\nadd.js   adds\n```\n');
  await writeFile(join(repo, 'add.js'), 'export const add = (a, b) => a - b;\n');
  await writeFile(join(repo, 'test/add.test.js'), "import assert from 'node:assert/strict';\nimport { test } from 'node:test';\nimport { add } from '../add.js';\ntest('adds', () => assert.equal(add(2, 2), 4));\n");
  git(repo, 'add', '.');
  git(repo, 'commit', '--quiet', '-m', 'start');
  git(repo, 'remote', 'add', 'origin', origin);
  git(repo, 'push', '--quiet', 'origin', 'main');
  return { dir, origin, repo };
}

// A model that takes its steps from a list, then gives up; it remembers what it was sent.
function scripted(steps) {
  const sent = [];
  return {
    model: 'stand-in',
    sent,
    problem: async () => '',
    models: async () => ['stand-in', 'other'],
    chat: async (messages, schema, trace) => {
      sent.push({ messages: structuredClone(messages), schema });
      if (trace) trace.usage = [{ name: 'Z.ai', model: 'stand-in', promptTokens: 10, tokens: 5 }];
      const next = typeof steps === 'function' ? steps(messages) : steps.shift();
      return next ?? { thought: 'out of ideas', tool: 'give_up', summary: 'nothing left to try' };
    },
  };
}

// GitHub as the workers see it, in memory.
function hub(issues = []) {
  const made = [];
  const comments = [];
  const pulls = [];
  let next = 100;
  const gh = {
    repo: 'ctbot000/toy',
    me: 'ctbot000',
    issues,
    made,
    comments,
    pullsMade: pulls,
    problem: async () => '',
    tasks: async () => issues.filter((i) => i.open && i.labels.includes(LABELS.task) && i.author === 'ctbot000'),
    proposals: async () => issues.filter((i) => i.open && i.labels.includes(LABELS.proposal)),
    create: async ({ title, body, labels }) => {
      const issue = { number: ++next, title, body, labels: [...labels], author: 'ctbot000', open: true, url: `https://github.com/ctbot000/toy/issues/${next}` };
      issues.push(issue);
      made.push(issue);
      return { number: issue.number, url: issue.url };
    },
    label: async (n, { add = [], remove = [] }) => {
      const i = issues.find((x) => x.number === n);
      i.labels = [...new Set([...i.labels.filter((l) => !remove.includes(l)), ...add])];
    },
    comment: async (n, body) => comments.push({ n, body }),
    close: async (n) => {
      issues.find((x) => x.number === n).open = false;
    },
    pullRequest: async (pr) => {
      pulls.push(pr);
      return `https://github.com/ctbot000/toy/pull/${pulls.length + 500}`;
    },
    pulls: async () => [],
  };
  return gh;
}

const issue = (number, title, body = '', labels = [LABELS.task], author = 'ctbot000') => ({ number, title, body, labels, author, open: true, url: `https://github.com/ctbot000/toy/issues/${number}` });

async function eventually(fn, timeout = 60000) {
  const end = Date.now() + timeout;
  for (;;) {
    const value = await fn();
    if (value) return value;
    if (Date.now() > end) throw new Error(`timed out waiting for ${fn}`);
    await new Promise((done) => setTimeout(done, 50));
  }
}

test('the agent works only inside its worktree: reading, searching, editing and testing there', async () => {
  const { dir, repo } = await project();
  await writeFile(join(dir, 'secret.txt'), 'not yours');
  await symlink(dir, join(repo, 'escape'));
  for (const bad of ['../secret.txt', '/etc/passwd', 'escape/secret.txt', '.git/config']) assert.ok((await inside(repo, bad)) instanceof Error, bad);
  assert.equal(await inside(repo, 'add.js'), join(repo, 'add.js'));
  assert.equal(await inside(repo, './new/file.js'), join(repo, 'new/file.js'));

  const llm = scripted([
    { thought: 'look', tool: 'list', path: '' },
    { thought: 'escape', tool: 'read', path: '../secret.txt' },
    { thought: 'find it', tool: 'search', query: 'a - b' },
    { thought: 'read it', tool: 'read', path: 'add.js', from: 1, to: 5 },
    { thought: 'not done yet', tool: 'done', title: 'x', summary: 'x' },
    { thought: 'a shell', tool: 'test', path: 'add.js' },
    { thought: 'wrong text', tool: 'edit', path: 'add.js', old: 'a * b', new: 'a + b' },
    { thought: 'fix', tool: 'edit', path: 'add.js', old: 'a - b', new: 'a + b' },
    { thought: 'vendor', tool: 'write', path: 'public/vendor/three.js', content: 'x' },
    { thought: 'test', tool: 'test', path: 'test/add.test.js' },
    { thought: 'look over', tool: 'diff' },
    { thought: 'done', tool: 'done', title: 'Make add add', summary: 'It added wrongly.' },
  ]);
  const steps = [];
  const usage = [];
  const agent = new Agent({ llm, root: repo, layout: await layoutOf(repo), name: 'Ada', task: { number: 7, title: 'add subtracts', body: 'Fix it.' }, onStep: (s) => steps.push(s.tool), onUsage: (u) => usage.push(...u) });
  const result = await agent.run();
  assert.equal(result.ok, true);
  assert.equal(result.title, 'Make add add');
  assert.deepEqual(result.changed, ['add.js']);
  assert.equal(await readFile(join(repo, 'add.js'), 'utf8'), 'export const add = (a, b) => a + b;\n');
  assert.equal(usage.length, 12, 'every answer counted');
  const results = llm.sent.at(-1).messages.filter((m) => m.role === 'user').map((m) => m.content);
  assert.match(llm.sent[0].messages[0].content, /You are Ada, a software engineer at CTB/);
  assert.match(llm.sent[0].messages[0].content, /add\.js {3}adds/, 'the README’s layout');
  assert.match(llm.sent[0].messages[1].content, /issue #7: add subtracts\n\nFix it\./);
  assert.deepEqual(llm.sent[0].schema, STEP_SCHEMA);
  assert.ok(llm.sent.every((s) => s.messages.every((m) => Object.keys(m).sort().join() === 'content,role')), 'only role and content go to the model');
  assert.ok(results.some((r) => /^Result of read:\nError: \.\.\/secret\.txt is not a path inside/.test(r)));
  assert.ok(results.some((r) => /add\.js:1:export const add/.test(r)), 'search found it');
  assert.ok(results.some((r) => /You have changed nothing yet/.test(r)));
  assert.ok(results.some((r) => /test runs one file in test\//.test(r)));
  assert.ok(results.some((r) => /old is not in the file/.test(r)));
  assert.ok(results.some((r) => /that file is not to be changed/.test(r)));
  assert.ok(results.some((r) => /Result of test:\nPASSED/.test(r)));
  assert.ok(results.some((r) => /-export const add = \(a, b\) => a - b;/.test(r)), 'the diff');
});

test('the agent keeps what it read in view, says so when asked again, and is pushed to make the change', async () => {
  const { repo } = await project();
  const read = { thought: 'read it', tool: 'read', path: 'add.js', from: 1, to: 5 };
  const llm = scripted([
    read,
    ...Array.from({ length: 10 }, (_, k) => ({ thought: `look ${k}`, tool: 'list', path: '' })),
    { ...read, thought: 'again' },
    { thought: 'fix', tool: 'edit', path: 'add.js', old: 'a - b', new: 'a + b' },
    { ...read, thought: 'after the edit' },
    { thought: 'more', tool: 'list', path: '' },
  ]);
  const task = { number: 7, title: 'add subtracts', body: 'Fix it.' };
  const agent = new Agent({ llm, root: repo, name: 'Ada', task, maxSteps: 30 });
  const result = await agent.run();
  assert.equal(result.ok, false);
  const results = agent.messages.filter((m) => m.role === 'user' && m.result).map((m) => m.content);
  assert.match(results[0], /export const add/, 'kept whole past ten newer results');
  assert.match(results[0], /\(Step 1 of 30\.\)$/);
  assert.match(results[10], /\(Step 11 of 30\.\)$/);
  assert.match(results[11], /You read these lines at step 1, and they are still above/);
  assert.match(results[11], /Step 12 of 30, and nothing changed yet: stop looking around and make the change now/);
  assert.match(results[13], /^Result of read:\nadd\.js \(lines 1-2 of 2\)\n1\texport const add = \(a, b\) => a \+ b;/, 'read again once the file changed');
  assert.match(results[14], /\(Step 15 of 30\.\)$/, 'no push once something changed');

  // Still only looking past most of its steps: refused, and told to finish near the end.
  const idle = new Agent({ llm: scripted(Array.from({ length: 8 }, () => ({ thought: 'look', tool: 'list', path: '' }))), root: repo, name: 'Ada', task, maxSteps: 10 });
  await idle.run();
  const said = idle.messages.filter((m) => m.role === 'user' && m.result).map((m) => m.content);
  assert.match(said[5], /^Result of list:\nREADME\.md/);
  assert.match(said[6], /^Result of list:\nNo more looking around until you have changed something/);
  assert.match(said[6], /Step 7 of 10: 3 left\. Finish with done if the change is whole and its tests pass; if not, use them on it: what you have changed is kept/);
});

test('a task becomes a branch, a commit and a pull request once all the unit tests pass', async () => {
  const { dir, origin, repo } = await project();
  const github = hub([issue(5, 'add subtracts', 'It should add.'), issue(6, 'by someone else', '', [LABELS.task], 'stranger')]);
  const llm = scripted([
    { thought: 'fix', tool: 'edit', path: 'add.js', old: 'a - b', new: 'a + b' },
    { thought: 'test', tool: 'test', path: 'test/add.test.js' },
    { thought: 'done', tool: 'done', title: 'Make add add', summary: 'add() subtracted; now it adds. Ran test/add.test.js.' },
  ]);
  const usage = [];
  const said = [];
  const company = new Company({ llm, github, repoDir: repo, workDir: join(dir, 'work'), settings: { ...defaultSettings({}), workers: 1, propose: false }, log: () => {}, onUsage: (u) => usage.push(...u), office: { say: (k, text) => said.push([k, text]), emote: () => {} } });
  await company.start();
  after(() => company.stop());
  await eventually(() => github.pullsMade.length === 1 && !company.workers[0].issue);

  const pr = github.pullsMade[0];
  assert.equal(pr.branch, 'ctb/issue-5');
  assert.equal(pr.title, 'Make add add');
  assert.equal(pr.body, pullBody({ issue: { number: 5 }, summary: 'add() subtracted; now it adds. Ran test/add.test.js.', worker: workerName(0), model: 'stand-in' }));
  assert.match(pr.body, /Closes #5\./);
  assert.deepEqual(github.issues[0].labels, [LABELS.task, LABELS.pr]);
  assert.deepEqual(github.issues[1].labels, [LABELS.task], 'a stranger’s issue is no task');
  assert.match(github.comments[0].body, /Ada 💼 at CTB is on it, with stand-in/);
  assert.match(github.comments[1].body, /opened https:\/\/github\.com\/ctbot000\/toy\/pull\/501/);
  // The branch on origin: one commit by the worker, closing the issue, main untouched.
  assert.equal(git(origin, 'log', '-1', '--format=%an <%ae>|%s|%b', 'ctb/issue-5'), 'Ada (CTB) <ctb@example.com>|Make add add|add() subtracted; now it adds. Ran test/add.test.js.\n\nCloses #5.');
  assert.equal(git(origin, 'show', 'ctb/issue-5:add.js'), 'export const add = (a, b) => a + b;');
  assert.equal(git(origin, 'show', 'main:add.js'), 'export const add = (a, b) => a - b;');
  assert.equal(git(origin, 'diff', '--name-only', 'main', 'ctb/issue-5'), 'add.js', 'node_modules and nothing else left out');
  // The worktree and the local branch are gone; the checkout is as it was.
  assert.equal(await stat(join(dir, 'work', 'issue-5')).catch(() => null), null);
  assert.equal(git(repo, 'branch', '--list', 'ctb/*'), '');
  assert.equal(git(repo, 'status', '--porcelain'), '');
  assert.equal(git(repo, 'worktree', 'list').split('\n').length, 1);
  assert.ok(usage.length >= 3);
  assert.ok(said.some(([k, t]) => k === 0 && t === 'On it: #5 add subtracts'));
  assert.ok(said.some(([k, t]) => k === 0 && /^Done! A pull request for #5/.test(t)));
  const status = company.status();
  assert.equal(status.workers[0].done, 1);
  assert.equal(status.workers[0].last.url, 'https://github.com/ctbot000/toy/pull/501');
  assert.ok(status.workers[0].steps.some((s) => s.what === 'editing add.js'));
});

test('failing unit tests go back to the worker, and a task it cannot finish is marked stuck with why', async () => {
  const { dir, repo } = await project();
  const github = hub([issue(8, 'add a multiply', ''), issue(9, 'impossible', '')]);
  let round = 0;
  // Issue 8: it finishes without fixing add, the gate fails, then it fixes add.
  // Issue 9: it gives up.
  const llm = scripted((messages) => {
    const task = messages[1].content;
    if (task.includes('#9')) return { thought: 'no', tool: 'give_up', summary: 'This cannot be done.' };
    round++;
    if (round === 1) return { thought: 'add mul', tool: 'write', path: 'mul.js', content: 'export const mul = (a, b) => a * b;\n' };
    if (round === 2) return { thought: 'done', tool: 'done', title: 'Add mul', summary: 'mul.' };
    if (round === 3) {
      assert.match(messages.at(-1).content, /All the unit tests were run, and some fail/);
      return { thought: 'fix add', tool: 'edit', path: 'add.js', old: 'a - b', new: 'a + b' };
    }
    return { thought: 'done', tool: 'done', title: 'Add mul', summary: 'mul, and add fixed.' };
  });
  const company = new Company({ llm, github, repoDir: repo, workDir: join(dir, 'work'), settings: { ...defaultSettings({}), workers: 2, propose: false }, log: () => {} });
  await company.start();
  after(() => company.stop());
  await eventually(() => github.issues.every((i) => i.labels.includes(LABELS.pr) || i.labels.includes(LABELS.stuck)) && company.workers.every((w) => !w.issue));
  assert.deepEqual(github.issues[0].labels, [LABELS.task, LABELS.pr]);
  assert.deepEqual(github.issues[1].labels, [LABELS.task, LABELS.stuck]);
  assert.ok(github.comments.some((c) => c.n === 9 && /could not finish this:\n\nThis cannot be done\./.test(c.body)));
  assert.equal(github.pullsMade.length, 1);
  assert.equal(round, 4);
  // A stuck task is not taken again until the label comes off.
  await company.poll();
  assert.equal(company.workers.filter((w) => w.issue).length, 0);
});

test('a task not finished keeps its work on its branch, the next try carries on from it, and each try is a run log', async () => {
  const { dir, origin, repo } = await project();
  const github = hub([issue(12, 'add a multiply', 'And fix add.')]);
  const tries = [];
  const llm = scripted((messages) => {
    const task = messages[1].content;
    const again = task.includes('An earlier try at this did not finish');
    const n = messages.filter((m) => m.role === 'assistant').length;
    if (n === 0) tries.push(task);
    if (!again) return n === 0 ? { thought: 'mul first', tool: 'write', path: 'mul.js', content: 'export const mul = (a, b) => a * b;\n' } : { thought: 'out of time', tool: 'give_up', summary: 'mul.js is written; add is still to fix.' };
    if (n === 0) return { thought: 'fix add', tool: 'edit', path: 'add.js', old: 'a - b', new: 'a + b' };
    if (n === 1) return { thought: 'look over', tool: 'diff' };
    return { thought: 'done', tool: 'done', title: 'Add mul and fix add', summary: 'Both.' };
  });
  const runs = await new Runs({ dir: await tempDir() }).load();
  const company = new Company({ llm, github, repoDir: repo, workDir: join(dir, 'work'), settings: { ...defaultSettings({}), workers: 1, propose: false }, log: () => {}, runs });
  await company.start();
  after(() => company.stop());
  await eventually(() => github.issues[0].labels.includes(LABELS.stuck) && !company.workers[0].issue);
  assert.ok(github.comments.some((c) => /mul\.js is written; add is still to fix\.\n\nThe work so far is kept on the branch `ctb\/issue-12`, and the next try carries on from it\./.test(c.body)));
  assert.equal(git(origin, 'log', '-1', '--format=%an|%s|%b', 'ctb/issue-12'), 'Ada (CTB)|Work so far on #12|mul.js is written; add is still to fix.');
  assert.equal(git(origin, 'show', 'ctb/issue-12:mul.js'), 'export const mul = (a, b) => a * b;');
  assert.equal(github.pullsMade.length, 0, 'no pull request for unfinished work');

  // Main moves on meanwhile; the label comes off, and the next try starts from the kept work, main merged in.
  await writeFile(join(repo, 'README.md'), '# Toy, moved on\n\n## Project layout\n\n```\nadd.js   adds\n```\n');
  git(repo, 'commit', '--quiet', '-am', 'moved on');
  git(repo, 'push', '--quiet', 'origin', 'main');
  github.issues[0].labels = [LABELS.task];
  await company.poll();
  await eventually(() => github.pullsMade.length === 1 && !company.workers[0].issue);
  assert.match(tries[1], /An earlier try at this did not finish, and its work is already in your working copy \(diff shows it\): mul\.js\. Carry on from it rather than starting over\. What that try said when it stopped:\n\nmul\.js is written; add is still to fix\./);
  assert.equal(git(origin, 'diff', '--name-only', 'main', 'ctb/issue-12'), 'add.js\nmul.js', 'both tries’ work, and main as it is now');
  assert.equal(git(origin, 'show', 'ctb/issue-12:add.js'), 'export const add = (a, b) => a + b;');

  // Both tries in the run logs, newest first, everything the model was given and answered.
  const [second, first] = runs.list(0);
  assert.equal(first.kind, 'task');
  assert.equal(first.ok, false);
  assert.equal(first.why, 'mul.js is written; add is still to fix.');
  assert.equal(second.ok, true);
  assert.equal(second.url, 'https://github.com/ctbot000/toy/pull/501');
  assert.deepEqual([first.steps, second.steps], [2, 3]);
  const run = await runs.read(second.id);
  assert.equal(run.events[0].messages[1].content, tries[1]);
  assert.ok(run.events.some((e) => e.type === 'note' && /Carrying on from work kept from an earlier try: mul\.js\./.test(e.text)));
  const diff = run.events.find((e) => e.type === 'step' && e.step.tool === 'diff');
  assert.match(diff.result, /^Result of diff:\n[\s\S]*mul\.js[\s\S]*\+export const add = \(a, b\) => a \+ b;/, 'the diff counts the kept work too');
  assert.equal(run.events.filter((e) => e.type === 'call').length, 3);
  assert.match(transcript(run), /===== step 2: diff — result given to the model =====/);
  assert.deepEqual(company.status().workers[0].steps.length > 0, true);
});

test('a try out of steps leaves a note with its work, and the next try is taken at once, a few times before it is stuck', async () => {
  const { dir, origin, repo } = await project();
  const github = hub([issue(16, 'add a multiply', 'And fix add.'), issue(17, 'never ends', '')]);
  const tasks = [];
  const llm = scripted((messages) => {
    const task = messages[1].content;
    const last = messages.at(-1).content;
    if (last.startsWith('You are out of steps.')) return { summary: task.includes('#16') ? 'Done: mul.js. Left: fix add in add.js.' : 'Nothing much.' };
    const n = messages.filter((m) => m.role === 'assistant').length;
    if (n === 0) tasks.push(task);
    if (task.includes('#17')) return n === 0 ? { thought: 'a file', tool: 'write', path: `try-${tasks.filter((t) => t.includes('#17')).length}.txt`, content: 'x\n' } : { thought: 'look', tool: 'list', path: '' };
    if (!task.includes('An earlier try')) return n === 0 ? { thought: 'mul first', tool: 'write', path: 'mul.js', content: 'export const mul = (a, b) => a * b;\n' } : { thought: 'look', tool: 'list', path: '' };
    if (n === 0) return { thought: 'fix add', tool: 'edit', path: 'add.js', old: 'a - b', new: 'a + b' };
    return { thought: 'done', tool: 'done', title: 'Add mul and fix add', summary: 'Both.' };
  });
  const company = new Company({ llm, github, repoDir: repo, workDir: join(dir, 'work'), settings: { ...defaultSettings({}), workers: 1, propose: false }, log: () => {} });
  await company.start();
  after(() => company.stop());
  await eventually(() => github.pullsMade.length === 1 && github.issues[1].labels.includes(LABELS.stuck) && !company.workers[0].issue, 120000);

  // #16: out of steps once, carried on at once with its note, and finished.
  assert.ok(!github.issues[0].labels.includes(LABELS.stuck));
  assert.ok(github.comments.some((c) => c.n === 16 && /ran out of steps on this, try 1 of 3:\n\nran out of steps \(100\)\n\nDone: mul\.js\. Left: fix add in add\.js\.\n\nThe work so far is kept on the branch `ctb\/issue-16`, and the next try carries on from it now\./.test(c.body)));
  assert.match(tasks.find((t) => t.includes('#16') && t.includes('An earlier try')), /What that try said when it stopped:\n\nran out of steps \(100\)\n\nDone: mul\.js\. Left: fix add in add\.js\./);
  assert.equal(git(origin, 'diff', '--name-only', 'main', 'ctb/issue-16'), 'add.js\nmul.js');
  // #17: three tries out of steps, then stuck for a person to look at, all three tries' work kept.
  assert.equal(tasks.filter((t) => t.includes('#17')).length, 3);
  assert.equal(git(origin, 'log', '--format=%s', 'main..ctb/issue-17'), 'Work so far on #17\nWork so far on #17\nWork so far on #17');
  assert.ok(github.comments.some((c) => c.n === 17 && /could not finish this:\n\nran out of steps \(100\)\n\nNothing much\./.test(c.body)));
});

test('a task a restart cuts off carries on where it was, worktree and conversation and all', async () => {
  const { dir, origin, repo } = await project();
  const github = hub([issue(14, 'add a multiply', 'And fix add.')]);
  const logs = await tempDir();
  const settings = { ...defaultSettings({}), workers: 1, propose: false };
  // Before the restart: mul.js written, then the server stops while the model thinks.
  let thinking = false;
  const before = scripted((messages) => {
    const n = messages.filter((m) => m.role === 'assistant').length;
    if (n === 0) return { thought: 'mul first', tool: 'write', path: 'mul.js', content: 'export const mul = (a, b) => a * b;\n' };
    if (n === 1) return { thought: 'look', tool: 'list', path: '' };
    thinking = true;
    return new Promise(() => {});
  });
  const a = new Company({ llm: before, github, repoDir: repo, workDir: join(dir, 'work'), settings, log: () => {}, runs: await new Runs({ dir: logs }).load() });
  await a.start();
  await eventually(() => thinking);
  await a.stop();

  // After it: a new server, its run logs read again, and the task taken again.
  let given = null;
  const after_ = scripted((messages) => {
    const n = messages.filter((m) => m.role === 'assistant').length;
    if (n === 2) {
      given = messages;
      return { thought: 'now add', tool: 'edit', path: 'add.js', old: 'a - b', new: 'a + b' };
    }
    return { thought: 'done', tool: 'done', title: 'Add mul and fix add', summary: 'Both.' };
  });
  const runs = await new Runs({ dir: logs }).load();
  const [cut] = runs.list(0);
  assert.equal(cut.stopped, true, 'cut off, so ended as stopped');
  const b = new Company({ llm: after_, github, repoDir: repo, workDir: join(dir, 'work'), settings, log: () => {}, runs });
  await b.start();
  after(() => b.stop());
  await eventually(() => github.pullsMade.length === 1 && !b.workers[0].issue);
  // The model had its two steps back, as it took them, with their results.
  assert.deepEqual(given.filter((m) => m.role === 'assistant').map((m) => JSON.parse(m.content).tool), ['write', 'list']);
  assert.match(given[3].content, /^Result of write:\nWrote mul\.js/);
  assert.equal(git(origin, 'diff', '--name-only', 'main', 'ctb/issue-14'), 'add.js\nmul.js', 'mul.js from before the restart, add.js after');
  const [resumed] = runs.list(0);
  assert.equal(resumed.resumed, cut.id);
  assert.equal(resumed.ok, true);
  const run = await runs.read(resumed.id);
  assert.ok(run.events.some((e) => e.type === 'note' && /Carrying on from run .*, which the server stopping cut off: its 2 steps are given back to the model, and its working copy is as it left it \(changed: mul\.js\)\./.test(e.text)));
  assert.equal(run.events.find((e) => e.type === 'call').step, 3, 'counting on from where it was');
});

test('run logs: written as they go, read back after a restart, the newest kept, and a transcript of each', async () => {
  const dir = await tempDir();
  let now = 1000;
  const runs = new Runs({ dir, now: () => now, kept: 2 });
  const a = await runs.start({ kind: 'idea', k: 1, worker: 'Ben 💼', model: 'glm', title: 'An idea: a slide', messages: [{ role: 'system', content: 'Be kind.' }, { role: 'user', content: 'A slide!' }] });
  await a.call({ ms: 1500, trace: { model: 'glm', raw: '{"accept":true}', reasoning: 'A slide is fun.', finish: 'stop', zai: { promptTokens: 90, tokens: 20, cachedTokens: 64, reasoningTokens: 12 } } });
  now = 2000;
  await a.end({ ok: true, why: 'Accepted, as #3' });
  const b = await runs.start({ kind: 'task', k: 0, worker: 'Ada 💼', model: 'glm', issue: { number: 4, title: 'Fix it', url: 'u' }, messages: [] });
  await b.call({ step: 1, ms: 10, trace: { raw: '' }, error: new Error('Z.ai said nothing it could read') });
  assert.deepEqual(runs.list().map((r) => r.id), [b.summary.id, a.summary.id], 'newest first');
  assert.equal(runs.list(1).length, 1);
  assert.equal(runs.list(1)[0].endedAt, 2000);
  assert.equal(b.summary.failed, 1);
  assert.equal(b.summary.endedAt, 0, 'still going');

  // After a restart: from the files, an unfinished last line left out.
  await appendFile(join(dir, RUNS_DIR, `${a.summary.id}.jsonl`), '{"type":"no');
  const again = await new Runs({ dir, kept: 2 }).load();
  const read = await again.read(a.summary.id);
  assert.deepEqual(read.events.map((e) => e.type), ['start', 'call', 'end']);
  assert.deepEqual(read.summary, { ...runs.list(1)[0] });
  assert.equal(read.summary.promptTokens, 90);
  assert.equal(await again.read('../keeper'), null, 'only run ids');
  const text = transcript(read);
  assert.match(text, /^CTB run .*: idea by Ben 💼 with glm/);
  assert.match(text, /===== system message =====\nBe kind\./);
  assert.match(text, /1\.5 s, finish: stop, tokens: 90 prompt \(64 cached\), 20 completion \(12 reasoning\) =====\n--- thinking ---\nA slide is fun\.\n--- answer ---\n\{"accept":true\}/);
  assert.match(transcript(await again.read(b.summary.id)), /FAILED: Z\.ai said nothing it could read =====\n--- answer ---\n\(empty\)/);

  // Past the newest two: the oldest goes, file and all; one still going stays.
  now = 3000;
  await b.end({ ok: false, why: 'stopped' });
  await runs.start({ kind: 'proposal', k: 2, worker: 'Cleo 💼', model: 'glm', messages: [] });
  assert.equal(runs.list().length, 2);
  assert.equal(await runs.read(a.summary.id), null);
});

test('with nothing to do a worker proposes a task as an issue, which starts once labelled approved, or is turned down', async () => {
  const { dir, repo } = await project();
  const github = hub([]);
  let vague = false;
  const llm = scripted(() => vague ? { title: 'Improve the game', tldr: 'Make things better.', what: 'Many things.', done: ['It is better'] } : ({ title: 'Add a rainbow slide', tldr: 'A rainbow slide stamp, because kids love slides.', what: 'A stamp of a slide in rainbow bricks.\nIt goes in the toy box.', done: ['- It is in the toy box', 'Sliding down it works', '', 'a', 'b', 'c'] }));
  const company = new Company({ llm, github, repoDir: repo, workDir: join(dir, 'work'), settings: { ...defaultSettings({}), workers: 1, proposeHours: 6 }, log: () => {} });
  await company.start();
  after(() => company.stop());
  await eventually(() => github.made.length === 1);
  const p = github.made[0];
  assert.equal(p.title, 'Add a rainbow slide');
  assert.deepEqual(p.labels, [LABELS.proposal]);
  // Short, in one shape, a TL;DR first.
  assert.equal(
    p.body,
    '## TL;DR\n\nA rainbow slide stamp, because kids love slides.\n\n## What\n\nA stamp of a slide in rainbow bricks. It goes in the toy box.\n\n## Done when\n\n- It is in the toy box\n- Sliding down it works\n- a\n- b\n\n_Proposed by Ada 💼, CTB (stand-in). Label it “ctb: approved” to start it (Approve on the admin page does that); close it to turn it down._',
  );
  assert.equal(proposalBody({ title: 'x', what: 'y' }, 'z'), '', 'no TL;DR, no proposal');
  assert.match(llm.sent[0].messages[1].content, /Recent changes:\nstart/);
  // Not again for proposeHours.
  await company.poll();
  assert.equal(github.made.length, 1);
  // Not started until labelled approved.
  await company.poll();
  assert.deepEqual(p.labels, [LABELS.proposal]);
  await company.approve(p.number);
  assert.deepEqual(p.labels, [LABELS.proposal, LABELS.approved]);
  await company.poll();
  assert.ok(p.labels.includes(LABELS.task) && !p.labels.includes(LABELS.proposal), 'approved: a task now');
  // Too vague to file: fewer than two checks for when it is done.
  vague = true;
  assert.equal(await company.propose(company.workers[0]), null);
  assert.equal(github.made.length, 1);
  vague = false;
  const q = await company.propose(company.workers[0]);
  await company.reject(q.number);
  assert.equal(github.issues.find((i) => i.number === q.number).open, false);
});

test('the workers weigh ideas against everything the game has, not only the start of it', async () => {
  const repoDir = await tempDir();
  const far = `- ${'Build with bricks. '.repeat(1500)}\n- **Monsters** to bop with 👊, and a dragon to tame.`;
  await writeFile(join(repoDir, 'README.md'), `# Kids World\n\n## What you can do\n\n${far}\n\n## Controls\n\nKeys.\n`);
  const company = new Company({ llm: {}, github: {}, repoDir, workDir: await tempDir(), settings: defaultSettings({}), log: () => {} });
  const features = await company.features();
  assert.ok(features.length > 20000);
  assert.match(features, /\*\*Monsters\*\* to bop/);
  assert.doesNotMatch(features, /Controls/);
});

test('the office on the CTB island: workers at their desks, answering children, who cannot build there', async () => {
  const dir = await tempDir();
  const rooms = new Map();
  const answers = [];
  const office = new Office({ rooms, file: join(dir, 'ctb-island.json'), log: () => {}, guideSpeed: 40, answer: (k, name, text) => (answers.push([k, name, text]), `Hi ${name}! I'm working on #12: Fix the bus.`), ignores: (name) => name === 'Pip 🤖', random: () => 0.5 });
  await office.open(3);
  after(() => office.close());
  const room = office.room;
  assert.equal(room.world.name, ISLAND_NAME);
  const workers = () => [...room.players.values()].filter((p) => p.online && p.name.endsWith('💼'));
  await eventually(() => workers().length === 3 && workers().every((p) => p.s[4] === 8));
  assert.deepEqual(workers().map((p) => p.name), ['Ada 💼', 'Ben 💼', 'Cleo 💼']);
  assert.equal(room.host, 0, 'no worker owns the island: one login does, and it is not here');
  // Each sits on a chair of the office, facing its TV.
  for (const [k, p] of workers().entries()) {
    const seat = office.seats[k];
    assert.ok(Math.hypot(p.s[0] - seat.x, p.s[2] - seat.z) < 0.01);
    const chair = B.BLOCKS[room.world.get(Math.floor(seat.x), Math.floor(seat.y), Math.floor(seat.z))];
    assert.equal(chair.model, 'chair');
  }
  assert.equal(office.seats.length, deskSpots().length);
  // Visitors arrive on the boulevard at the front of the grounds, turned to
  // the doors at its end, with nothing but air between them and the building's top.
  const spawn = room.world.spawn;
  assert.equal(room.world.get(Math.floor(spawn.x), spawn.y - 1, Math.floor(spawn.z)), B.PEBBLES);
  assert.equal(room.world.get(Math.floor(spawn.x), spawn.y, Math.floor(spawn.z)), B.AIR);
  const [[doorX, doorY, doorZ]] = placeTemplate([[0, 1, 0, 0]], office.site.x, office.site.base, office.site.z, office.site.facing);
  assert.equal(room.world.get(doorX, doorY, doorZ), B.AIR, 'the doors are open');
  assert.ok(Math.hypot(doorX + 0.5 - spawn.x, doorZ + 0.5 - spawn.z) > 25, 'far enough back to see it all');
  // A camera's yaw looks along (-sin, -cos): at the doors.
  const look = [-Math.sin(spawn.yaw), -Math.cos(spawn.yaw)];
  const toDoor = [doorX + 0.5 - spawn.x, doorZ + 0.5 - spawn.z];
  assert.ok((look[0] * toDoor[0] + look[1] * toDoor[1]) / Math.hypot(...toDoor) > 0.99);
  // The way to look goes to pages with the island; an island without one has none.
  assert.equal(World.decode(room.world.meta(), room.world.encode()).spawn.yaw, spawn.yaw);
  assert.equal('yaw' in World.decode({ ...room.world.meta(), spawn: { x: 5, y: 30, z: 5 } }, room.world.encode()).spawn, false);
  // No hill rises over the grounds.
  const g = placeTemplate([[GROUNDS.x0, 0, GROUNDS.z0, 0], [GROUNDS.x1, 0, GROUNDS.z1, 0]], office.site.x, office.site.base, office.site.z, office.site.facing);
  for (let x = Math.min(g[0][0], g[1][0]); x <= Math.max(g[0][0], g[1][0]); x++) {
    for (let z = Math.min(g[0][2], g[1][2]); z <= Math.max(g[0][2], g[1][2]); z++) assert.ok(room.world.groundBelow(x, room.world.H - 1, z) < office.site.base + 25);
  }
  assert.ok(officeCells().some(([, , , id]) => id === B.COMPUTER));

  // The AI friend talking to them gets no answer: it would answer back, on and on.
  const pip = { send: () => {} };
  room.attach(pip);
  room.receive(pip, { t: 'join', protocol: PROTOCOL, name: 'Pip 🤖', look: { animal: 'kid' } });
  // The workers hear what is said straight after the island passes it on
  // (dialer.js LocalLink), and would answer as they hear it.
  room.receive(pip, { t: 'say', text: 'Hi Ada! What are you making?' });
  assert.ok(room.chat.some((c) => c.name === 'Pip 🤖'), 'said on the island');
  await new Promise((done) => setImmediate(done));
  assert.deepEqual(answers, []);

  // The guide waits by the gate, and took none of CTB's own, nor the AI friend, for a guest.
  const guide = () => [...room.players.values()].find((p) => p.name === GUIDE.name && p.online);
  await eventually(() => guide()?.s);
  assert.equal(office.guide.mode, 'idle');
  assert.ok(room.chat.every((c) => c.name !== GUIDE.name), 'nobody greeted yet');

  // A child comes, asks Ben what he is doing; only Ben answers.
  const heard = [];
  const conn = { send: (text) => heard.push(JSON.parse(text)) };
  room.attach(conn);
  room.receive(conn, { t: 'join', protocol: PROTOCOL, name: 'Minji', look: { animal: 'bunny' } });
  room.receive(conn, { t: 'say', text: 'Ben, what are you doing?' });
  await eventually(() => heard.some((m) => m.t === 'say' && m.name === 'Ben 💼'));
  assert.deepEqual(answers, [[1, 'Minji', 'Ben, what are you doing?']]);
  // Grace greeted her by name, and leads her up the boulevard, waiting while
  // she falls behind; followed, she goes all the way to the lobby.
  assert.ok(heard.some((m) => m.t === 'say' && m.name === GUIDE.name && m.text.startsWith('Welcome to CTB, Minji!')));
  await eventually(() => heard.some((m) => m.t === 'say' && m.name === GUIDE.name && m.text === 'This way! 🌷'));
  const lobby = office.guide.at(GUIDE.route.at(-1));
  for (let i = 0; i < 200 && office.guide.mode !== 'lobby'; i++) {
    const s = guide().s;
    room.receive(conn, { t: 'm', s: [s[0], s[1], s[2], 0, 1, 0] });
    await new Promise((done) => setTimeout(done, 30));
  }
  assert.equal(office.guide.mode, 'lobby');
  await eventually(() => Math.hypot(guide().s[0] - lobby.x, guide().s[2] - lobby.z) < 0.1);
  assert.equal(room.world.get(Math.floor(lobby.x), Math.floor(guide().s[1]), Math.floor(lobby.z)), B.AIR, 'standing in the lobby, not in a wall');
  await eventually(() => heard.some((m) => m.t === 'say' && m.name === GUIDE.name && m.text.startsWith('Here we are, Minji!')));
  // Asked by name, she answers herself; the workers leave it to her, even
  // long enough after Ben's answer for one of them to answer again.
  const answered = answers.length;
  office.answeredAt = 0;
  room.receive(conn, { t: 'say', text: 'Grace, thank you!' });
  // She came after them, so she hears it after them: once she answers, they have heard it too.
  await eventually(() => heard.some((m) => m.t === 'say' && m.name === GUIDE.name && m.text.startsWith('Hi Minji!')));
  assert.equal(answers.length, answered);
  assert.equal(heard.find((m) => m.t === 'say' && m.name === 'Ben 💼').text, "Hi Minji! I'm working on #12: Fix the bus.");
  assert.deepEqual(office.summary().visitors, ['Pip 🤖', 'Minji']);
  assert.equal(office.summary().url, 'https://ctbot000.github.io/kids-world/?ctb');
  // On the list of open islands as the one to come to without logging in (main.js ?ctb).
  assert.equal(room.listing().watch, true);
  assert.equal(cleanListing(room.listing()).watch, true);
  assert.equal('watch' in cleanListing({ ...room.listing(), watch: 'yes' }), false);
  // Building is for the owner only.
  const me = heard.find((m) => m.t === 'welcome');
  assert.equal(me.settings.build, 'host');
  // Its owner is one login: their page, coming, owns it at once; nobody
  // else ever does, and with them gone it has no owner.
  const IZEYE = 'ab'.repeat(32);
  office.setOwner(IZEYE);
  const owner = { send: (text) => heard.push(JSON.parse(text)) };
  room.attach(owner);
  room.receive(owner, { t: 'join', protocol: PROTOCOL, name: 'izeye', look: { animal: 'fox' }, who: IZEYE });
  const izeye = [...room.players.values()].find((p) => p.name === 'izeye');
  assert.equal(room.host, izeye.id);
  assert.ok(heard.some((m) => m.t === 'host' && m.pid === izeye.id), 'the others hear who owns it now');
  const sneaky = { send: () => {} };
  room.attach(sneaky);
  room.receive(sneaky, { t: 'join', protocol: PROTOCOL, name: 'Sneaky', look: { animal: 'cat' }, who: 'cd'.repeat(32) });
  assert.equal(room.host, izeye.id);
  room.detach(owner);
  room.leave(izeye.id);
  assert.equal(room.host, 0, 'away, nobody owns it — not a worker, not a visitor');
  room.detach(sneaky);

  // An office of an older kind is taken down and this one put up in its place,
  // the workers at its desks.
  await office.save();
  const file = join(dir, 'ctb-island.json');
  const older = JSON.parse(await readFile(file, 'utf8'));
  assert.equal(older.office, OFFICE_VERSION);
  // Something left over the boulevard, which is open air once the office is up again.
  const [[bx, by, bz]] = placeTemplate([[0, 10, -20, 0]], office.site.x, office.site.base, office.site.z, office.site.facing);
  const before = { x: bx, y: by, z: bz };
  room.world.set(before.x, before.y, before.z, B.STAR_BLOCK);
  await office.save();
  const saved = JSON.parse(await readFile(file, 'utf8'));
  delete saved.office;
  const rebuilt = new Office({ rooms: new Map(), file: join(dir, 'older.json'), log: () => {} });
  await writeFile(join(dir, 'older.json'), JSON.stringify(saved));
  await rebuilt.open(1);
  after(() => rebuilt.close());
  assert.equal(rebuilt.room.world.get(before.x, before.y, before.z), B.AIR, 'the old office is gone');
  assert.equal(JSON.parse(await readFile(join(dir, 'older.json'), 'utf8')).office, OFFICE_VERSION);
  assert.equal(B.BLOCKS[rebuilt.room.world.get(Math.floor(rebuilt.seats[0].x), Math.floor(rebuilt.seats[0].y), Math.floor(rebuilt.seats[0].z))].model, 'chair');
  await rebuilt.close();

  // Fewer workers: the last ones leave; saved, it is the same island again.
  office.staff(1);
  await eventually(() => workers().length === 1);
  await office.close();
  const again = new Office({ rooms: new Map(), file: join(dir, 'ctb-island.json'), log: () => {} });
  await again.open(1);
  after(() => again.close());
  assert.equal(again.room.code, room.code);
  assert.deepEqual(again.site, office.site);
  await eventually(() => [...again.room.players.values()].some((p) => p.online && p.name === 'Ada 💼'));
  assert.equal(again.room.host, 0, 'the old island’s owner, a worker, owns it no more');
});

test('a worker answers in Korean when spoken to in Korean, saying the same things as in English', () => {
  const company = new Company({ llm: {}, github: {}, repoDir: '', workDir: '', settings: { ...defaultSettings({}), workers: 2, propose: false }, log: () => {} });
  const say = (text, k = 0) => company.answer(k, 'Minji', text);
  const ada = company.workers[0];
  ada.issue = { number: 12, title: 'Fix the bus.' };

  // What they are working on: the issue's number and title as they are.
  assert.equal(say('Busy with anything?'), "Hi Minji! I'm working on #12: Fix the bus.");
  assert.equal(say('지금 뭐 하는 중이에요?'), '안녕 Minji! 지금 #12번을 하고 있어요: Fix the bus.');
  // What CTB is: Ada, the first worker, answers.
  assert.equal(say('What is CTB?'), "Hi Minji! We're CTB. We make Kids World better: we fix bugs and add new things to this game!");
  assert.equal(say('CTB는 어떤 팀이에요?'), '안녕 Minji! 우리는 CTB예요. 키즈 월드를 더 좋게 만들어요: 버그를 고치고 이 게임에 새로운 것을 더해요!');
  // Between tasks, and the empty board.
  ada.issue = null;
  company.tasks = [issue(1), issue(2), issue(3)];
  assert.equal(say('Any tasks for you?'), "Hi Minji! I'm between tasks. 3 on the board!");
  assert.equal(say('할 일 있어요?'), '안녕 Minji! 지금은 다음 일을 기다리는 중이에요. 할 일 보드에 3개 있어요!');
  company.tasks = [];
  assert.equal(say('Anything to do?'), "Hi Minji! No tasks right now, so I'm thinking up new ideas.");
  assert.equal(say('지금 뭐 해요?'), '안녕 Minji! 지금 할 일이 없어서 새로운 아이디어를 생각하고 있어요.');
  // A desk with no worker on it.
  assert.equal(say('Hello?', 3), "Hi Minji! I'm on a break.");
  assert.equal(say('안녕하세요?', 3), '안녕 Minji! 지금은 쉬는 중이에요.');
  // CTB closed.
  company.settings.on = false;
  assert.equal(say('Hello?'), 'Hi Minji! CTB is closed right now.');
  assert.equal(say('안녕하세요?'), '안녕 Minji! CTB는 지금 문을 닫았어요.');
});

test('settings are checked, and the admin page adds tasks, approves proposals and shows the workers', async () => {
  assert.deepEqual(defaultSettings({}), { on: true, workers: 2, propose: true, proposeHours: 6, model: '', owner: 'izeye' });
  assert.equal(defaultSettings({ KIDS_WORLD_CTB_OWNER: 'otter' }).owner, 'otter');
  assert.throws(() => changeSettings(defaultSettings({}), { owner: 'x'.repeat(40) }), /not a username/);
  assert.equal(defaultSettings({ KIDS_WORLD_CTB: 'off' }).on, false);
  assert.throws(() => changeSettings(defaultSettings({}), { workers: 9 }), /1 to 4 workers/);
  assert.throws(() => changeSettings(defaultSettings({}), { model: 'a b' }), /not a model name/);
  assert.deepEqual(changeSettings(defaultSettings({}), { workers: 3, model: 'glm-5.3' }), { on: true, workers: 3, propose: true, proposeHours: 6, model: 'glm-5.3', owner: 'izeye' });
  assert.equal(repoOf('https://github.com/ctbot000/kids-world.git'), 'ctbot000/kids-world');
  assert.equal(repoOf('git@github.com:ctbot000/kids-world'), 'ctbot000/kids-world');
  assert.equal(repoOf('https://example.com/x/y.git'), '');

  const { dir, repo } = await project();
  const store = await new KeeperStore(join(dir, 'keep')).open();
  // The island's owner, found by their username at the keeper, as their pages tell islands who they are.
  const izeye = KeeperStore.deviceId('f1'.repeat(16));
  await store.makeLogin(izeye, 'rocket-apple7', { name: 'Ize' }, { username: 'IZEYE' });
  const owned = new CtbControl({ dir: store.dir, repoDir: repo, llm: scripted([]), keeper: { store }, env: {}, log: () => {} });
  assert.equal(await owned.ownerWho(), islandWho(izeye));
  owned.settings.owner = 'nobody here';
  assert.equal(await owned.ownerWho(), '');
  const github = hub([issue(3, 'a proposal', 'An idea.', [LABELS.proposal])]);
  // Busy thinking forever, so nothing is done with the tasks.
  const llm = { ...scripted([]), chat: () => new Promise(() => {}) };
  const rooms = new Map();
  const ctb = new CtbControl({ dir: store.dir, repoDir: repo, llm, rooms, github, env: {}, friendModel: () => 'glm-5.3-flash', log: () => {} });
  await ctb.start();
  after(() => ctb.stop());
  const web = createGameServer({ log: () => {}, admin: adminHandler({ store, ctb }) });
  after(() => web.close());
  await new Promise((done) => web.listen(0, '127.0.0.1', done));
  const base = `http://127.0.0.1:${web.address().port}/admin/api/ctb`;
  const post = (path, body) => fetch(`${base}${path}`, { method: 'POST', headers: { 'X-Kids-World-Admin': '1', 'Content-Type': 'application/json' }, body: JSON.stringify(body ?? {}) });

  let state = await (await fetch(base)).json();
  assert.equal(state.running, true);
  assert.equal(state.problem, '');
  assert.equal(state.repo, 'ctbot000/toy');
  assert.equal(state.model, 'glm-5.3-flash', 'the AI friend’s model until one is picked');
  assert.equal(state.island.name, ISLAND_NAME);
  assert.deepEqual(state.proposals.map((p) => p.number), [3]);
  assert.equal((await post('/tasks', { title: '' })).status, 400);
  assert.equal((await fetch(`${base}/tasks`, { method: 'POST', body: '{"title":"x"}' })).status, 403, 'needs the admin header');
  const made = await (await post('/tasks', { title: 'Make the bus honk', body: 'Beep beep.' })).json();
  assert.equal(made.number, 101);
  assert.deepEqual(github.made[0].labels, [LABELS.task]);
  assert.equal((await post('/proposals/3/approve')).status, 200);
  assert.ok(github.issues[0].labels.includes(LABELS.approved));
  await eventually(() => github.issues[0].labels.includes(LABELS.task) && !github.issues[0].labels.includes(LABELS.proposal));
  await eventually(async () => (await (await fetch(base)).json()).workers.filter((w) => w.issue).length === 2);
  state = await (await fetch(base)).json();
  assert.deepEqual(state.workers.map((w) => w.issue.number).sort((a, b) => a - b), [3, 101]);
  assert.match(state.workers[0].doing, /^#\d+: /);

  // Each worker's talks with the model, as run logs: listed, read whole, and as a transcript to download.
  const live = await eventually(async () => (await (await fetch(base)).json()).runs.find((r) => r.kind === 'task' && r.k === 0));
  assert.equal(live.worker, 'Ada 💼');
  assert.equal(live.endedAt, 0, 'still going');
  const run = await (await fetch(`${base}/runs/${live.id}`)).json();
  assert.equal(run.summary.id, live.id);
  assert.match(run.events[0].messages[0].content, /You are Ada, a software engineer at CTB/);
  const txt = await fetch(`${base}/runs/${live.id}.txt`);
  assert.match(txt.headers.get('content-disposition'), /attachment; filename="ctb-run-.*\.txt"/);
  assert.match(await txt.text(), /===== system message =====\nYou are Ada/);
  assert.equal((await fetch(`${base}/runs/nope`)).status, 404);
  assert.equal((await fetch(`${base}/runs/..%2Fctb`)).status, 404);

  // When a worker last proposed is kept, so a restart does not bring another proposal at once.
  const { proposedAt } = JSON.parse(await readFile(join(store.dir, 'ctb-state.json'), 'utf8'));
  assert.ok(Date.now() - proposedAt < 60000);
  assert.equal(await ctb.readProposedAt(), proposedAt);

  // Settings: saved, and off closes the office.
  const res = await fetch(base, { method: 'PUT', headers: { 'X-Kids-World-Admin': '1', 'Content-Type': 'application/json' }, body: JSON.stringify({ on: false }) });
  assert.equal(res.status, 200);
  assert.deepEqual(JSON.parse(await readFile(join(store.dir, 'ctb.json'), 'utf8')).on, false);
  state = await res.json();
  assert.equal(state.running, false);
  assert.equal((await post('/tasks', { title: 'x' })).status, 400, 'CTB is off');
});
