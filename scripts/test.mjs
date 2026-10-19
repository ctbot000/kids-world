// npm test: every test file at once, as many at a time as the computer has
// cores for, with the end-to-end tests shared out between a few processes,
// each with a browser and servers of its own (E2E_SHARD in test/e2e.test.js).
// Whatever took longest last time starts first, so nothing long is left to
// run on its own at the end. A file that passes gets a line; one that fails
// gets everything it printed.
//   npm test -- --touch    also the end-to-end tests with no mouse, as on a touch screen
//   npm test -- <files or node --test flags>    plain node --test, on just those
// E2E_SHARDS (how many processes share the end-to-end tests, for each of mouse
// and touch), TEST_JOBS (how many run at once) and E2E_JOBS (how many of
// those can be end-to-end ones) change how it shares them out.
import { spawn } from 'node:child_process';
import { mkdirSync, readdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { availableParallelism } from 'node:os';

const FLAGS = ['--test', '--test-timeout=180000', '--test-force-exit'];
const args = process.argv.slice(2);
const touch = args.includes('--touch');
const rest = args.filter((arg) => arg !== '--touch');

// None of git's hook variables (a test's git init would find the real
// repository through GIT_DIR), and no NODE_TEST_CONTEXT, with which a
// node --test run from inside one takes itself for a child and fails nothing.
const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith('GIT_') && key !== 'NODE_TEST_CONTEXT'));

if (rest.length) {
  spawn(process.execPath, [...FLAGS, ...rest], { stdio: 'inherit', env }).on('close', (code) => (process.exitCode = code ?? 1));
} else {
  await runAll();
}

async function runAll() {
  const shards = Number(env.E2E_SHARDS) || 6;
  const files = readdirSync('test')
    .filter((name) => name.endsWith('.test.js') && name !== 'e2e.test.js')
    .sort()
    .map((name) => ({ name: `test/${name}`, file: `test/${name}`, env: {} }));
  const e2e = (label, extra) =>
    Array.from({ length: shards }, (_, k) => ({ name: `test/e2e.test.js ${k + 1}/${shards}${label}`, file: 'test/e2e.test.js', e2e: true, env: { ...extra, E2E_SHARD: `${k}/${shards}` } }));
  const jobs = [...e2e('', {}), ...(touch ? e2e(' with no mouse', { E2E_NO_MOUSE: '1' }) : []), ...files];

  // How long each took last time, longest first; the end-to-end ones first the very first time.
  const timesFile = 'node_modules/.cache/kids-world/test-times.json';
  let times = {};
  try {
    times = JSON.parse(readFileSync(timesFile, 'utf8'));
  } catch {}
  const guess = (job) => times[job.name] ?? (job.e2e ? 1e9 : 1e8);
  const waiting = jobs.sort((a, b) => guess(b) - guess(a));

  const cores = availableParallelism();
  const most = Number(env.TEST_JOBS) || Math.max(1, cores - 1);
  const mostE2e = Number(env.E2E_JOBS) || Math.max(1, Math.round(cores / 3));
  const color = process.stdout.isTTY ? { FORCE_COLOR: '1' } : {};
  const started = Date.now();
  const running = new Set();
  const failed = [];
  const again = [];
  const counts = { tests: 0, pass: 0, fail: 0, cancelled: 0, skipped: 0 };
  console.log(`${jobs.length} test files and shares of the end-to-end tests, up to ${most} at once (${mostE2e} end-to-end)`);

  await new Promise((finished) => {
    const next = () => {
      while (running.size < most) {
        const e2eRunning = [...running].filter((job) => job.e2e).length;
        const index = waiting.findIndex((job) => !job.e2e || e2eRunning < mostE2e);
        if (index < 0) break;
        const [job] = waiting.splice(index, 1);
        start(job);
      }
      if (!running.size) finished();
    };
    const start = (job) => {
      running.add(job);
      const begun = Date.now();
      const child = spawn(process.execPath, [...FLAGS, '--test-reporter=spec', job.file], { env: { ...env, ...color, ...job.env }, stdio: ['ignore', 'pipe', 'pipe'] });
      let output = '';
      child.stdout.on('data', (chunk) => (output += chunk));
      child.stderr.on('data', (chunk) => (output += chunk));
      child.on('close', (code) => {
        running.delete(job);
        const took = Date.now() - begun;
        times[job.name] = took;
        const plain = output.replace(/\x1b\[[0-9;]*m/g, '');
        const count = (what) => Number(plain.match(new RegExp(`^ℹ ${what} (\\d+)$`, 'm'))?.[1] ?? 0);
        for (const what of Object.keys(counts)) counts[what] += count(what);
        if (code === 0) {
          console.log(`✔ ${job.name}: ${count('tests')} tests, ${seconds(took)}`);
        } else {
          failed.push(job.name);
          console.log(`\n✖ ${job.name}: failed after ${seconds(took)} (exit ${code})\n${output.trimEnd()}\n`);
          // A failed test of a share, to run again by itself (and at its own line, which a share does not report).
          const names = plain.split('✖ failing tests:')[1]?.match(/^✖ .+(?= \([\d.]+ms\)$)/gm) ?? [];
          if (job.e2e) for (const name of new Set(names)) again.push(`${job.env.E2E_NO_MOUSE ? 'E2E_NO_MOUSE=1 ' : ''}node --test --test-force-exit --test-name-pattern=${quote(escape(name.slice(2)))} ${job.file}`);
        }
        next();
      });
    };
    next();
  });

  try {
    mkdirSync('node_modules/.cache/kids-world', { recursive: true });
    writeFileSync(`${timesFile}.${process.pid}`, JSON.stringify(times, null, 1));
    renameSync(`${timesFile}.${process.pid}`, timesFile);
  } catch {}
  const took = seconds(Date.now() - started);
  const tally = `${counts.pass} of ${counts.tests} tests passed${counts.skipped ? `, ${counts.skipped} skipped` : ''}`;
  if (failed.length) {
    console.log(`✖ ${tally}, ${counts.fail} failed${counts.cancelled ? `, ${counts.cancelled} cancelled` : ''}, in ${took}: ${failed.join(', ')}`);
    if (again.length) console.log(`To run a failed end-to-end test again by itself:\n${again.join('\n')}`);
    process.exitCode = 1;
  } else {
    console.log(`✔ ${tally}, in ${took}`);
  }
}

// A test's name as a pattern that matches only it.
function escape(name) {
  return `^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`;
}

// Quoted for the shell.
function quote(text) {
  return `'${text.replaceAll("'", "'\\''")}'`;
}

function seconds(ms) {
  const s = Math.round(ms / 1000);
  return s < 60 ? `${s} s` : `${Math.floor(s / 60)} min ${s % 60} s`;
}
