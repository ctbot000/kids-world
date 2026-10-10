// The AI friend's two models: Z.ai over the internet, and the local Ollama
// for when it cannot answer. The Z.ai client looks for the endpoint its key
// can chat on with one tiny question (a GLM Coding Plan key works only on
// its own, while both list models for any good key), asks with the answer's
// shape in words (Z.ai has no schema parameter to send along), and reads the
// JSON out of what comes back even when words come around it. The fallback
// answers with the local model when the first cannot, and says it can
// answer — problem() — when either one is there.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Fallback, Ollama, Zai } from '../server/llm.js';

const SCHEMA = { type: 'object', properties: { say: { type: 'string' } }, required: ['say'] };

test('the Z.ai client asks with the answer shape in words, and reads its JSON', async () => {
  const sent = [];
  const fetch = async (url, init = {}) => {
    if (init.body) sent.push({ url, headers: init.headers, body: JSON.parse(init.body) });
    return new Response(JSON.stringify({ choices: [{ message: { content: 'Sure! {"say":"Hi!"}' } }], usage: { prompt_tokens: 90, completion_tokens: 8 } }));
  };
  const llm = new Zai({ urls: ['https://z.test/v4'], model: 'glm-5.3-flash', key: 'a key', fetch });
  const trace = {};
  assert.deepEqual(await llm.chat([{ role: 'user', content: 'hi' }], SCHEMA, trace), { say: 'Hi!' });
  assert.equal(trace.model, 'glm-5.3-flash');
  assert.equal(trace.raw, 'Sure! {"say":"Hi!"}');
  assert.deepEqual(trace.zai, { promptTokens: 90, tokens: 8 });
  assert.ok(trace.sentAt > 0);
  assert.equal(sent[0].body.max_tokens, 1, 'one tiny question looks for its endpoint first');
  const asked = sent.at(-1);
  assert.equal(asked.headers.Authorization, 'Bearer a key');
  assert.equal(asked.body.response_format.type, 'json_object');
  assert.equal(asked.body.model, 'glm-5.3-flash');
  assert.deepEqual(asked.body.messages[0], { role: 'user', content: 'hi' });
  assert.match(asked.body.messages.at(-1).content, /one JSON object only/);
  assert.match(asked.body.messages.at(-1).content, /"say"/);
  // Without a trace, as before.
  assert.deepEqual(await llm.chat([{ role: 'user', content: 'hi' }], SCHEMA), { say: 'Hi!' });
});

test('the Z.ai client chats on the endpoint its key works on, and remembers it', async () => {
  const asked = [];
  const fetch = async (url) => {
    asked.push(url);
    if (url === 'https://one.test/v4/chat/completions') return new Response('{}', { status: 429 });
    if (url === 'https://two.test/v4/chat/completions') return Response.json({ choices: [{ message: { content: '{}' } }] });
    if (url === 'https://two.test/v4/models') return Response.json({ data: [{ id: 'glm-4.6' }, { id: 'glm-5.3-flash' }] });
    throw new Error(`should not ask ${url}`);
  };
  const llm = new Zai({ urls: ['https://one.test/v4', 'https://two.test/v4'], model: 'glm-4.6', key: 'a key', fetch });
  assert.equal(await llm.problem(), '');
  assert.deepEqual(await llm.models(), ['glm-4.6', 'glm-5.3-flash']);
  assert.equal(llm.url, 'https://two.test/v4');
  await llm.problem();
  assert.equal(asked.filter((url) => url.includes('one.test')).length, 1, 'the endpoint is remembered');
  llm.model = 'glm-9';
  assert.equal(await llm.problem(), 'Z.ai has no model glm-9');
});

test('the Z.ai client without a key, or when it is not answering', async () => {
  const keyless = new Zai({ urls: ['https://z.test/v4'], key: '', fetch: async () => {} });
  assert.equal(await keyless.problem(), 'Z.ai has no API key (ZAI_API_KEY)');
  await assert.rejects(() => keyless.chat([{ role: 'user', content: 'hi' }], SCHEMA), /no API key/);
  const down = new Zai({ urls: ['https://z.test/v4'], key: 'a key', fetch: async () => { throw new Error('off'); } });
  assert.equal(await down.problem(), 'Z.ai is not answering (or the API key is no good)');
  await assert.rejects(() => down.chat([{ role: 'user', content: 'hi' }], SCHEMA), /not answering/);
});

test('the Z.ai client says why Z.ai would not answer, and when it says nothing it can read', async () => {
  const fetch = async (url, init = {}) => {
    if (init.body && JSON.parse(init.body).max_tokens === 1) return Response.json({ choices: [{ message: { content: '' } }] });
    return new Response(JSON.stringify({ error: { code: '1113', message: 'Insufficient balance' } }), { status: 429 });
  };
  const llm = new Zai({ urls: ['https://z.test/v4'], key: 'a key', fetch });
  await assert.rejects(() => llm.chat([{ role: 'user', content: 'hi' }], SCHEMA), /Z.ai answered 429: Insufficient balance/);
  const blank = new Zai({ urls: ['https://z.test/v4'], key: 'a key', fetch: async () => Response.json({ choices: [{ message: { content: 'let me think' } }] }) });
  await assert.rejects(() => blank.chat([{ role: 'user', content: 'hi' }], SCHEMA), /nothing it could read/);
});

// A stand-in model: a name, what it says, and whether it is there.
function standIn(name, { problem = '', answer = async () => ({ say: 'Hi!' }) } = {}) {
  return { name, model: `${name}-model`, url: `http://${name}.test/`, problem: async () => problem, chat: answer, models: async () => [] };
}

test('the fallback answers with the local model when the first cannot', async () => {
  const asked = [];
  const zai = standIn('Z.ai', {
    problem: 'Z.ai answered 429: Insufficient balance',
    answer: async () => { throw new Error('Z.ai answered 429: Insufficient balance'); },
  });
  const ollama = standIn('Ollama', { answer: async (messages, schema, trace) => { asked.push(messages); trace.model = 'gemma3:4b'; return { say: 'Hi!' }; } });
  const llm = new Fallback(zai, ollama);
  const trace = {};
  assert.deepEqual(await llm.chat([{ role: 'user', content: 'hi' }], SCHEMA, trace), { say: 'Hi!' });
  assert.equal(trace.fellBack, 'Z.ai answered 429: Insufficient balance');
  assert.equal(trace.model, 'gemma3:4b', "the local one's trace is what remains");
  assert.equal(llm.model, 'Ollama-model', 'the local one is in use now');
  assert.deepEqual(asked, [[{ role: 'user', content: 'hi' }]]);
  // Still no problem: either one answering is enough, but each one's own is kept.
  assert.equal(await llm.problem(), '');
  assert.deepEqual(llm.states(), [
    { name: 'Z.ai', url: 'http://Z.ai.test/', model: 'Z.ai-model', problem: 'Z.ai answered 429: Insufficient balance' },
    { name: 'Ollama', url: 'http://Ollama.test/', model: 'Ollama-model', problem: '' },
  ]);
});

test('the fallback sleeps only when neither model can answer', async () => {
  const zai = standIn('Z.ai', { problem: 'Z.ai is not answering', answer: async () => { throw new Error('Z.ai is not answering'); } });
  const ollama = standIn('Ollama', { problem: 'Ollama is not running at http://127.0.0.1:11434', answer: async () => { throw new Error('Ollama answered 500'); } });
  const llm = new Fallback(zai, ollama);
  assert.equal(await llm.problem(), 'Z.ai is not answering; Ollama is not running at http://127.0.0.1:11434');
  await assert.rejects(() => llm.chat([{ role: 'user', content: 'hi' }], SCHEMA), /Ollama answered 500/);
});

test('the fallback asks the first model while it can answer', async () => {
  const asked = [];
  const zai = standIn('Z.ai', { answer: async (messages, schema, trace) => { asked.push('Z.ai'); trace.model = 'glm-5.3-flash'; return { say: 'Hello!' }; } });
  const ollama = standIn('Ollama', { answer: async () => { asked.push('Ollama'); return { say: 'Hi!' }; } });
  const llm = new Fallback(zai, ollama);
  const trace = {};
  assert.deepEqual(await llm.chat([{ role: 'user', content: 'hi' }], SCHEMA, trace), { say: 'Hello!' });
  assert.equal(trace.fellBack, undefined);
  assert.deepEqual(asked, ['Z.ai']);
  // Its model setting is the first one's.
  llm.model = 'glm-4.6';
  assert.equal(zai.model, 'glm-4.6');
  assert.equal(llm.model, 'glm-4.6');
});

test('a fallback around the real Ollama client still talks to it the same way', async () => {
  const sent = [];
  const fetch = async (url, init) => {
    sent.push({ url, body: JSON.parse(init.body) });
    return new Response(JSON.stringify({ message: { content: '{"say":"Hi!"}' }, eval_count: 9 }));
  };
  const zai = new Zai({ urls: ['https://z.test/v4'], key: '', fetch });
  const ollama = new Ollama({ url: 'http://ollama.test/', model: 'tiny', fetch });
  const llm = new Fallback(zai, ollama);
  const trace = {};
  assert.deepEqual(await llm.chat([{ role: 'user', content: 'hi' }], SCHEMA, trace), { say: 'Hi!' });
  assert.equal(trace.fellBack, 'Z.ai has no API key (ZAI_API_KEY)');
  assert.equal(trace.model, 'tiny');
  assert.equal(sent[0].url, 'http://ollama.test/api/chat');
});
