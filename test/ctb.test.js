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
import { mkdir, mkdtemp, readFile, rm, stat, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, test } from 'node:test';
import * as B from '../public/js/shared/blocks.js';
import { cleanListing } from '../public/js/shared/listing.js';
import { PROTOCOL } from '../public/js/shared/room.js';
import { placeTemplate } from '../public/js/shared/stamps.js';
import { adminHandler } from '../server/admin.js';
import { Agent, inside, layoutOf, STEP_SCHEMA } from '../server/ctb-agent.js';
import { LABELS, repoOf } from '../server/ctb-github.js';
import { deskSpots, ISLAND_NAME, Office, OFFICE_VERSION, officeCells, workerName } from '../server/ctb-office.js';
import { changeSettings, Company, CtbControl, defaultSettings, proposalBody, pullBody } from '../server/ctb.js';
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

test('the office on the CTB island: workers at their desks, answering children, who cannot build there', async () => {
  const dir = await tempDir();
  const rooms = new Map();
  const answers = [];
  const office = new Office({ rooms, file: join(dir, 'ctb-island.json'), log: () => {}, answer: (k, name, text) => (answers.push([k, name, text]), `Hi ${name}! I'm working on #12: Fix the bus.`), ignores: (name) => name === 'Pip 🤖', random: () => 0.5 });
  await office.open(3);
  after(() => office.close());
  const room = office.room;
  assert.equal(room.world.name, ISLAND_NAME);
  const workers = () => [...room.players.values()].filter((p) => p.online && p.name.endsWith('💼'));
  await eventually(() => workers().length === 3 && workers().every((p) => p.s[4] === 8));
  assert.deepEqual(workers().map((p) => p.name), ['Ada 💼', 'Ben 💼', 'Cleo 💼']);
  assert.equal(room.host, workers()[0].id, 'the first worker owns the island');
  // Each sits on a chair of the office, facing its TV.
  for (const [k, p] of workers().entries()) {
    const seat = office.seats[k];
    assert.ok(Math.hypot(p.s[0] - seat.x, p.s[2] - seat.z) < 0.01);
    const chair = B.BLOCKS[room.world.get(Math.floor(seat.x), Math.floor(seat.y), Math.floor(seat.z))];
    assert.equal(chair.model, 'chair');
  }
  assert.equal(office.seats.length, deskSpots().length);
  // Visitors arrive on the plaza's paving before the doors, a few steps from them.
  const spawn = room.world.spawn;
  assert.equal(room.world.get(Math.floor(spawn.x), spawn.y - 1, Math.floor(spawn.z)), B.PEBBLES);
  assert.equal(room.world.get(Math.floor(spawn.x), spawn.y, Math.floor(spawn.z)), B.AIR);
  const [[doorX, doorY, doorZ]] = placeTemplate([[0, 1, 0, 0]], office.site.x, office.site.base, office.site.z, office.site.facing);
  assert.equal(room.world.get(doorX, doorY, doorZ), B.AIR, 'the doors are open');
  assert.ok(Math.hypot(doorX + 0.5 - spawn.x, doorZ + 0.5 - spawn.z) <= 4.01);
  assert.ok(officeCells().some(([, , , id]) => id === B.TV));

  // The AI friend talking to them gets no answer: it would answer back, on and on.
  const pip = { send: () => {} };
  room.attach(pip);
  room.receive(pip, { t: 'join', protocol: PROTOCOL, name: 'Pip 🤖', look: { animal: 'kid' } });
  room.receive(pip, { t: 'say', text: 'Hi Ada! What are you making?' });
  await new Promise((done) => setTimeout(done, 1500));
  assert.deepEqual(answers, []);

  // A child comes, asks Ben what he is doing; only Ben answers.
  const heard = [];
  const conn = { send: (text) => heard.push(JSON.parse(text)) };
  room.attach(conn);
  room.receive(conn, { t: 'join', protocol: PROTOCOL, name: 'Minji', look: { animal: 'bunny' } });
  room.receive(conn, { t: 'say', text: 'Ben, what are you doing?' });
  await eventually(() => heard.some((m) => m.t === 'say' && m.name === 'Ben 💼'));
  assert.deepEqual(answers, [[1, 'Minji', 'Ben, what are you doing?']]);
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

  // An office of an older kind is taken down and this one put up in its place,
  // the workers at its desks.
  await office.save();
  const file = join(dir, 'ctb-island.json');
  const older = JSON.parse(await readFile(file, 'utf8'));
  assert.equal(older.office, OFFICE_VERSION);
  const before = { x: office.site.x, y: office.site.base + 9, z: office.site.z };
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
  await eventually(() => [...again.room.players.values()].some((p) => p.online && p.name === 'Ada 💼' && p.id === again.room.host));
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
  assert.deepEqual(defaultSettings({}), { on: true, workers: 2, propose: true, proposeHours: 6, model: '' });
  assert.equal(defaultSettings({ KIDS_WORLD_CTB: 'off' }).on, false);
  assert.throws(() => changeSettings(defaultSettings({}), { workers: 9 }), /1 to 4 workers/);
  assert.throws(() => changeSettings(defaultSettings({}), { model: 'a b' }), /not a model name/);
  assert.deepEqual(changeSettings(defaultSettings({}), { workers: 3, model: 'glm-5.3' }), { on: true, workers: 3, propose: true, proposeHours: 6, model: 'glm-5.3' });
  assert.equal(repoOf('https://github.com/ctbot000/kids-world.git'), 'ctbot000/kids-world');
  assert.equal(repoOf('git@github.com:ctbot000/kids-world'), 'ctbot000/kids-world');
  assert.equal(repoOf('https://example.com/x/y.git'), '');

  const { dir, repo } = await project();
  const store = await new KeeperStore(join(dir, 'keep')).open();
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
