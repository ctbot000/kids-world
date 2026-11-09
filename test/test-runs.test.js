// The tests' runs before a push, timed for the admin page's Tests tab
// (server/test-runs.js): each written as it starts and again as it ends, one
// cut off read as stopped, the newest kept, how long a run usually takes and
// each test file's time beside its usual; the admin page's API for them; and
// scripts/check.mjs timing real runs of scripts/test.mjs on commits of a
// project made for the test, passing and failing, and never in their way.
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { copyFile, mkdir, mkdtemp, readdir, rm, writeFile } from 'node:fs/promises';
import { availableParallelism, tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { adminHandler } from '../server/admin.js';
import { KeeperStore } from '../server/keeper.js';
import { createGameServer } from '../server/server.js';
import { median, TEST_RUNS_DIR, TestRuns, USUAL_OF } from '../server/test-runs.js';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const dirs = [];
async function tempDir() {
  const dir = await mkdtemp(join(tmpdir(), 'kids-world-test-runs-'));
  dirs.push(dir);
  return dir;
}
after(() => Promise.all(dirs.map((dir) => rm(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 }))));

// A clock moved by hand.
function clock(t = 1_790_000_000_000) {
  const now = () => t;
  now.add = (ms) => (t += ms);
  return now;
}

// test.mjs's summary of a run whose test files took these times.
const summaryOf = (times) => ({
  ms: 1,
  counts: { tests: 10, pass: 10, fail: 0, cancelled: 0, skipped: 0 },
  jobs: Object.entries(times).map(([name, ms]) => ({ name, ms })),
  flaky: [],
  failed: [],
  heldMs: 0,
  atOnce: { jobs: 4, e2e: 2, shards: 4, cores: 8 },
});

test('a run is written as it starts and again as it ends; one whose process is gone, or that has gone on longer than any run takes, reads as stopped', async () => {
  const dir = await tempDir();
  const now = clock();
  const alive = new Set([111]);
  const runs = new TestRuns({ dir, now, alive: (pid) => alive.has(pid) });
  const run = await runs.start({ commit: 'a'.repeat(40), subject: 'Add a thing', hook: true, full: false, pid: 111 });
  assert.equal(run.id, `${now()}-111`);
  assert.deepEqual(await readdir(join(dir, TEST_RUNS_DIR)), [`${run.id}.json`]);
  assert.equal((await runs.list())[0].status, 'running');
  now.add(90_000);
  await runs.end(run, { ok: true, copyMs: 800, testsMs: 89_000, summary: summaryOf({ 'test/a.test.js': 3000, 'test/e2e.test.js 1/4': 80_000 }) });
  const [listed] = await runs.list();
  assert.equal(listed.status, 'passed', 'read again once it ended, though it was read while it ran');
  assert.equal(listed.ms, 90_000);
  const whole = await runs.run(run.id);
  assert.deepEqual(
    whole.jobs.map((j) => j.name),
    ['test/a.test.js', 'test/e2e.test.js 1/4'],
  );
  assert.equal(whole.copyMs, 800);
  assert.equal(whole.counts.pass, 10);
  assert.deepEqual(await readdir(join(dir, TEST_RUNS_DIR)), [`${run.id}.json`], 'nothing half written left beside it');

  // Cut off: its process gone (Ctrl+C on a push), or there after longer than
  // any run takes (its id given to another process since).
  const cut = await runs.start({ commit: 'b'.repeat(40), subject: 'Cut off', pid: 222 });
  assert.equal((await runs.run(cut.id)).status, 'stopped');
  now.add(1000);
  const long = await runs.start({ commit: 'c'.repeat(40), subject: 'Long', pid: 111 });
  assert.equal((await runs.run(long.id)).status, 'running');
  now.add(61 * 60_000);
  assert.equal((await runs.run(long.id)).status, 'stopped');
  assert.deepEqual(
    (await runs.list()).map((r) => r.subject),
    ['Long', 'Cut off', 'Add a thing'],
    'newest first',
  );

  // Only a run's own file is read, and never half of one.
  assert.equal(await runs.run('../keeper'), null);
  assert.equal(await runs.run('1-2/../../x'), null);
  await writeFile(join(dir, TEST_RUNS_DIR, '5-5.json'), '{"id":"5-5","startedAt"');
  assert.equal(await runs.run('5-5'), null);
  assert.equal((await runs.list()).length, 3);
});

test('only the newest runs are kept', async () => {
  const dir = await tempDir();
  const now = clock();
  const runs = new TestRuns({ dir, now, kept: 3, alive: () => false });
  for (let k = 0; k < 5; k++) {
    now.add(1000);
    await runs.end(await runs.start({ commit: String(k), subject: `run ${k}` }), { ok: true });
  }
  assert.deepEqual(
    (await runs.list()).map((r) => r.subject),
    ['run 4', 'run 3', 'run 2'],
  );
  assert.equal((await readdir(join(dir, TEST_RUNS_DIR))).length, 3);
});

test('how long a run usually takes, light and full, and each test file’s time in the latest run that passed beside its usual', async () => {
  const dir = await tempDir();
  const now = clock();
  const runs = new TestRuns({ dir, now, alive: () => false });
  const add = async (ms, { ok = true, full = false, times = null } = {}) => {
    now.add(3_600_000);
    const run = await runs.start({ commit: `c${ms}`, subject: `took ${ms}`, full });
    now.add(ms);
    await runs.end(run, { ok, summary: times && summaryOf(times) });
  };
  await add(100_000, { times: { 'test/a.test.js': 10_000, 'test/b.test.js': 2000 } });
  await add(120_000, { times: { 'test/a.test.js': 14_000, 'test/b.test.js': 2000 } });
  await add(500_000, { full: true, times: { 'test/a.test.js': 30_000 } });
  await add(30_000, { ok: false, times: { 'test/a.test.js': 1000 } });
  await add(110_000, { times: { 'test/a.test.js': 12_000, 'test/b.test.js': 2500, 'test/c.test.js': 900 } });
  const s = await runs.summary();
  assert.equal(s.usualOf, USUAL_OF);
  assert.deepEqual(s.usual.light, { runs: 3, median: 110_000, fastest: 100_000, slowest: 120_000 }, 'of the light runs that passed');
  assert.deepEqual(s.usual.full, { runs: 1, median: 500_000, fastest: 500_000, slowest: 500_000 });
  assert.deepEqual(
    s.runs.map((r) => r.status),
    ['passed', 'failed', 'passed', 'passed', 'passed'],
  );
  assert.equal(s.runs[0].subject, 'took 110000');
  assert.equal(s.runs[0].jobs, undefined, 'the list is in brief');
  assert.equal(s.files.run.subject, 'took 110000');
  assert.deepEqual(s.files.files, [
    { name: 'test/a.test.js', ms: 12_000, again: 0, usual: 12_000, runs: 3 },
    { name: 'test/b.test.js', ms: 2500, again: 0, usual: 2000, runs: 3 },
    { name: 'test/c.test.js', ms: 900, again: 0, usual: 900, runs: 1 },
  ]);
  assert.equal(median([3, 1, 2]), 2);
  assert.equal(median([4, 1, 2, 3]), 3);
  assert.equal(median([]), null);

  // No runs at all: nothing to show.
  const none = await new TestRuns({ dir: await tempDir() }).summary();
  assert.deepEqual([none.runs, none.usual, none.files], [[], { light: null, full: null }, null]);
});

test('the admin page reads the runs, and one run whole, from the data folder', async () => {
  const dir = await tempDir();
  const store = await new KeeperStore(dir).open();
  const runs = new TestRuns({ dir });
  const run = await runs.start({ commit: 'd'.repeat(40), subject: 'Time the tests', hook: true });
  await runs.end(run, { ok: true, copyMs: 500, testsMs: 1500, summary: summaryOf({ 'test/a.test.js': 1200 }) });
  const web = createGameServer({ log: () => {}, admin: adminHandler({ store }) });
  after(() => web.shutdown());
  await new Promise((done) => web.listen(0, '127.0.0.1', done));
  const base = `http://127.0.0.1:${web.address().port}/admin/api/tests`;
  const s = await (await fetch(base)).json();
  assert.equal(s.dir, join(dir, TEST_RUNS_DIR));
  assert.deepEqual(
    s.runs.map((r) => [r.subject, r.status, r.hook]),
    [['Time the tests', 'passed', true]],
  );
  assert.deepEqual(
    s.files.files.map((f) => f.name),
    ['test/a.test.js'],
  );
  assert.equal((await (await fetch(`${base}/${run.id}`)).json()).testsMs, 1500);
  assert.equal((await fetch(`${base}/1-1`)).status, 404);
  assert.equal((await fetch(`${base}/..%2Fkeeper`)).status, 404);
  assert.equal((await fetch(base, { method: 'POST', headers: { 'X-Kids-World-Admin': '1' } })).status, 405);
  assert.equal((await fetch(`http://127.0.0.1:${web.address().port}/admin/tests.js`)).status, 200, 'the tab’s own script');
});

// The environment without git's hook variables or any of the tests' knobs.
function cleanEnv() {
  return Object.fromEntries(Object.entries(process.env).filter(([key]) => !/^(GIT_|CHECK_|TEST_|E2E_|KIDS_WORLD_)/.test(key) && key !== 'NODE_TEST_CONTEXT'));
}
const git = (cwd, ...args) => execFileSync('git', ['-c', 'commit.gpgsign=false', ...args], { cwd, encoding: 'utf8', env: { ...cleanEnv(), GIT_AUTHOR_NAME: 'T', GIT_AUTHOR_EMAIL: 't@example.com', GIT_COMMITTER_NAME: 'T', GIT_COMMITTER_EMAIL: 't@example.com' } }).trim();

// A project of its own with this test.mjs, an end-to-end test file (as every
// project test.mjs runs has) and one more, committed.
async function project({ fail = false } = {}) {
  const dir = await tempDir();
  const repo = join(dir, 'repo');
  await mkdir(join(repo, 'scripts'), { recursive: true });
  await mkdir(join(repo, 'test'));
  await copyFile(join(ROOT, 'scripts/test.mjs'), join(repo, 'scripts/test.mjs'));
  const file = (name, body) => `import assert from 'node:assert/strict';\nimport { test } from 'node:test';\ntest('${name}', () => ${body});\n`;
  await writeFile(join(repo, 'test/e2e.test.js'), file('end to end', '{}'));
  await writeFile(join(repo, 'test/sums.test.js'), file('sums', fail ? 'assert.equal(1 + 1, 3)' : 'assert.equal(1 + 1, 2)'));
  git(dir, 'init', '--quiet', '-b', 'main', repo);
  git(repo, 'add', '.');
  git(repo, 'commit', '--quiet', '-m', 'Add the sums');
  return { dir, repo, data: join(dir, 'data') };
}

// check.mjs, of this checkout, on a commit of that project, two at a time and
// the end-to-end tests in two shares.
const check = (repo, data, env = {}, args = []) =>
  spawnSync(process.execPath, [join(ROOT, 'scripts/check.mjs'), ...args], { cwd: repo, encoding: 'utf8', env: { ...cleanEnv(), KIDS_WORLD_DATA: data, TEST_JOBS: '2', E2E_JOBS: '1', E2E_SHARDS: '2', ...env } });

test('check.mjs times a run from the pre-push hook: in all, copying the commit out, the tests, and each test file; a push of only Markdown is not timed, and one that cannot be written down still runs', async () => {
  const { dir, repo, data } = await project();
  const passed = check(repo, data, { CHECK_HOOK: '1' });
  assert.equal(passed.status, 0, passed.stdout + passed.stderr);
  const [run] = await new TestRuns({ dir: data }).list();
  assert.equal(run.status, 'passed');
  assert.equal(run.commit, git(repo, 'rev-parse', 'HEAD'));
  assert.equal(run.subject, 'Add the sums');
  assert.equal(run.hook, true);
  assert.equal(run.full, false);
  assert.ok(run.copyMs >= 0 && run.testsMs > 0 && run.ms >= run.copyMs + run.testsMs, JSON.stringify(run));
  assert.deepEqual(run.counts, { tests: 3, pass: 3, fail: 0, cancelled: 0, skipped: 0 });
  assert.deepEqual(run.jobs.map((j) => j.name).sort(), ['test/e2e.test.js 1/2', 'test/e2e.test.js 2/2', 'test/sums.test.js']);
  assert.ok(
    run.jobs.every((j) => j.ms > 0 && j.ok !== false && !j.again),
    JSON.stringify(run.jobs),
  );
  assert.deepEqual(run.atOnce, { jobs: 2, e2e: 1, shards: 2, cores: availableParallelism() });
  assert.equal(run.node, process.version);
  assert.ok(Number.isFinite(run.load));

  // Only Markdown since what was pushed: no tests, and no run.
  await writeFile(join(repo, 'README.md'), '# Sums\n');
  git(repo, 'add', '.');
  git(repo, 'commit', '--quiet', '-m', 'Say what it is');
  const docs = check(repo, data, { CHECK_HOOK: '1' }, ['HEAD', git(repo, 'rev-parse', 'HEAD~1')]);
  assert.equal(docs.status, 0);
  assert.match(docs.stdout, /changes only Markdown/);
  assert.equal((await new TestRuns({ dir: data }).list()).length, 1);

  // A data folder that is a file: the run is not timed, and passes all the same.
  const blocked = join(dir, 'blocked');
  await writeFile(blocked, 'not a folder');
  const anyway = check(repo, blocked);
  assert.equal(anyway.status, 0, anyway.stdout + anyway.stderr);
  assert.match(anyway.stdout, /passes/);
});

test('check.mjs times a failing run by hand, with the test file that failed and the time it took run again', async () => {
  const { repo, data } = await project({ fail: true });
  const failed = check(repo, data);
  assert.equal(failed.status, 1, failed.stdout + failed.stderr);
  const [run] = await new TestRuns({ dir: data }).list();
  assert.equal(run.status, 'failed');
  assert.equal(run.hook, false, 'by hand');
  assert.deepEqual(run.failed, ['test/sums.test.js']);
  assert.equal(run.counts.fail, 1);
  const sums = run.jobs.find((j) => j.name === 'test/sums.test.js');
  assert.equal(sums.ok, false);
  assert.ok(sums.again > 0, 'its failed test was run again');
  assert.ok(run.jobs.filter((j) => j.name.startsWith('test/e2e')).every((j) => j.ok !== false));
});
