// The AI friend's words come from a language model served on this computer by
// Ollama (https://ollama.com): its HTTP API, with an answer shaped by a JSON
// schema (structured outputs), so a small model's reply is always something
// to act on. Nothing goes anywhere else. Settings:
//   KIDS_WORLD_AI_URL    where Ollama is (http://127.0.0.1:11434)
//   KIDS_WORLD_AI_MODEL  which model (gemma3:4b); `ollama pull <model>` first
export const DEFAULT_URL = 'http://127.0.0.1:11434';
export const DEFAULT_MODEL = 'gemma3:4b';

const TIMEOUT_MS = 30000;
const OPTIONS = { temperature: 0.7, num_predict: 160 };

export class Ollama {
  constructor({ url = process.env.KIDS_WORLD_AI_URL || DEFAULT_URL, model = process.env.KIDS_WORLD_AI_MODEL || DEFAULT_MODEL, fetch = globalThis.fetch } = {}) {
    this.url = url.replace(/\/+$/, '');
    this.model = model;
    this.fetch = fetch;
    // One answer at a time: a small computer makes them one after another anyway.
    this.queue = Promise.resolve();
  }

  // '' when the model is there to answer, or what is wrong.
  async problem() {
    let tags;
    try {
      const res = await this.fetch(`${this.url}/api/tags`, { signal: AbortSignal.timeout(5000) });
      if (!res.ok) return `Ollama answered ${res.status}`;
      tags = await res.json();
    } catch {
      return `Ollama is not running at ${this.url}`;
    }
    const names = (tags.models ?? []).map((m) => m.name);
    const wanted = this.model.includes(':') ? this.model : `${this.model}:latest`;
    return names.includes(wanted) ? '' : `Ollama has no model ${this.model} (ollama pull ${this.model})`;
  }

  // The models Ollama has, by name ([] when it is not there).
  async models() {
    try {
      const res = await this.fetch(`${this.url}/api/tags`, { signal: AbortSignal.timeout(3000) });
      if (!res.ok) return [];
      return ((await res.json()).models ?? []).map((m) => m.name).sort();
    } catch {
      return [];
    }
  }

  // The model's answer to messages ([{ role, content }]), as the object the
  // schema describes. Throws when there is none in time. trace, when given,
  // is filled in with how it went, for the admin page's model log: when it
  // was sent (after the ones before it), the model's words as they came, and
  // Ollama's own counts and times.
  chat(messages, schema, trace = null) {
    const run = () => this.ask(messages, schema, trace);
    const answer = this.queue.then(run, run);
    this.queue = answer.catch(() => {});
    return answer;
  }

  async ask(messages, schema, trace = null) {
    if (trace) {
      trace.sentAt = Date.now();
      trace.model = this.model;
      trace.options = OPTIONS;
    }
    const res = await this.fetch(`${this.url}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: this.model, messages, stream: false, format: schema, keep_alive: '30m', options: OPTIONS }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) throw new Error(`Ollama answered ${res.status}`);
    const body = await res.json();
    if (trace) {
      const ms = (ns) => (Number.isFinite(ns) ? Math.round(ns / 1e6) : null);
      trace.raw = body.message?.content ?? '';
      trace.ollama = {
        promptTokens: body.prompt_eval_count ?? null,
        tokens: body.eval_count ?? null,
        totalMs: ms(body.total_duration),
        loadMs: ms(body.load_duration),
        promptMs: ms(body.prompt_eval_duration),
        answerMs: ms(body.eval_duration),
        doneReason: body.done_reason ?? '',
      };
    }
    return JSON.parse(body.message?.content ?? '');
  }
}
