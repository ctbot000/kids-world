// CTB's run logs (ctb.js): every conversation a worker has with its model —
// a task worked through step by step, a player's idea read, a proposal
// thought up — written down as it goes, for the admin page to show worker by
// worker and to download as a transcript another model can read. Each run is
// a file of JSON lines in <data>/ctb-runs/: what it is (who, which issue,
// the model, the system prompt and the task as the model was given them),
// then each answer from the model (its words as they came, its thinking,
// why it stopped, its tokens and how long it took, or why it failed), each
// tool's result as the model was given it, notes (the unit tests failing,
// work kept from an earlier try), and how it ended. The newest RUNS_KEPT are
// kept.
import { appendFile, mkdir, readdir, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';

export const RUNS_DIR = 'ctb-runs';
export const RUNS_KEPT = 60;
// The most of one text kept in a log line: a whole file written, a test's output.
const TEXT_MAX = 200000;

const clip = (text) => {
  const s = String(text ?? '');
  return s.length > TEXT_MAX ? `${s.slice(0, TEXT_MAX)}\n… (${s.length - TEXT_MAX} more characters not kept)` : s;
};

// What the list of runs says of one, from its events.
function summarize(events) {
  const start = events[0];
  const end = events.findLast((e) => e.type === 'end') ?? null;
  const calls = events.filter((e) => e.type === 'call');
  const sum = (key) => calls.reduce((t, c) => t + (c.usage?.[key] ?? 0), 0);
  return {
    id: start.id,
    kind: start.kind,
    k: start.k,
    worker: start.worker,
    model: start.model,
    issue: start.issue ?? null,
    title: start.title ?? '',
    at: start.at,
    endedAt: end?.at ?? 0,
    ok: end ? end.ok : null,
    why: end?.why ?? '',
    url: end?.url ?? '',
    // Stopped by the server stopping (a restart), not by how it went: a
    // task carries on from it next time (ctb.js).
    stopped: Boolean(end?.stopped),
    resumed: start.resumed ?? '',
    // The steps taken: the last answered (a done or give_up has no result).
    steps: calls.reduce((n, c) => (c.error ? n : Math.max(n, c.step ?? 0)), 0),
    calls: calls.length,
    failed: calls.filter((c) => c.error).length,
    promptTokens: sum('prompt'),
    tokens: sum('completion'),
    last: events.at(-1).at,
  };
}

// One run, being written. Lines are appended one after another, in order.
export class Run {
  constructor(runs, summary, file) {
    this.runs = runs;
    this.summary = summary;
    this.file = file;
    this.writing = Promise.resolve();
    this.events = null;
  }

  add(event) {
    const e = { at: this.runs.now(), ...event };
    this.runs.note(this, e);
    this.writing = this.writing.then(() => appendFile(this.file, `${JSON.stringify(e)}\n`)).catch((error) => this.runs.log(`CTB: a run log could not be written (${error.message}).`));
    return this.writing;
  }

  // One answer from the model. trace: llm.js's, of that answer.
  call({ step = 0, ms = 0, trace = {}, error = null, answer }) {
    return this.add({
      type: 'call',
      step,
      ms,
      model: trace.model ?? '',
      finish: trace.finish ?? '',
      usage: trace.zai ? { prompt: trace.zai.promptTokens, cached: trace.zai.cachedTokens, completion: trace.zai.tokens, reasoning: trace.zai.reasoningTokens } : null,
      reasoning: clip(trace.reasoning),
      raw: clip(trace.raw),
      ...(answer === undefined ? {} : { answer }),
      ...(error ? { error: String(error.message ?? error) } : {}),
    });
  }

  // A step taken, and its result as the model was given it.
  step(n, step, result) {
    return this.add({ type: 'step', n, step, result: clip(result) });
  }

  note(text) {
    return this.add({ type: 'note', text: clip(text) });
  }

  end({ ok, why = '', url = '', stopped = false }) {
    return this.add({ type: 'end', ok, why: clip(why), url, ...(stopped ? { stopped: true } : {}) });
  }
}

export class Runs {
  constructor({ dir, now = Date.now, kept = RUNS_KEPT, log = (text) => console.log(text) }) {
    this.dir = join(dir, RUNS_DIR);
    this.now = now;
    this.kept = kept;
    this.log = log;
    // Summaries by id, oldest first.
    this.index = new Map();
    this.open = new Map();
  }

  // The summaries of the runs already on disk. One with no end was cut off
  // by the server stopping (the keeper's computer, or a restart, which does
  // not wait for a worker): it ends as stopped.
  async load() {
    const files = (await readdir(this.dir).catch(() => [])).filter((f) => f.endsWith('.jsonl')).sort();
    for (const f of files) {
      const events = await this.events(f.slice(0, -'.jsonl'.length)).catch(() => null);
      if (!events?.length || events[0].type !== 'start') continue;
      if (!events.some((e) => e.type === 'end')) {
        const end = { at: events.at(-1).at, type: 'end', ok: false, why: 'The server stopped in the middle of it.', url: '', stopped: true };
        await appendFile(join(this.dir, f), `${JSON.stringify(end)}\n`).catch(() => {});
        events.push(end);
      }
      this.index.set(events[0].id, summarize(events));
    }
    return this;
  }

  // A new run. what: { kind ('task', 'idea', 'bug' or 'proposal'), k, worker,
  // model, issue, title, messages (as first sent to the model) }.
  async start(what) {
    await mkdir(this.dir, { recursive: true });
    const at = this.now();
    let id = `${at}-${what.kind}-${what.k}`;
    for (let n = 2; this.index.has(id); n++) id = `${at}-${what.kind}-${what.k}-${n}`;
    const start = { type: 'start', id, at, ...what, messages: (what.messages ?? []).map((m) => ({ role: m.role, content: clip(m.content) })) };
    const run = new Run(this, summarize([start]), join(this.dir, `${id}.jsonl`));
    run.events = [start];
    this.index.set(id, run.summary);
    this.open.set(id, run);
    await appendFile(run.file, `${JSON.stringify(start)}\n`);
    await this.prune();
    return run;
  }

  // An event of a run, into its summary (the file is written by the run).
  note(run, event) {
    run.events.push(event);
    Object.assign(run.summary, summarize(run.events));
    if (event.type === 'end') this.open.delete(run.summary.id);
  }

  async prune() {
    const ids = [...this.index.keys()];
    for (const id of ids.slice(0, Math.max(0, ids.length - this.kept))) {
      if (this.open.has(id)) continue;
      this.index.delete(id);
      await rm(join(this.dir, `${id}.jsonl`), { force: true });
    }
  }

  // The newest runs first, of one worker (k) or all.
  list(k = null) {
    return [...this.index.values()].filter((s) => k === null || s.k === k).reverse();
  }

  async events(id) {
    if (!/^[\w-]+$/.test(String(id))) return null;
    if (this.open.has(id)) return this.open.get(id).events;
    const text = await readFile(join(this.dir, `${id}.jsonl`), 'utf8').catch(() => null);
    if (text === null) return null;
    // A line cut short (the computer stopped mid-write) is left out.
    return text
      .split('\n')
      .filter(Boolean)
      .flatMap((line) => {
        try {
          return [JSON.parse(line)];
        } catch {
          return [];
        }
      });
  }

  // One run whole: its summary and its events, or null.
  async read(id) {
    const events = await this.events(id);
    if (!events?.length) return null;
    return { summary: this.index.get(id) ?? summarize(events), events };
  }
}

// A run as plain text, to read or to hand to another model to find out what
// went wrong: everything the model was given, and everything it answered.
export function transcript({ summary: s, events }) {
  const out = [];
  const head = (text) => out.push('', `===== ${text} =====`);
  const when = (at) => new Date(at).toISOString();
  out.push(`CTB run ${s.id}: ${s.kind} by ${s.worker} with ${s.model}${s.issue ? `, issue #${s.issue.number} ${s.issue.title}` : ''}`);
  out.push(`Started ${when(s.at)}${s.endedAt ? `, ended ${when(s.endedAt)}: ${s.ok ? 'done' : 'not done'}${s.why ? ` (${s.why.split('\n')[0]})` : ''}${s.url ? ` ${s.url}` : ''}` : ', still running'}`);
  out.push(`${s.steps} steps, ${s.calls} answers from the model (${s.failed} failed), ${s.promptTokens} prompt tokens, ${s.tokens} completion tokens`);
  for (const e of events) {
    if (e.type === 'start') {
      for (const m of e.messages) {
        head(`${m.role} message`);
        out.push(m.content);
      }
    } else if (e.type === 'call') {
      const u = e.usage;
      head(`model answer${e.step ? ` for step ${e.step}` : ''} at ${when(e.at)}, ${(e.ms / 1000).toFixed(1)} s, finish: ${e.finish || '?'}${u ? `, tokens: ${u.prompt} prompt (${u.cached ?? 0} cached), ${u.completion} completion (${u.reasoning ?? 0} reasoning)` : ''}${e.error ? `, FAILED: ${e.error}` : ''}`);
      if (e.reasoning) out.push('--- thinking ---', e.reasoning);
      out.push('--- answer ---', e.raw || '(empty)');
    } else if (e.type === 'step') {
      head(`step ${e.n}: ${e.step?.tool ?? '?'} — result given to the model`);
      out.push(e.result);
    } else if (e.type === 'note') {
      head(`note at ${when(e.at)}`);
      out.push(e.text);
    } else if (e.type === 'end') {
      head(`end at ${when(e.at)}: ${e.ok ? 'done' : 'not done'}`);
      if (e.why) out.push(e.why);
      if (e.url) out.push(e.url);
    }
  }
  return `${out.join('\n')}\n`;
}
