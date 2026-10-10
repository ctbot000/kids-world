// The AI friend's words come from a language model: from Z.ai
// (https://z.ai, the GLM models) over the internet, and when that cannot
// answer — no key, no internet, out of credit — from one served on this
// computer by Ollama (https://ollama.com). Both are asked the same way, with
// the answer shaped by a JSON schema, so a small model's reply is always
// something to act on. What is said on an island goes to the model that
// answers it and nowhere else. Settings:
//   ZAI_API_KEY            a Z.ai API key (or KIDS_WORLD_ZAI_API_KEY)
//   KIDS_WORLD_ZAI_MODEL   which GLM model (glm-5.3-flash)
//   KIDS_WORLD_ZAI_URL     Z.ai somewhere else (by default its two endpoints
//                          are tried in turn: the general one, then the one
//                          for a GLM Coding Plan key)
//   KIDS_WORLD_AI_URL      where Ollama is (http://127.0.0.1:11434)
//   KIDS_WORLD_AI_MODEL    which model it has (gemma3:4b); `ollama pull` first
export const DEFAULT_URL = 'http://127.0.0.1:11434';
export const DEFAULT_MODEL = 'gemma3:4b';
export const ZAI_URLS = ['https://api.z.ai/api/paas/v4', 'https://api.z.ai/api/coding/paas/v4'];
export const DEFAULT_ZAI_MODEL = 'glm-5.3-flash';

const TIMEOUT_MS = 30000;
const OPTIONS = { temperature: 0.7, num_predict: 160 };
const ZAI_OPTIONS = { temperature: 0.7, max_tokens: 200 };

export class Ollama {
  constructor({ url = process.env.KIDS_WORLD_AI_URL || DEFAULT_URL, model = process.env.KIDS_WORLD_AI_MODEL || DEFAULT_MODEL, fetch = globalThis.fetch } = {}) {
    this.name = 'Ollama';
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

// Z.ai over the GLM models' OpenAI-shaped HTTP API: the model's answer as
// the object the schema describes, asked for in words and answered in JSON
// mode (Z.ai has no schema parameter to send along). A key may be for either
// of Z.ai's endpoints (a GLM Coding Plan key works only on its own, while
// both list models for any good key), so one tiny question looks for the one
// its key can chat on, remembered after.
export class Zai {
  constructor({ urls = process.env.KIDS_WORLD_ZAI_URL ? [process.env.KIDS_WORLD_ZAI_URL] : ZAI_URLS, model = process.env.KIDS_WORLD_ZAI_MODEL || DEFAULT_ZAI_MODEL, key = process.env.KIDS_WORLD_ZAI_API_KEY || process.env.ZAI_API_KEY || '', fetch = globalThis.fetch } = {}) {
    this.name = 'Z.ai';
    this.urls = urls.map((url) => url.replace(/\/+$/, ''));
    this.url = this.urls[0];
    this.model = model;
    this.key = key;
    this.fetch = fetch;
    // The endpoint that took the key, once found.
    this.where = null;
  }

  headers() {
    return { 'Content-Type': 'application/json', Authorization: `Bearer ${this.key}` };
  }

  // The endpoint where this key can chat, looked for with one tiny question
  // and remembered: null when it works nowhere.
  async pick() {
    if (this.where) return this.where;
    for (const url of this.urls) {
      let res;
      try {
        res = await this.fetch(`${url}/chat/completions`, {
          method: 'POST',
          headers: this.headers(),
          body: JSON.stringify({ model: this.model, messages: [{ role: 'user', content: 'hi' }], max_tokens: 1, stream: false }),
          signal: AbortSignal.timeout(10000),
        });
      } catch {
        continue; // not there; perhaps the other endpoint
      }
      if (res.ok) {
        this.where = url;
        this.url = url;
        return url;
      }
    }
    return null;
  }

  // The GLM models to pick from on the admin page ([] when it is not there).
  async models() {
    const url = await this.pick();
    if (!url) return [];
    try {
      const res = await this.fetch(`${url}/models`, { headers: this.headers(), signal: AbortSignal.timeout(5000) });
      if (!res.ok) return [];
      return ((await res.json()).data ?? []).map((m) => m.id).sort();
    } catch {
      return [];
    }
  }

  // '' when the model is there to answer, or what is wrong.
  async problem() {
    if (!this.key) return 'Z.ai has no API key (ZAI_API_KEY)';
    if (!(await this.pick())) return 'Z.ai is not answering (or the API key is no good)';
    const names = await this.models();
    return names.length && !names.includes(this.model) ? `Z.ai has no model ${this.model}` : '';
  }

  // The model's answer to messages ([{ role, content }]), as the object the
  // schema describes. Throws when there is none in time. trace, when given,
  // is filled in for the admin page's model log, like Ollama's.
  async chat(messages, schema, trace = null) {
    if (!this.key) throw new Error('Z.ai has no API key (ZAI_API_KEY)');
    const url = await this.pick();
    if (!url) throw new Error('Z.ai is not answering (or the API key is no good)');
    if (trace) {
      trace.sentAt = Date.now();
      trace.model = this.model;
      trace.options = ZAI_OPTIONS;
    }
    const said = [...messages, { role: 'system', content: `Answer with one JSON object only, nothing else, following this JSON schema exactly: ${JSON.stringify(schema)}` }];
    const res = await this.fetch(`${url}/chat/completions`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify({ model: this.model, messages: said, stream: false, temperature: ZAI_OPTIONS.temperature, max_tokens: ZAI_OPTIONS.max_tokens, response_format: { type: 'json_object' } }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) throw new Error(await this.trouble(res));
    const body = await res.json();
    const words = body.choices?.[0]?.message?.content ?? '';
    if (trace) {
      trace.raw = words;
      trace.zai = { promptTokens: body.usage?.prompt_tokens ?? null, tokens: body.usage?.completion_tokens ?? null };
    }
    return this.read(words);
  }

  // Why an answer failed, in Z.ai's own words when it says.
  async trouble(res) {
    let why = '';
    try {
      const body = await res.json();
      why = body.error?.message ?? body.message ?? '';
    } catch {}
    return `Z.ai answered ${res.status}${why ? `: ${why}` : ''}`;
  }

  // The JSON in the model's words, in case it said more around it.
  read(words) {
    try {
      return JSON.parse(words);
    } catch {
      const from = words.indexOf('{');
      const to = words.lastIndexOf('}');
      if (from !== -1 && to > from) return JSON.parse(words.slice(from, to + 1));
      throw new Error('Z.ai said nothing it could read');
    }
  }
}

// A model to ask first (Z.ai), and a local one (Ollama) to answer when it
// cannot: what the AI friend talks with, either one filling the same role.
// One problem() covers both — it can answer when either is there — and keeps
// each one's own problem for the admin page.
export class Fallback {
  constructor(primary, local) {
    this.primary = primary;
    this.local = local;
    // The one that answered the last question, and each one's own problem
    // from the last look.
    this.using = primary;
    this.problems = {};
  }

  get model() {
    return this.using.model;
  }

  set model(model) {
    this.primary.model = model;
  }

  get url() {
    return this.primary.url;
  }

  models() {
    return this.primary.models();
  }

  // '' when either can answer, or what is wrong with both.
  async problem() {
    const looks = await Promise.all([this.primary, this.local].map(async (llm) => [llm.name, await llm.problem().catch((error) => error.message)]));
    this.problems = Object.fromEntries(looks);
    const wrong = looks.map(([, problem]) => problem).filter(Boolean);
    return wrong.length === 2 ? wrong.join('; ') : '';
  }

  // What the admin page shows of the two.
  states() {
    return [this.primary, this.local].map((llm) => ({ name: llm.name, url: llm.url, model: llm.model, problem: this.problems[llm.name] ?? '' }));
  }

  // The first one's answer, or the local one's when it cannot (no key, no
  // internet, out of credit): the trace says why it changed, and the local
  // one's own trace is what remains, as its answer is what is used.
  async chat(messages, schema, trace = null) {
    let error;
    try {
      const answer = await this.primary.chat(messages, schema, trace);
      this.using = this.primary;
      return answer;
    } catch (e) {
      error = e;
    }
    if (trace) trace.fellBack = error.message;
    const answer = await this.local.chat(messages, schema, trace);
    this.using = this.local;
    return answer;
  }
}
