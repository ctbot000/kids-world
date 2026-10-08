// The tests, run before a push to main by .githooks/pre-push (CI runs none:
// here they take minutes, there a quarter of an hour). They run on a clean
// copy of the commit being pushed, not the working tree, which other work in
// this checkout may be changing; the end-to-end tests run twice, with a mouse
// and without one, as on a touch screen.
// Run by hand: npm run check [-- <commit>]
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const git = (...args) => execFileSync('git', args, { encoding: 'utf8' }).trim();
const root = git('rev-parse', '--show-toplevel');
const commit = git('rev-parse', '--verify', `${process.argv[2] ?? 'HEAD'}^{commit}`);
const dir = mkdtempSync(join(tmpdir(), 'kids-world-check-'));

function run(label, args, env = {}) {
  console.log(`\n▶ ${label}`);
  const { status } = spawnSync(process.execPath, args, { cwd: dir, stdio: 'inherit', env: { ...process.env, ...env } });
  if (status !== 0) throw new Error(`${label}: failed`);
}

try {
  execFileSync('sh', ['-c', `git -C "$1" archive "$2" | tar -x -C "$3"`, 'sh', root, commit, dir], { stdio: 'inherit' });
  symlinkSync(join(root, 'node_modules'), join(dir, 'node_modules'), 'dir');
  console.log(`Testing ${commit.slice(0, 7)} in ${dir}`);
  run('all the tests, with a mouse', ['--test', '--test-timeout=180000', '--test-force-exit']);
  run('the end-to-end tests with no mouse, as on a touch screen', ['--test', '--test-timeout=180000', '--test-force-exit', 'test/e2e.test.js'], { E2E_NO_MOUSE: '1' });
  console.log(`\n✔ ${commit.slice(0, 7)} passes`);
} catch (error) {
  console.error(`\n✖ ${error.message}`);
  process.exitCode = 1;
} finally {
  rmSync(dir, { recursive: true, force: true });
}
