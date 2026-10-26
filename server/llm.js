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
// CTB's workers do real work, so they think with Z.ai's best model unless
// the admin page picks another (KIDS_WORLD_CTB_MODEL until then).
export const DEFAULT_CTB_MODEL = 'glm-5.3';
// What reads a picture for CTB (a problem report's, Zai.see): the GLM models
// it works with read only text.
export const ZAI_VISION_MODEL = 'glm-4.6v';

const TIMEOUT_MS = 30000;

// Z.ai's list prices, US dollars per million tokens in (the prompt) and out,
// from https://docs.z.ai/guides/overview/pricing (2026-10-17), for the admin
// page's cost of each model. The cheaper price of a cached prompt is not
// counted, so a cost is at most this much. Ollama runs locally at no cost.
const ZAI_PRICES = {
  'glm-5.3-flash': [0.15, 0.5],
  'glm-5.3-flashx': [0.37, 1.25],
  'glm-5.3': [1.4, 4.4],
  'glm-5.2': [1.4, 4.4],
  'glm-5.1': [1.4, 4.4],
  'glm-5': [1, 3.2],
  'glm-4.7': [0.6, 2.2],
  'glm-4.6': [0.6, 2.2],
  'glm-4.7-flashx': [0.07, 0.4],
  'glm-4.5': [0.6, 2.2],
  'glm-4.5-x': [2.2, 8.9],
  'glm-4.5-air': [0.2, 1.1],
  'glm-4.5-airx': [1.1, 4.5],
  'glm-4-32b-0414-128k': [0.1, 0.1],
  'glm-4.7-flash': [0, 0],
  'glm-4.5-flash': [0, 0],
  'glm-4.6v': [0.3, 0.9],
};

// What tokens of a model (by who serves it, as in spent) cost in US dollars,
// or null when its price is not known.
export function costOf(name, model, promptTokens, tokens) {
  const price = name === 'Ollama' ? [0, 0] : name === 'Z.ai' ? ZAI_PRICES[model.toLowerCase()] : null;
  return price ? (promptTokens * price[0] + tokens * price[1]) / 1e6 : null;
}

// The tokens one answer took, added to the trace's usage: one entry for each
// model that answered (Z.ai's, then Ollama's when it fell back), counted on
// the admin page whether or not the answer was any good.
function spent(trace, llm, promptTokens, tokens, model = llm.model) {
  const count = (n) => (Number.isFinite(n) && n >= 0 ? n : 0);
  (trace.usage ??= []).push({ name: llm.name, model, promptTokens: count(promptTokens), tokens: count(tokens) });
}
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
  chat(messages, schema, trace = null, opts = {}) {
    const run = () => this.ask(messages, schema, trace, opts);
    const answer = this.queue.then(run, run);
    this.queue = answer.catch(() => {});
    return answer;
  }

  async ask(messages, schema, trace = null, opts = {}) {
    const options = { ...OPTIONS, ...(opts.maxTokens ? { num_predict: opts.maxTokens } : {}), ...(opts.temperature !== undefined ? { temperature: opts.temperature } : {}) };
    if (trace) {
      trace.sentAt = Date.now();
      trace.model = this.model;
      trace.options = options;
    }
    const res = await this.fetch(`${this.url}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: this.model, messages, stream: false, format: schema, keep_alive: '30m', options }),
      signal: AbortSignal.timeout(opts.timeoutMs ?? TIMEOUT_MS),
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
      spent(trace, this, body.prompt_eval_count, body.eval_count);
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
    let busy = null;
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
        this.busy = null;
        return url;
      }
      const why = await this.trouble(res);
      if (why.busy) busy = why;
    }
    // Busy somewhere (overloaded, say) is worth trying again later, unlike a
    // key that works nowhere: chat() says which.
    this.busy = busy;
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
  // is filled in for the admin page's model log, like Ollama's. opts: longer
  // answers and more time for them (maxTokens, timeoutMs), and temperature,
  // for CTB's workers (ctb.js), who write code rather than one short line.
  async chat(messages, schema, trace = null, opts = {}) {
    if (!this.key) throw new Error('Z.ai has no API key (ZAI_API_KEY)');
    const url = await this.pick();
    if (!url) throw this.busy ?? new Error('Z.ai is not answering (or the API key is no good)');
    const options = { ...ZAI_OPTIONS, ...(opts.maxTokens ? { max_tokens: opts.maxTokens } : {}), ...(opts.temperature !== undefined ? { temperature: opts.temperature } : {}) };
    if (trace) {
      trace.sentAt = Date.now();
      trace.model = this.model;
      trace.options = options;
    }
    const said = [...messages, { role: 'system', content: `Answer with one JSON object only, nothing else, following this JSON schema exactly: ${JSON.stringify(schema)}` }];
    const res = await this.fetch(`${url}/chat/completions`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify({ model: this.model, messages: said, stream: false, temperature: options.temperature, max_tokens: options.max_tokens, response_format: { type: 'json_object' } }),
      signal: AbortSignal.timeout(opts.timeoutMs ?? TIMEOUT_MS),
    });
    if (!res.ok) throw await this.trouble(res);
    const body = await res.json();
    const words = body.choices?.[0]?.message?.content ?? '';
    if (trace) {
      trace.raw = words;
      // The model's thinking and why it stopped, for CTB's run logs.
      trace.reasoning = body.choices?.[0]?.message?.reasoning_content ?? '';
      trace.finish = body.choices?.[0]?.finish_reason ?? '';
      trace.zai = { promptTokens: body.usage?.prompt_tokens ?? null, tokens: body.usage?.completion_tokens ?? null, cachedTokens: body.usage?.prompt_tokens_details?.cached_tokens ?? null, reasoningTokens: body.usage?.completion_tokens_details?.reasoning_tokens ?? null };
      spent(trace, this, body.usage?.prompt_tokens, body.usage?.completion_tokens);
    }
    // GLM now and then thinks its whole answer and leaves the answer itself
    // empty: the JSON at the end of its thinking is that answer.
    if (!words.trim()) return this.read(body.choices?.[0]?.message?.reasoning_content ?? '', { last: true });
    return this.read(words);
  }

  // What a picture (a data: URL) shows, in words, as a vision model
  // (ZAI_VISION_MODEL) answers what is asked of it: '' when it says nothing.
  // trace as for chat, its usage under that model.
  async see(image, question, trace = null, { model = ZAI_VISION_MODEL, maxTokens = 1500, timeoutMs = 120000 } = {}) {
    if (!this.key) throw new Error('Z.ai has no API key (ZAI_API_KEY)');
    const url = await this.pick();
    if (!url) throw this.busy ?? new Error('Z.ai is not answering (or the API key is no good)');
    if (trace) {
      trace.sentAt = Date.now();
      trace.model = model;
    }
    const res = await this.fetch(`${url}/chat/completions`, {
      method: 'POST',
      headers: this.headers(),
      // Thinking off: left on, it can spend every token thinking and say nothing.
      body: JSON.stringify({ model, stream: false, temperature: 0.2, max_tokens: maxTokens, thinking: { type: 'disabled' }, messages: [{ role: 'user', content: [{ type: 'image_url', image_url: { url: image } }, { type: 'text', text: question }] }] }),
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) throw await this.trouble(res);
    const body = await res.json();
    const words = String(body.choices?.[0]?.message?.content ?? '').trim();
    if (trace) {
      trace.raw = words;
      trace.reasoning = body.choices?.[0]?.message?.reasoning_content ?? '';
      trace.finish = body.choices?.[0]?.finish_reason ?? '';
      spent(trace, this, body.usage?.prompt_tokens, body.usage?.completion_tokens, model);
    }
    return words;
  }

  // Why an answer failed, in Z.ai's own words when it says, as an error.
  // busy: worth trying again in a while, as Z.ai is overloaded or down for a
  // moment (a 429 or a 5xx), not out of credit (a 429 with its code 1113);
  // waitMs: how long it asked to be left alone (Retry-After), when it said.
  async trouble(res) {
    let why = '';
    let code = '';
    try {
      const body = await res.json();
      why = body.error?.message ?? body.message ?? '';
      code = String(body.error?.code ?? body.code ?? '');
    } catch {}
    const error = new Error(`Z.ai answered ${res.status}${why ? `: ${why}` : ''}`);
    error.status = res.status;
    error.busy = (res.status === 429 && code !== '1113') || res.status >= 500;
    const after = Number(res.headers?.get('retry-after'));
    if (after > 0) error.waitMs = after * 1000;
    return error;
  }

  // The JSON in the model's words, in case it said more around it. last:
  // the last JSON object in them (its thinking, which has words before).
  read(words, { last = false } = {}) {
    try {
      return JSON.parse(words);
    } catch {
      const to = words.lastIndexOf('}');
      if (last) {
        // It may end on a stray brace or two after the object.
        const ends = [to];
        while (ends.length < 3 && ends.at(-1) > 0) {
          const end = words.lastIndexOf('}', ends.at(-1) - 1);
          if (end === -1) break;
          ends.push(end);
        }
        for (const end of ends) {
          for (let from = words.lastIndexOf('{', end); from !== -1; from = from ? words.lastIndexOf('{', from - 1) : -1) {
            try {
              const found = JSON.parse(words.slice(from, end + 1));
              if (found && typeof found === 'object') return found;
            } catch {}
          }
        }
        throw new Error('Z.ai said nothing it could read');
      }
      const from = words.indexOf('{');
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
  async chat(messages, schema, trace = null, opts = {}) {
    let error;
    try {
      const answer = await this.primary.chat(messages, schema, trace, opts);
      this.using = this.primary;
      return answer;
    } catch (e) {
      error = e;
    }
    if (trace) trace.fellBack = error.message;
    const answer = await this.local.chat(messages, schema, trace, opts);
    this.using = this.local;
    return answer;
  }
}
