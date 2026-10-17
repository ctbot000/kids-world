// The admin page's CTB section (server/ctb.js): its settings, its workers and
// what each is doing step by step, its task board (the project's GitHub
// issues labelled "ctb") with a form for a new task, the workers' proposals
// to approve or turn down, their pull requests, the tokens their models took
// and what happened lately. Read from /admin/api/ctb on every refresh; the
// forms are made once, so a refresh never wipes what is being typed.

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
  const save = h('button', { type: 'submit', disabled: true }, 'Save');
  const note = h('span', { class: 'muted', 'aria-live': 'polite' });
  const form = h(
    'form',
    { class: 'settings' },
    h('label', {}, on, 'On'),
    h('label', {}, workers, 'workers'),
    h('label', {}, 'Model', model),
    h('label', { title: 'With nothing to do, a worker proposes a task now and then: an issue labelled “ctb: proposal”, worked on once labelled “ctb: approved” (Approve does that).' }, propose, 'Proposes tasks, every', hours, 'hours at most'),
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
    const res = await send('', 'PUT', { on: on.checked, workers: Number(workers.value), model: model.value, propose: propose.checked, proposeHours: Number(hours.value) });
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

  function workerCard(w) {
    return h(
      'article',
      { class: 'visit' },
      h('h4', {}, w.name, w.issue ? h('span', { class: 'muted' }, ' · ', link(w.issue), ` ${w.issue.title}`) : null),
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
      view = { settings, line: h('div', { class: 'friend-line' }), island: h('p', { class: 'muted' }), workers: h('div', { class: 'visits' }), board: h('div'), proposals: h('div'), pulls: h('div'), usage: h('div', { class: 'usage-section' }), history: h('div') };
      document.getElementById('ctb').replaceChildren(view.line, settings.form, view.island, view.workers, h('h3', {}, 'New task'), taskForm(h), view.board, view.proposals, view.pulls, view.usage, view.history);
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
    view.workers.replaceChildren(...state.workers.map(workerCard));
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
