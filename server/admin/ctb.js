// The admin page's CTB section (server/ctb.js): its settings, its workers and
// what each is doing step by step, its task board (the project's GitHub
// issues labelled "ctb") with a form for a new task, the workers' proposals
// to approve or turn down, their pull requests, the tokens their models took
// and what happened lately; and every talk each worker had with its model
// (its run logs, ctb-runs.js), to see why one went wrong: what the model was
// given, what it thought and answered, what each answer cost and took, and
// a transcript to download or copy for another model to read. Read from
// /admin/api/ctb on every refresh; the forms are made once, so a refresh
// never wipes what is being typed, and an open run is fetched by itself.

const LABEL_LOOK = { 'ctb: working': 'warn', 'ctb: pr': 'ok', 'ctb: stuck': 'bad' };
const send = (path, method, body) => fetch(`/admin/api/ctb${path}`, { method, cache: 'no-store', headers: { 'X-Kids-World-Admin': '1', 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });

let view = null;
let ui = null;

function settingsForm(h) {
  const on = h('input', { type: 'checkbox' });
  const workers = h('select', { 'aria-label': 'Workers' });
  const model = h('select', { 'aria-label': 'Their model' });
  const propose = h('input', { type: 'checkbox' });
  const hours = h('input', { type: 'number', min: 1, max: 168, 'aria-label': 'Hours between proposals', style: 'width:4.5em' });
  const owner = h('input', { type: 'text', autocomplete: 'off', maxlength: 32, placeholder: 'nobody', 'aria-label': 'The CTB island’s owner (a username)', style: 'width:9em' });
  owner.spellcheck = false;
  const save = h('button', { type: 'submit', disabled: true }, 'Save');
  const note = h('span', { class: 'muted', 'aria-live': 'polite' });
  const form = h(
    'form',
    { class: 'settings' },
    h('label', {}, on, 'On'),
    h('label', {}, workers, 'workers'),
    h('label', {}, 'Model', model),
    h('label', { title: 'With nothing to do, a worker proposes a task now and then: an issue labelled “ctb: proposal”, worked on once labelled “ctb: approved” (Approve does that).' }, propose, 'Proposes tasks, every', hours, 'hours at most'),
    h('label', { title: 'The one login who owns the CTB island: only they build there and set its rules. Away, nobody owns it.' }, 'Island owner', owner),
    save,
    note,
  );
  let dirty = false;
  const changed = () => {
    dirty = true;
    save.disabled = false;
    note.textContent = '';
  };
  form.addEventListener('input', changed);
  form.addEventListener('change', changed);
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    save.disabled = true;
    const res = await send('', 'PUT', { on: on.checked, workers: Number(workers.value), model: model.value, propose: propose.checked, proposeHours: Number(hours.value), owner: owner.value });
    if (!res.ok) {
      save.disabled = false;
      note.textContent = (await res.json().catch(() => null))?.error ?? 'That did not work. Is the keeper still running?';
      return;
    }
    dirty = false;
    note.textContent = 'Saved.';
    ui.render(await res.json());
  });
  const fill = (state) => {
    if (dirty) return;
    const s = state.settings;
    on.checked = s.on;
    propose.checked = s.propose;
    hours.value = String(s.proposeHours);
    owner.value = s.owner ?? '';
    workers.replaceChildren(...Array.from({ length: state.maxWorkers }, (_, k) => h('option', { value: k + 1 }, k + 1)));
    workers.value = String(s.workers);
    const models = state.models.includes(s.model) || !s.model ? state.models : [s.model, ...state.models];
    model.replaceChildren(h('option', { value: '' }, `Same as the AI friend (${state.friendModel || 'its default'})`), ...models.map((m) => h('option', { value: m }, m)));
    model.value = s.model;
    save.disabled = true;
  };
  return { form, fill };
}

function taskForm(h) {
  const title = h('input', { type: 'text', autocomplete: 'off', maxlength: 200, placeholder: 'What should be done, in a line', 'aria-label': 'Task title', required: true });
  const body = h('textarea', { rows: 4, placeholder: 'More about it: what, why, how to tell it is done (Markdown)', 'aria-label': 'Task description' });
  const add = h('button', { type: 'submit' }, 'Add task');
  const note = h('span', { class: 'muted', 'aria-live': 'polite' });
  const form = h('form', { class: 'ctb-task' }, title, body, h('div', {}, add, ' ', note));
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    add.disabled = true;
    note.textContent = 'Adding it on GitHub…';
    const res = await send('/tasks', 'POST', { title: title.value, body: body.value });
    add.disabled = false;
    const answer = await res.json().catch(() => null);
    if (!res.ok) {
      note.textContent = answer?.error ?? 'That did not work. Is the keeper still running?';
      return;
    }
    title.value = '';
    body.value = '';
    note.replaceChildren('Added ', h('a', { href: answer.url, target: '_blank', rel: 'noopener' }, `#${answer.number}`), '.');
    ui.refresh();
  });
  return form;
}

const KIND = { task: '🛠️ Task', idea: '💡 Idea', proposal: '📝 Proposal' };
const num = new Intl.NumberFormat();
const RUN_POLL_MS = 4000;
const took = (ms) => (ms >= 60000 ? `${Math.floor(ms / 60000)} min ${Math.round((ms % 60000) / 1000)} s` : `${(ms / 1000).toFixed(1)} s`);

// The step in a model's answer, as JSON, or null.
function stepIn(raw) {
  const text = String(raw ?? '');
  for (const words of [text, text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1)]) {
    try {
      const v = JSON.parse(words);
      if (v && typeof v === 'object') return v;
    } catch {}
  }
  return null;
}

// The workers' run logs: a list, one worker's or everyone's, and the run
// picked, step by step, fetched again every few seconds while it goes on.
function runsPanel({ h, ago, time, opened }) {
  const fold = (key, summary, ...children) => h('details', { class: 'fold', open: opened.has(key) || null, ontoggle: (e) => (e.target.open ? opened.add(key) : opened.delete(key)) }, h('summary', {}, summary), ...children);
  const text = (t) => h('pre', { class: 'run-text' }, t);
  const filters = h('div', { class: 'run-filters', role: 'group', 'aria-label': 'Whose runs' });
  const list = h('ol', { class: 'run-list' });
  const viewer = h('div', { class: 'run-view', hidden: true, 'aria-live': 'polite' });
  const el = h('div', { id: 'ctb-runs' }, h('h3', {}, '🔍 Model runs'), h('p', { class: 'muted' }, 'Every talk a worker had with its model, newest first: a task step by step, an idea read, a proposal. Open one to see what the model was given, what it thought and answered, and what each answer cost.'), filters, list, viewer);
  let runs = [];
  let filter = null;
  let shown = null;
  let timer = 0;

  const status = (s) => (!s.endedAt ? h('span', { class: 'badge warn' }, 'running') : s.ok ? h('span', { class: 'badge ok' }, 'done') : s.stopped ? h('span', { class: 'badge', title: 'The server stopped (a restart) in the middle of it; the next try carries on from here.' }, 'cut off') : h('span', { class: 'badge bad' }, 'not done'));
  const label = (s) => (s.issue ? `#${s.issue.number} ${s.issue.title}` : s.title);

  function renderList() {
    const names = [...new Map(runs.map((r) => [r.k, r.worker])).entries()].sort((a, b) => a[0] - b[0]);
    filters.replaceChildren(
      ...[[null, 'Everyone'], ...names].map(([k, name]) => h('button', { type: 'button', class: `chip${filter === k ? ' on' : ''}`, 'aria-pressed': String(filter === k), onclick: () => pick(k) }, name)),
    );
    const mine = runs.filter((r) => filter === null || r.k === filter);
    list.replaceChildren(
      ...(mine.length
        ? mine.map((r) =>
            h(
              'li',
              { class: r.id === shown ? 'picked' : null },
              h('button', { type: 'button', class: 'link', onclick: () => open(r.id) }, status(r), ' ', KIND[r.kind] ?? r.kind, ' · ', h('b', {}, r.worker), ' · ', label(r)),
              h('div', { class: 'muted' }, `${ago(r.at)} · ${took((r.endedAt || r.last) - r.at)} · ${r.kind === 'task' ? `${r.steps} steps · ` : ''}${r.calls} ${r.calls === 1 ? 'answer' : 'answers'}${r.failed ? `, ${r.failed} failed` : ''} · ${num.format(r.promptTokens)} tokens in, ${num.format(r.tokens)} out`),
            ),
          )
        : [h('li', { class: 'muted' }, 'None yet.')]),
    );
  }

  function pick(k, { latest = false } = {}) {
    filter = k;
    renderList();
    const first = runs.find((r) => k === null || r.k === k);
    if (latest && first) open(first.id);
    else if (latest) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  async function open(id) {
    clearTimeout(timer);
    if (shown !== id) viewer.replaceChildren(h('p', { class: 'muted' }, 'Loading…'));
    shown = id;
    viewer.hidden = false;
    renderList();
    let run = null;
    try {
      const res = await fetch(`/admin/api/ctb/runs/${id}`, { cache: 'no-store' });
      if (res.ok) run = await res.json();
    } catch {}
    if (shown !== id) return;
    if (!run) {
      viewer.replaceChildren(h('p', { class: 'muted' }, 'That run is gone (only the newest are kept).'));
      return;
    }
    renderRun(run);
    if (!run.summary.endedAt) timer = setTimeout(() => shown === id && open(id), RUN_POLL_MS);
  }

  function close() {
    clearTimeout(timer);
    shown = null;
    viewer.hidden = true;
    viewer.replaceChildren();
    renderList();
  }

  async function copy(id, button) {
    try {
      const res = await fetch(`/admin/api/ctb/runs/${id}.txt`, { cache: 'no-store' });
      await navigator.clipboard.writeText(await res.text());
      button.textContent = 'Copied';
    } catch {
      button.textContent = 'Could not copy';
    }
    setTimeout(() => (button.textContent = 'Copy transcript'), 2000);
  }

  function renderRun({ summary: s, events }) {
    const key = (k) => `run-${s.id}-${k}`;
    const cards = [];
    let card = null;
    for (const [i, e] of events.entries()) {
      if (e.type === 'start') {
        cards.push(...e.messages.map((m, j) => fold(key(`m${j}`), `${m.role === 'system' ? 'System prompt' : 'First message'} (${num.format(m.content.length)} characters)`, text(m.content))));
      } else if (e.type === 'call') {
        const step = stepIn(e.raw);
        const u = e.usage;
        const what = step?.tool ? [h('b', {}, step.tool), step.path || step.query ? h('code', {}, ` ${step.path || ''}${step.query ? ` “${step.query}”` : ''}${step.from ? ` ${step.from}-${step.to ?? ''}` : ''}`) : ''] : s.kind === 'task' ? h('b', {}, 'no step') : h('b', {}, 'answer');
        card = h(
          'article',
          { class: `run-call${e.error ? ' failed' : ''}`, 'data-step': e.step || null },
          h(
            'div',
            { class: 'run-head' },
            e.step ? h('span', { class: 'badge' }, `step ${e.step}`) : null,
            ' ',
            what,
            e.error ? h('span', { class: 'badge bad' }, 'failed') : null,
            h('span', { class: 'muted' }, ` · ${time.format(e.at)} · ${took(e.ms)}${u ? ` · ${num.format(u.prompt ?? 0)} in (${num.format(u.cached ?? 0)} cached) · ${num.format(u.completion ?? 0)} out (${num.format(u.reasoning ?? 0)} thinking)` : ''} · stop: ${e.finish || '?'}`),
          ),
          e.error ? h('div', { class: 'run-error' }, e.error) : null,
          step?.thought ? h('div', { class: 'run-thought' }, step.thought) : null,
          e.reasoning ? fold(key(`r${i}`), `Its thinking (${num.format(e.reasoning.length)} characters)`, text(e.reasoning)) : null,
          fold(key(`a${i}`), e.raw ? `Its answer as it came (${num.format(e.raw.length)} characters)` : 'Its answer: empty', text(e.raw || '(nothing)')),
        );
        cards.push(card);
      } else if (e.type === 'step') {
        const into = card && Number(card.dataset.step) === e.n ? card : null;
        const f = fold(key(`s${i}`), `What it was given back (${num.format(e.result.length)} characters)`, text(e.result));
        if (into) into.append(f);
        else cards.push(h('article', { class: 'run-call' }, h('div', { class: 'run-head' }, h('b', {}, e.step?.tool ?? 'result')), f));
      } else if (e.type === 'note') {
        cards.push(h('div', { class: 'run-note' }, h('time', {}, time.format(e.at)), ' ', e.text.length > 600 ? [e.text.slice(0, 200), fold(key(`n${i}`), 'All of it', text(e.text))] : e.text));
      } else if (e.type === 'end') {
        cards.push(h('div', { class: `run-note ${e.ok ? 'ok' : 'bad'}` }, h('time', {}, time.format(e.at)), ' ', h('b', {}, e.ok ? 'Done. ' : 'Not done. '), e.why, e.url ? [' ', h('a', { href: e.url, target: '_blank', rel: 'noopener' }, e.url)] : null));
      }
    }
    const copyButton = h('button', { type: 'button', onclick: (ev) => copy(s.id, ev.currentTarget) }, 'Copy transcript');
    viewer.replaceChildren(
      h(
        'div',
        { class: 'run-top' },
        h('h4', {}, KIND[s.kind] ?? s.kind, ' · ', s.worker, ' · ', s.issue ? h('a', { href: s.issue.url, target: '_blank', rel: 'noopener' }, label(s)) : label(s), ' ', status(s)),
        h('div', { class: 'muted' }, `${s.model} · started ${ago(s.at)} · ${took((s.endedAt || s.last) - s.at)} · ${s.kind === 'task' ? `${s.steps} steps · ` : ''}${s.calls} answers${s.failed ? ` (${s.failed} failed)` : ''} · ${num.format(s.promptTokens)} tokens in, ${num.format(s.tokens)} out${s.endedAt ? '' : ' · still going, updated every few seconds'}`),
        s.resumed ? h('div', { class: 'muted' }, 'Carries on from ', h('button', { type: 'button', class: 'link', onclick: () => open(s.resumed) }, 'the run a restart cut off'), ': its steps were given back to the model.') : null,
        h('div', { class: 'run-actions' }, h('a', { class: 'button', href: `/admin/api/ctb/runs/${s.id}.txt`, download: `ctb-run-${s.id}.txt` }, 'Download transcript'), ' ', copyButton, ' ', h('button', { type: 'button', class: 'quiet', onclick: close }, 'Close')),
      ),
      ...cards,
    );
  }

  return {
    el,
    update(state) {
      runs = state.runs ?? [];
      renderList();
    },
    pick,
  };
}

async function act(path, question = '') {
  if (question && !confirm(question)) return;
  const res = await send(path, 'POST');
  if (!res.ok) alert((await res.json().catch(() => null))?.error ?? 'That did not work. Is the keeper still running?');
  ui.refresh();
}

export function setUpCtb(helpers) {
  const { h, ago, plural, time, usageTable, opened } = helpers;
  const link = (i) => h('a', { href: i.url, target: '_blank', rel: 'noopener' }, `#${i.number}`);
  const fold = (key, summary, ...children) => h('details', { class: 'fold', open: opened.has(key) || null, ontoggle: (e) => (e.target.open ? opened.add(key) : opened.delete(key)) }, h('summary', {}, summary), ...children);

  const runs = runsPanel(helpers);

  function workerCard(w, k) {
    return h(
      'article',
      { class: 'visit' },
      h('h4', {}, w.name, w.issue ? h('span', { class: 'muted' }, ' · ', link(w.issue), ` ${w.issue.title}`) : null, ' ', h('button', { type: 'button', class: 'quiet small', title: `${w.name}'s talks with the model, the newest open`, onclick: () => runs.pick(k, { latest: true }) }, '🔍 Model runs')),
      h('div', {}, h('b', {}, w.doing), w.issue ? h('span', { class: 'muted' }, ` · since ${ago(w.startedAt)}`) : null),
      h('div', { class: 'muted' }, `${plural(w.done, 'pull request', 'pull requests')} opened, stuck ${plural(w.stuck, 'time', 'times')}`, w.last ? [' · last: ', link(w.last.issue), ' ', w.last.ok ? h('a', { href: w.last.url, target: '_blank', rel: 'noopener' }, 'pull request') : `stuck: ${String(w.last.why).split('\n')[0]}`] : null),
      w.steps.length ? fold(`ctb-steps-${w.name}`, `Steps (${w.steps.length})`, h('ol', { class: 'recent' }, ...w.steps.map((s) => h('li', {}, h('time', {}, time.format(s.at)), ' ', h('b', {}, `${s.n}. ${s.what}`), s.thought ? h('div', { class: 'muted' }, s.thought) : null)))) : null,
    );
  }

  function render(state) {
    const section = document.getElementById('ctb-section');
    section.hidden = !state;
    if (!state) return;
    if (!view) {
      const settings = settingsForm(h);
      view = { settings, line: h('div', { class: 'friend-line' }), island: h('p', { class: 'muted' }), workers: h('div', { class: 'visits' }), board: h('div'), proposals: h('div'), ideas: h('div'), pulls: h('div'), usage: h('div', { class: 'usage-section' }), history: h('div') };
      document.getElementById('ctb').replaceChildren(view.line, settings.form, view.island, view.workers, runs.el, h('h3', {}, 'New task'), taskForm(h), view.board, view.proposals, view.ideas, view.pulls, view.usage, view.history);
    }
    view.settings.fill(state);
    const [cls, words] = !state.running ? ['off', 'Off'] : state.problem ? ['wait', `Closed: ${state.problem}`] : ['on', `Open on ${state.repo} · ${state.model}`];
    view.line.replaceChildren(h('span', { class: `status ${cls}`, role: 'status' }, words), state.running ? h('button', { type: 'button', onclick: () => act('/check') }, 'Check now') : '');
    const isl = state.island;
    view.island.replaceChildren(
      ...(isl
        ? [`Their island “${isl.name}”, code ${isl.code}${isl.shared === 'online' ? ', open to everyone peer to peer' : ''}`, isl.visitors.length ? ` · visiting: ${isl.visitors.join(', ')}` : ' · no visitors', '. Anyone can watch them, no login needed: ', h('a', { href: isl.url, target: '_blank', rel: 'noopener' }, isl.url), ' (here: ', h('a', { href: '/?ctb', target: '_blank', rel: 'noopener' }, '/?ctb'), ').']
        : []),
    );
    view.workers.replaceChildren(...state.workers.map((w, k) => workerCard(w, k)));
    runs.update(state);
    view.workers.hidden = !state.workers.length;
    view.board.replaceChildren(
      h('h3', {}, 'Task board ', h('span', { class: 'badge' }, String(state.tasks.length))),
      state.tasks.length
        ? h('ul', { class: 'ctb-list' }, ...state.tasks.map((t) => h('li', {}, link(t), ` ${t.title} `, ...t.labels.filter((l) => l !== 'ctb').map((l) => h('span', { class: `badge ${LABEL_LOOK[l] ?? ''}` }, l.replace(/^ctb: /, ''))))))
        : h('p', { class: 'muted' }, `No open tasks. Add one above, or label an issue on GitHub “ctb” (it must be written by the account gh is logged in as).`),
    );
    view.proposals.replaceChildren(
      h('h3', {}, 'Proposals ', h('span', { class: 'badge' }, String(state.proposals.length)), ' ', state.running && !state.problem ? h('button', { type: 'button', disabled: state.proposing || null, onclick: () => act('/propose') }, state.proposing ? 'Thinking…' : 'Propose one now') : ''),
      state.proposals.length
        ? h('ul', { class: 'ctb-list' }, ...state.proposals.map((p) => h('li', {}, link(p), ` ${p.title} `, h('button', { type: 'button', onclick: () => act(`/proposals/${p.number}/approve`) }, 'Approve'), ' ', h('button', { type: 'button', class: 'danger quiet', onclick: () => act(`/proposals/${p.number}/reject`, `Turn down #${p.number}? The issue is closed.`) }, 'Turn down'), fold(`ctb-proposal-${p.number}`, 'What it says', h('pre', { class: 'ctb-body' }, p.body)))))
        : h('p', { class: 'muted' }, 'No proposals waiting.'),
    );
    const IDEA = { waiting: ['waiting', 'warn'], accepted: ['accepted', 'ok'], declined: ['declined', ''] };
    view.ideas.replaceChildren(
      h('h3', {}, 'Players’ ideas ', h('span', { class: 'badge' }, String(state.ideas?.length ?? 0))),
      state.ideas?.length
        ? h(
            'ul',
            { class: 'ctb-list' },
            ...state.ideas.map((i) =>
              h(
                'li',
                {},
                h('span', { class: `badge ${IDEA[i.state][1]}` }, IDEA[i.state][0]),
                ' ',
                h('b', {}, i.name || i.username || 'A player'),
                h('span', { class: 'muted' }, ` · ${ago(i.at)}`),
                h('div', {}, `“${i.text}”`),
                i.state !== 'waiting' ? h('div', { class: 'muted' }, `${i.by}: ${i.reply}`, i.issue ? [' · ', link(i.issue)] : null) : null,
              ),
            ),
          )
        : h('p', { class: 'muted' }, 'No ideas from players yet. They send them from 💡 in the game’s help and settings.'),
    );
    view.pulls.replaceChildren(
      h('h3', {}, 'Pull requests'),
      state.pulls.length ? h('ul', { class: 'ctb-list' }, ...state.pulls.map((p) => h('li', {}, link(p), ` ${p.title} `, h('span', { class: `badge ${p.state === 'MERGED' ? 'ok' : p.state === 'OPEN' ? 'accent' : ''}` }, p.state.toLowerCase())))) : h('p', { class: 'muted' }, 'None yet.'),
    );
    const usageKey = JSON.stringify(state.usage ?? null);
    if (view.usage.dataset.key !== usageKey) {
      view.usage.dataset.key = usageKey;
      view.usage.replaceChildren(...usageTable(state.usage));
    }
    view.history.replaceChildren(...(state.history.length ? [fold('ctb-history', 'Activity log', h('ol', { class: 'recent' }, ...state.history.slice(0, 40).map((e) => h('li', {}, h('time', {}, time.format(e.at)), ' ', e.text))))] : []));
  }

  async function refresh() {
    let state = null;
    try {
      const res = await fetch('/admin/api/ctb', { cache: 'no-store' });
      if (res.ok) state = await res.json();
    } catch {
      state = null;
    }
    render(state);
  }

  ui = { render, refresh };
  return ui;
}
