// The tests, run before a push to main by .githooks/pre-push (CI runs none:
// here they take minutes, there a quarter of an hour). They run on a clean
// copy of the commit being pushed, not the working tree, which other work in
// this checkout may be changing; the end-to-end tests run twice, with a mouse
// and without one, as on a touch screen, all at once (scripts/test.mjs).
// Run by hand: npm run check [-- <commit>]
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const git = (...args) => execFileSync('git', args, { encoding: 'utf8' }).trim();
const root = git('rev-parse', '--show-toplevel');
const commit = git('rev-parse', '--verify', `${process.argv[2] ?? 'HEAD'}^{commit}`);
const dir = mkdtempSync(join(tmpdir(), 'kids-world-check-'));

// The tests get none of the GIT_ variables git sets for the hook. Pushed from
// a worktree, GIT_DIR is that worktree's own git folder, by its full path: a
// test's `git init` in a folder of its own would then set up the real
// repository again, as bare, and its `git config` would write there.
const clean = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith('GIT_')));

function run(label, args, env = {}) {
  console.log(`\n▶ ${label}`);
  const { status } = spawnSync(process.execPath, args, { cwd: dir, stdio: 'inherit', env: { ...clean, ...env } });
  if (status !== 0) throw new Error(`${label}: failed`);
}

try {
  execFileSync('sh', ['-c', `git -C "$1" archive "$2" | tar -x -C "$3"`, 'sh', root, commit, dir], { stdio: 'inherit' });
  symlinkSync(join(root, 'node_modules'), join(dir, 'node_modules'), 'dir');
  console.log(`Testing ${commit.slice(0, 7)} in ${dir}`);
  run('all the tests, the end-to-end ones both with a mouse and with none, as on a touch screen', ['scripts/test.mjs', '--touch']);
  console.log(`\n✔ ${commit.slice(0, 7)} passes`);
} catch (error) {
  console.error(`\n✖ ${error.message}`);
  process.exitCode = 1;
} finally {
  rmSync(dir, { recursive: true, force: true });
}
