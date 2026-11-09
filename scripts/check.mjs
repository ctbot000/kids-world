// The tests, run before a push to main by .githooks/pre-push (CI runs none:
// here they take minutes, there a quarter of an hour). They run on a clean
// copy of the commit being pushed, not the working tree, which other work in
// this checkout may be changing (scripts/test.mjs).
// Kept light, for a fanless laptop that is also being worked on: a push that
// changes only Markdown runs nothing, the end-to-end tests run once, with a
// mouse, a few at a time, and all of it at a lower priority than everything
// else. CHECK_FULL=1 runs them as hard as the computer allows, the end-to-end
// tests also with no mouse, as on a touch screen.
// Each run that tests is timed for the admin page's Tests tab: how long it
// took, and each test file in it (server/test-runs.js).
// Run by hand: npm run check [-- <commit> [<commit already pushed>]]
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, symlinkSync } from 'node:fs';
import { loadavg, setPriority, tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';

const started = Date.now();
const git = (...args) => execFileSync('git', args, { encoding: 'utf8' }).trim();
const root = git('rev-parse', '--show-toplevel');
const commit = git('rev-parse', '--verify', `${process.argv[2] ?? 'HEAD'}^{commit}`);
const full = Boolean(process.env.CHECK_FULL);

// Only Markdown changed since what is already pushed (when this checkout has
// that commit): no test reads it, so there is nothing to run.
if (!full && process.argv[3] && !/^0+$/.test(process.argv[3])) {
  try {
    const pushed = git('rev-parse', '--verify', '--quiet', `${process.argv[3]}^{commit}`);
    const changed = git('diff', '--name-only', pushed, commit).split('\n').filter(Boolean);
    if (changed.every((path) => path.endsWith('.md'))) {
      console.log(`${commit.slice(0, 7)} changes only Markdown: no tests to run`);
      process.exit(0);
    }
  } catch {}
}

const dir = mkdtempSync(join(tmpdir(), 'kids-world-check-'));

// The tests get none of the GIT_ variables git sets for the hook. Pushed from
// a worktree, GIT_DIR is that worktree's own git folder, by its full path: a
// test's `git init` in a folder of its own would then set up the real
// repository again, as bare, and its `git config` would write there.
const clean = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith('GIT_')));

// The packages: this checkout's, or, in a worktree without an npm install of
// its own, the main checkout's (beside the repository's shared git folder).
function modules() {
  const own = join(root, 'node_modules');
  if (existsSync(own)) return own;
  return join(dirname(resolve(root, git('rev-parse', '--git-common-dir'))), 'node_modules');
}

// Niced, which every test and browser started from here inherits, so the
// computer stays quick for whatever else is going on.
if (!full) {
  try {
    setPriority(10);
  } catch {}
}
const light = full ? {} : { TEST_JOBS: '4', E2E_JOBS: '2', E2E_SHARDS: '4' };

function run(label, args, env = {}) {
  console.log(`\n▶ ${label}`);
  const { status } = spawnSync(process.execPath, args, { cwd: dir, stdio: 'inherit', env: { ...clean, ...env } });
  if (status !== 0) throw new Error(`${label}: failed`);
}

// The variables of these names that are set, which win over the light ones.
function pick(env, keys) {
  return Object.fromEntries(keys.filter((key) => env[key]).map((key) => [key, env[key]]));
}

// The run, timed in the keeper's data folder (KIDS_WORLD_DATA, or
// ~/.kids-world), which every checkout and worktree here shares, for the
// admin page; CHECK_HOOK says the pre-push hook started it. Never in the
// tests' way: a run that cannot be written down still runs, and passes or
// fails as they do. Returns what ends it.
async function startTiming() {
  try {
    const [{ TestRuns }, { DEFAULT_DATA_DIR }] = await Promise.all([import('../server/test-runs.js'), import('../server/keeper.js')]);
    const runs = new TestRuns({ dir: process.env.KIDS_WORLD_DATA || DEFAULT_DATA_DIR });
    const subject = git('log', '-1', '--format=%s', commit);
    const run = await runs.start({ commit, subject, hook: Boolean(process.env.CHECK_HOOK), full, load: loadavg()[0], node: process.version, startedAt: started });
    return (result) => runs.end(run, result).catch(() => {});
  } catch {
    return () => {};
  }
}

function readSummary(file) {
  try {
    return JSON.parse(readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

const endTiming = await startTiming();
// Where test.mjs says how it went: each test file's time, for the timing.
const summary = join(dir, '.test-summary.json');
const took = { ok: false, copyMs: null, testsMs: null };
try {
  const copying = Date.now();
  execFileSync('sh', ['-c', `git -C "$1" archive "$2" | tar -x -C "$3"`, 'sh', root, commit, dir], { stdio: 'inherit' });
  symlinkSync(modules(), join(dir, 'node_modules'), 'dir');
  took.copyMs = Date.now() - copying;
  console.log(`Testing ${commit.slice(0, 7)} in ${dir}`);
  const testing = Date.now();
  try {
    if (full) run('all the tests, the end-to-end ones both with a mouse and with none, as on a touch screen', ['scripts/test.mjs', '--touch'], { TEST_SUMMARY: summary });
    else run('all the tests, a few at a time', ['scripts/test.mjs'], { ...light, ...pick(clean, Object.keys(light)), TEST_SUMMARY: summary });
  } finally {
    took.testsMs = Date.now() - testing;
  }
  took.ok = true;
  console.log(`\n✔ ${commit.slice(0, 7)} passes`);
} catch (error) {
  console.error(`\n✖ ${error.message}`);
  process.exitCode = 1;
} finally {
  await endTiming({ ...took, summary: readSummary(summary) });
  rmSync(dir, { recursive: true, force: true });
}
