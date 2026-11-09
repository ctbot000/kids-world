// The tests run before each push to main (scripts/check.mjs, which the
// pre-push hook runs, as does npm run check by hand), timed for the admin
// page's Tests tab. Each run is a JSON file in <data>/test-runs/ (the keeper's
// data folder, so every checkout and worktree on this computer writes to the
// one place), written as it starts, running, and again as it ends: whether it
// passed, how long it took in all, copying the commit out and running the
// tests, the tests' counts, and how long each test file and each share of the
// end-to-end tests took (scripts/test.mjs's TEST_SUMMARY). One still marked
// running whose process is gone was cut off (Ctrl+C on a push, say) and reads
// as stopped. The newest TEST_RUNS_KEPT are kept.
import { mkdir, readdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

export const TEST_RUNS_DIR = 'test-runs';
export const TEST_RUNS_KEPT = 100;
// How long a run usually takes: of the newest this many of its kind (light,
// the pre-push hook's, or full, CHECK_FULL's) that passed.
export const USUAL_OF = 20;
// Longer than any run takes: one still marked running after this was cut off,
// whatever its process id says (the system gives ids out again).
const LONGEST_MS = 60 * 60 * 1000;
const FILE = /^\d+-\d+\.json$/;
const ID = /^\d+-\d+$/;

// Whether a process is there (another user's is, though it cannot be signalled).
function isAlive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error.code === 'EPERM';
  }
}

export function median(values) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  return sorted.length % 2 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
}

const jobsOf = (run) => (Array.isArray(run.jobs) ? run.jobs.filter((j) => typeof j?.name === 'string' && Number.isFinite(j.ms)) : []);

// A run as the list shows it: what it tested, when, how long it took and how it went.
function brief(run) {
  return {
    id: run.id,
    commit: run.commit ?? '',
    subject: run.subject ?? '',
    hook: Boolean(run.hook),
    full: Boolean(run.full),
    startedAt: run.startedAt,
    status: run.status,
    ms: run.ms ?? null,
    counts: run.counts ?? null,
    flaky: Array.isArray(run.flaky) ? run.flaky.length : 0,
    failed: Array.isArray(run.failed) ? run.failed : [],
  };
}

// How long each test file (and share of the end-to-end tests) took in the
// latest run that passed, longest first, beside how long it usually takes:
// over the runs of its kind that passed (passed, which has it among them).
function filesOf(latest, passed) {
  const times = new Map();
  for (const run of passed) for (const job of jobsOf(run)) times.set(job.name, [...(times.get(job.name) ?? []), job.ms]);
  return {
    run: { id: latest.id, commit: latest.commit ?? '', subject: latest.subject ?? '', startedAt: latest.startedAt, ms: latest.ms ?? null, full: Boolean(latest.full) },
    files: jobsOf(latest)
      .map((job) => ({ name: job.name, ms: job.ms, again: job.again ?? 0, usual: median(times.get(job.name) ?? []), runs: times.get(job.name)?.length ?? 0 }))
      .sort((a, b) => b.ms - a.ms),
  };
}

export class TestRuns {
  constructor({ dir, now = Date.now, kept = TEST_RUNS_KEPT, alive = isAlive }) {
    this.dir = join(dir, TEST_RUNS_DIR);
    this.now = now;
    this.kept = kept;
    this.alive = alive;
    // The runs read so far, by file name: one that has ended never changes.
    this.cache = new Map();
  }

  // A run starting (check.mjs). what: { commit, subject, hook, full, load,
  // node, startedAt (now, if not given), pid (this process's) }. Returns it
  // as written, for end().
  async start(what) {
    // Whole milliseconds: the file's name is its id, and only digits are read back.
    const startedAt = Math.round(what.startedAt ?? this.now());
    const pid = what.pid ?? process.pid;
    const run = { ...what, id: `${startedAt}-${pid}`, pid, startedAt, status: 'running' };
    await mkdir(this.dir, { recursive: true });
    await this.write(run);
    await this.prune();
    return run;
  }

  // How a run ended (check.mjs): ok, the time copying the commit out and
  // running the tests, and test.mjs's summary of them (null without one).
  async end(run, { ok, copyMs = null, testsMs = null, summary = null }) {
    const endedAt = this.now();
    const ended = { ...run, status: ok ? 'passed' : 'failed', endedAt, ms: endedAt - run.startedAt, copyMs, testsMs };
    if (summary) {
      const { counts = null, jobs = [], flaky = [], failed = [], heldMs = 0, atOnce = null } = summary;
      Object.assign(ended, { counts, jobs, flaky, failed, heldMs, atOnce });
    }
    await this.write(ended);
    return ended;
  }

  // Whole or not at all: written under another name first, so a reader never
  // finds half of one.
  async write(run) {
    const file = join(this.dir, `${run.id}.json`);
    const temp = `${file}.${process.pid}.tmp`;
    await writeFile(temp, JSON.stringify(run));
    await rename(temp, file);
  }

  // The runs' files, oldest first.
  async names() {
    const names = (await readdir(this.dir).catch(() => [])).filter((name) => FILE.test(name));
    return names.sort((a, b) => parseInt(a, 10) - parseInt(b, 10) || a.localeCompare(b));
  }

  async prune() {
    const names = await this.names();
    for (const name of names.slice(0, Math.max(0, names.length - this.kept))) await rm(join(this.dir, name), { force: true });
  }

  // A run marked running whose process is gone, or that has been at it
  // longer than any run takes, was cut off.
  state(run) {
    if (run.status !== 'running' || (this.now() - run.startedAt < LONGEST_MS && this.alive(run.pid))) return run;
    return { ...run, status: 'stopped' };
  }

  async readRun(name) {
    const run = await readFile(join(this.dir, name), 'utf8')
      .then(JSON.parse)
      .catch(() => null);
    return run && typeof run === 'object' && ID.test(String(run.id)) && Number.isFinite(run.startedAt) ? run : null;
  }

  // Every run kept, newest first.
  async list() {
    const names = await this.names();
    const kept = new Set(names);
    for (const name of this.cache.keys()) if (!kept.has(name)) this.cache.delete(name);
    const runs = [];
    for (const name of names.reverse()) {
      let run = this.cache.get(name);
      if (!run || run.status === 'running') {
        run = await this.readRun(name);
        if (!run) continue;
        this.cache.set(name, run);
      }
      runs.push(this.state(run));
    }
    return runs;
  }

  // One run whole, with the time of each of its test files, or null.
  async run(id) {
    if (!ID.test(String(id))) return null;
    const run = await this.readRun(`${id}.json`);
    return run && this.state(run);
  }

  // What the Tests tab shows: every run kept in brief, newest first; how long
  // a run usually takes, light and full, and its fastest and slowest; and how
  // long each test file took in the latest run that passed.
  async summary() {
    const runs = await this.list();
    const passed = (full) => runs.filter((r) => r.status === 'passed' && Boolean(r.full) === full).slice(0, USUAL_OF);
    const usual = {};
    for (const [kind, full] of Object.entries({ light: false, full: true })) {
      const ms = passed(full).map((r) => r.ms).filter(Number.isFinite);
      usual[kind] = ms.length ? { runs: ms.length, median: median(ms), fastest: Math.min(...ms), slowest: Math.max(...ms) } : null;
    }
    const latest = runs.find((r) => r.status === 'passed' && jobsOf(r).length);
    return {
      dir: this.dir,
      kept: this.kept,
      usualOf: USUAL_OF,
      usual,
      runs: runs.map(brief),
      files: latest ? filesOf(latest, passed(Boolean(latest.full))) : null,
    };
  }
}
