// The admin page's Tests tab: how long the tests took before each push to
// main (scripts/check.mjs, which the pre-push hook runs, as does npm run check
// by hand), kept in test-runs/ in the keeper's data folder (server/
// test-runs.js). A run going on now, with how long it has been at it against
// how long one usually takes; the latest run, and the usual, fastest and
// slowest of the latest that passed; each run's time as a bar (Chart.js),
// oldest to newest, the usual time across them; the runs, newest first, each
// opening to how long each of its test files took; and the test files that
// took longest in the latest run that passed, beside how long each usually
// takes. The tab shows once there is a run. Each part is drawn again only
// when what it shows has changed, so an opened run stays open, and the chart
// is made once and given new numbers.

const $ = (id) => document.getElementById(id);
const CHART_RUNS = 50;
const LIST_RUNS = 20;
const TOP_FILES = 15;
const STATUS = { running: ['Running', 'warn'], passed: ['Passed', 'ok'], failed: ['Failed', 'bad'], stopped: ['Stopped', ''] };
const when = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
const tick = new Intl.DateTimeFormat(undefined, { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
const cssVar = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
const short = (commit) => String(commit ?? '').slice(0, 7);

// 45 s, or 2 min 5 s.
export function duration(ms) {
  if (!Number.isFinite(ms)) return '—';
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s} s`;
  return `${Math.floor(s / 60)} min${s % 60 ? ` ${s % 60} s` : ''}`;
}

// A run's bar: passed (a full one, CHECK_FULL's, in a hue of its own), or failed.
const KINDS = [
  { label: 'Passed', colour: '--series-1', is: (r) => r.status === 'passed' && !r.full },
  { label: 'Passed, full (CHECK_FULL)', colour: '--series-7', is: (r) => r.status === 'passed' && r.full },
  { label: 'Failed', colour: '--danger', is: (r) => r.status === 'failed' },
];
const kindOf = (run) => KINDS.find((k) => k.is(run)) ?? KINDS[0];

// Returns { refresh() }: refresh reads the runs again (the tab goes while
// there are none).
export function setUpTests({ h, ago, plural, num }) {
  const section = $('tests-section');
  const badge = $('tests-badge');
  let reply = null;
  let allRuns = false;
  let allFiles = false;
  const open = new Set();
  // Runs read whole, by id: one that has ended never changes.
  const whole = new Map();
  const drawn = {};

  const where = h('p', { class: 'muted' });
  const now = h('div', { class: 'tests-now' });
  const tiles = h('div', { class: 'summary' });
  const canvas = h('canvas', { role: 'img', 'aria-label': 'How long each run took, oldest to newest; the list of runs below has the numbers.' });
  const legend = h('div', { class: 'tests-legend muted' });
  const chartBox = h('div', { class: 'usage-chart' }, h('h4', {}, `How long each run took, the latest ${CHART_RUNS}`), h('div', { class: 'usage-canvas' }, canvas), legend);
  const runsBox = h('section', { class: 'tests-part', 'aria-label': 'Runs' });
  const filesBox = h('section', { class: 'tests-part', 'aria-label': 'Test files' });
  $('tests').replaceChildren(where, now, tiles, chartBox, runsBox, filesBox);
  let chart = null;
  let chartRuns = [];

  // A part drawn again only when what it shows has changed.
  function part(name, key, draw) {
    const k = JSON.stringify(key);
    if (drawn[name] === k) return;
    drawn[name] = k;
    draw();
  }
  const redraw = (name, draw) => {
    drawn[name] = '';
    draw();
  };

  function drawWhere() {
    where.replaceChildren(
      'How long the tests took before each push to main: the pre-push hook’s runs, and ',
      h('code', {}, 'npm run check'),
      ' by hand. A push that changes only Markdown runs none. The newest ',
      String(reply.kept),
      ' runs are kept in ',
      h('code', {}, reply.dir),
      '.',
    );
  }

  // A run going on now, against how long one of its kind usually takes.
  function drawNow(running) {
    now.replaceChildren(
      ...running.map((r) => {
        const usual = reply.usual[r.full ? 'full' : 'light']?.median ?? null;
        const so = Date.now() - r.startedAt;
        const left = usual === null ? '' : so < usual ? `usually ${duration(usual)}, so about ${duration(usual - so)} to go` : `longer than the usual ${duration(usual)}`;
        return h(
          'div',
          { class: 'tests-running card', 'data-run': r.id },
          h('div', {}, h('b', {}, '⏳ Testing '), h('code', {}, short(r.commit)), ' ', r.subject),
          h('div', { class: 'muted' }, [`${duration(so)} so far`, left, r.hook ? 'pre-push' : 'by hand', r.full ? 'full' : ''].filter(Boolean).join(' · ')),
          usual === null ? null : h('div', { class: 'meter' }, h('span', { style: `width:${Math.min(100, (so / usual) * 100).toFixed(1)}%` })),
        );
      }),
    );
  }

  function tile(label, value, sub, warn = false) {
    return h('div', { class: `stat card${warn ? ' warn' : ''}` }, h('span', { class: 'label' }, label), h('b', {}, value), h('span', { class: 'muted' }, sub));
  }

  function drawTiles() {
    const finished = reply.runs.filter((r) => r.status !== 'running');
    const last = finished[0];
    const full = !reply.usual.light;
    const usual = reply.usual[full ? 'full' : 'light'];
    const recent = finished.slice(0, reply.usualOf);
    const passed = recent.filter((r) => r.status === 'passed').length;
    tiles.replaceChildren(
      last ? tile('Last run', duration(last.ms), `${STATUS[last.status]?.[0].toLowerCase() ?? last.status} ${ago(last.startedAt)}${last.full ? ', full' : ''}`, last.status !== 'passed') : '',
      usual ? tile('Usually', duration(usual.median), `the middle of the last ${plural(usual.runs, full ? 'full run' : 'run', full ? 'full runs' : 'runs')} that passed`) : '',
      usual ? tile('Fastest', duration(usual.fastest), `of those ${usual.runs}`) : '',
      usual ? tile('Slowest', duration(usual.slowest), `of those ${usual.runs}`) : '',
      recent.length ? tile('Passed', `${passed} of ${recent.length}`, `the last ${plural(recent.length, 'run', 'runs')}`, passed < recent.length) : '',
    );
  }

  // The colours, light or dark as the computer is.
  function paint() {
    chart.data.datasets[0].backgroundColor = chartRuns.map((r) => cssVar(kindOf(r).colour));
    if (chart.data.datasets[1]) chart.data.datasets[1].borderColor = cssVar('--text-3');
    const { x, y } = chart.options.scales;
    for (const axis of [x, y]) {
      axis.ticks.color = cssVar('--text-2');
      axis.grid.color = cssVar('--border');
      axis.border.color = cssVar('--border-strong');
    }
    chart.update('none');
  }

  // Each run's time, oldest to newest (one stopped short has none), with the
  // usual time across them as a dashed line. In minutes, so the scale's
  // steps fall on round ones.
  function drawChart() {
    chartRuns = reply.runs
      .filter((r) => r.status !== 'running' && Number.isFinite(r.ms))
      .slice(0, CHART_RUNS)
      .reverse();
    chartBox.hidden = !chartRuns.length || typeof Chart === 'undefined';
    if (chartBox.hidden) return;
    const usual = reply.usual.light?.median ?? reply.usual.full?.median ?? null;
    const labels = chartRuns.map((r) => tick.format(r.startedAt));
    const datasets = [
      { type: 'bar', label: 'Took', data: chartRuns.map((r) => r.ms / 60_000), borderRadius: 3, maxBarThickness: 24, order: 2 },
      ...(usual === null ? [] : [{ type: 'line', label: 'Usually', data: chartRuns.map(() => usual / 60_000), borderWidth: 1, borderDash: [4, 4], pointRadius: 0, pointHitRadius: 0, order: 1 }]),
    ];
    if (chart) {
      chart.data.labels = labels;
      chart.data.datasets = datasets;
    } else {
      Chart.defaults.font.family = cssVar('--font');
      chart = new Chart(canvas, {
        type: 'bar',
        data: { labels, datasets },
        options: {
          maintainAspectRatio: false,
          animation: false,
          interaction: { mode: 'index', intersect: false },
          scales: {
            x: { grid: { display: false }, ticks: { maxRotation: 0, autoSkipPadding: 12 }, border: {} },
            y: { beginAtZero: true, ticks: { maxTicksLimit: 6, callback: (v) => duration(v * 60_000) }, grid: {}, border: { display: false } },
          },
          plugins: {
            legend: { display: false },
            tooltip: {
              filter: (item) => item.datasetIndex === 0,
              callbacks: {
                title: (items) => {
                  const r = chartRuns[items[0]?.dataIndex];
                  return r ? `${short(r.commit)} ${r.subject}` : '';
                },
                label: (item) => {
                  const r = chartRuns[item.dataIndex];
                  return ` ${duration(r.ms)} · ${STATUS[r.status]?.[0] ?? r.status}${r.counts ? ` · ${num(r.counts.tests)} tests` : ''}`;
                },
                footer: (items) => {
                  const r = chartRuns[items[0]?.dataIndex];
                  if (!r) return '';
                  const u = reply.usual[r.full ? 'full' : 'light']?.median;
                  return [`${when.format(r.startedAt)} · ${r.hook ? 'pre-push' : 'by hand'}${r.full ? ' · full' : ''}`, u ? `usually ${duration(u)}` : ''].filter(Boolean);
                },
              },
            },
          },
        },
      });
    }
    paint();
    const kinds = KINDS.filter((k) => chartRuns.some(k.is));
    legend.replaceChildren(
      ...kinds.map((k) => h('span', {}, h('i', { style: `background:var(${k.colour})` }), k.label)),
      usual === null ? '' : h('span', {}, h('i', { class: 'dash' }), `Usually, ${duration(usual)}`),
    );
  }

  // A time with a bar beside it, as long against the longest.
  const bar = (ms, longest) => h('span', { class: 'tests-bar', 'aria-hidden': 'true' }, h('span', { style: `width:${Math.max(0.5, Math.min(100, (ms / longest) * 100)).toFixed(1)}%` }));

  async function toggle(id) {
    if (open.has(id)) open.delete(id);
    else open.add(id);
    redraw('runs', drawRuns);
    if (!open.has(id) || whole.has(id)) return;
    try {
      const res = await fetch(`/admin/api/tests/${encodeURIComponent(id)}`, { cache: 'no-store' });
      whole.set(id, res.ok ? await res.json() : { error: true });
    } catch {
      whole.set(id, { error: true });
    }
    redraw('runs', drawRuns);
  }

  // One run opened: how its time went, and each of its test files' time.
  function detail(id) {
    const run = whole.get(id);
    if (!run) return h('p', { class: 'muted' }, 'Loading…');
    if (run.error) return h('p', { class: 'error' }, 'This run could not be read.');
    const jobs = (run.jobs ?? []).slice().sort((a, b) => b.ms - a.ms);
    const busy = jobs.reduce((t, j) => t + j.ms + (j.again ?? 0), 0);
    const facts = [
      Number.isFinite(run.copyMs) ? `copying the commit out ${duration(run.copyMs)}` : '',
      Number.isFinite(run.testsMs) ? `the tests ${duration(run.testsMs)}` : '',
      busy && run.testsMs ? `the test files’ times added up ${duration(busy)}, about ${(busy / run.testsMs).toFixed(1)} at once` : '',
      run.atOnce ? `up to ${run.atOnce.jobs} at once (${run.atOnce.e2e} end-to-end), the end-to-end tests in ${run.atOnce.shards} shares, on ${run.atOnce.cores} cores` : '',
      Number.isFinite(run.load) ? `load ${run.load.toFixed(1)} as it started` : '',
      run.heldMs ? `held back about ${duration(run.heldMs)}, short of memory` : '',
      run.node ? `Node ${run.node}` : '',
    ].filter(Boolean);
    const longest = jobs[0]?.ms || 1;
    return h(
      'div',
      { class: 'tests-run' },
      facts.length ? h('p', { class: 'muted' }, `${facts.join(' · ')}.`) : null,
      jobs.length
        ? h(
            'table',
            { class: 'tests-run-files' },
            h(
              'tbody',
              {},
              ...jobs.map((j) =>
                h(
                  'tr',
                  {},
                  h('th', { scope: 'row' }, j.name, j.ok === false ? h('span', { class: 'badge bad' }, 'failed') : j.again ? h('span', { class: 'badge warn', title: 'Its failed tests passed when run again' }, 'run again') : null),
                  h('td', {}, duration(j.ms), j.again ? h('span', { class: 'muted' }, ` + ${duration(j.again)} again`) : null),
                  h('td', { class: 'tests-bar-cell' }, bar(j.ms, longest)),
                ),
              ),
            ),
          )
        : h('p', { class: 'muted' }, 'No time for each test file: the tests did not say.'),
    );
  }

  function runRows(run) {
    const [label, look] = STATUS[run.status] ?? [run.status, ''];
    const c = run.counts;
    const tests = c ? [`${num(c.pass)} of ${num(c.tests)}`, c.skipped ? `${num(c.skipped)} skipped` : '', run.flaky ? `${run.flaky} flaky` : ''].filter(Boolean).join(' · ') : '—';
    const opened = open.has(run.id);
    const row = h(
      'tr',
      { 'data-run': run.id },
      h('th', { scope: 'row' }, when.format(run.startedAt), h('div', { class: 'muted' }, run.hook ? 'pre-push' : 'by hand')),
      h('td', { class: 'tests-commit' }, h('code', {}, short(run.commit)), ' ', h('span', { title: run.subject }, run.subject)),
      h('td', {}, run.status === 'running' ? '—' : duration(run.ms), run.full ? h('div', { class: 'muted' }, 'full') : null),
      h('td', {}, tests, run.failed.length ? h('div', { class: 'muted' }, `failed: ${run.failed.join(', ')}`) : null),
      h('td', {}, h('span', { class: `badge ${look}` }, label)),
      h('td', {}, run.status === 'running' ? null : h('button', { type: 'button', class: 'small', 'aria-expanded': String(opened), onclick: () => toggle(run.id) }, opened ? 'Hide' : 'Test files')),
    );
    return opened ? [row, h('tr', { class: 'tests-detail' }, h('td', { colspan: 6 }, detail(run.id)))] : [row];
  }

  function drawRuns() {
    const list = allRuns ? reply.runs : reply.runs.slice(0, LIST_RUNS);
    runsBox.replaceChildren(
      h('h3', {}, 'Runs, newest first'),
      h(
        'div',
        { class: 'usage-wrap' },
        h(
          'table',
          { class: 'usage tests-runs' },
          h('thead', {}, h('tr', {}, ...['Started', 'Commit', 'Took', 'Tests passed', 'Result', ''].map((t) => h('th', { scope: 'col' }, t)))),
          h('tbody', {}, ...list.flatMap(runRows)),
        ),
      ),
      reply.runs.length > LIST_RUNS ? h('p', {}, h('button', { type: 'button', class: 'small', onclick: () => showAll('runs') }, allRuns ? `Show the latest ${LIST_RUNS}` : `Show all ${reply.runs.length}`)) : null,
    );
  }

  function showAll(what) {
    if (what === 'runs') {
      allRuns = !allRuns;
      redraw('runs', drawRuns);
    } else {
      allFiles = !allFiles;
      redraw('files', drawFiles);
    }
  }

  // The test files that took longest in the latest run that passed, beside
  // the middle of their times over the latest runs of its kind that passed.
  function drawFiles() {
    const f = reply.files;
    if (!f?.files.length) return filesBox.replaceChildren();
    const list = allFiles ? f.files : f.files.slice(0, TOP_FILES);
    const longest = f.files[0].ms || 1;
    // A file in fewer of those runs than the rest (a new one) says how few.
    const runs = reply.usual[f.run.full ? 'full' : 'light']?.runs ?? 0;
    const change = (file) => {
      if (file.runs < 2 || file.usual === null) return h('td', { class: 'muted' }, '—');
      const d = file.ms - file.usual;
      if (Math.abs(d) < 1000) return h('td', { class: 'muted' }, 'as usual');
      const slower = d > 5000 && d > file.usual * 0.2;
      return h('td', {}, h('span', { class: slower ? 'badge warn' : 'muted' }, `${d > 0 ? '+' : '−'}${duration(Math.abs(d))}`));
    };
    filesBox.replaceChildren(
      h('h3', {}, 'Test files, longest first'),
      h('p', { class: 'muted' }, 'In the latest run that passed, ', h('code', {}, short(f.run.commit)), ` at ${when.format(f.run.startedAt)}${f.run.full ? ' (full)' : ''}, beside how long each usually takes: the middle of its times in the latest ${plural(runs, 'run', 'runs')} of that kind that passed. A share of the end-to-end tests is named for its place, like 2/4.`),
      h(
        'div',
        { class: 'usage-wrap' },
        h(
          'table',
          { class: 'usage tests-files' },
          h('thead', {}, h('tr', {}, ...['Test file', 'Took', '', 'Usually', 'Change'].map((t) => h('th', { scope: 'col' }, t)))),
          h(
            'tbody',
            {},
            ...list.map((file) =>
              h(
                'tr',
                {},
                h('th', { scope: 'row' }, file.name),
                h('td', {}, duration(file.ms), file.again ? h('span', { class: 'muted' }, ` + ${duration(file.again)} again`) : null),
                h('td', { class: 'tests-bar-cell' }, bar(file.ms, longest)),
                h('td', {}, file.runs > 1 && file.usual !== null ? duration(file.usual) : '—', file.runs > 1 && file.runs < runs ? h('div', { class: 'muted' }, `of ${file.runs} runs`) : null),
                change(file),
              ),
            ),
          ),
        ),
      ),
      f.files.length > TOP_FILES ? h('p', {}, h('button', { type: 'button', class: 'small', onclick: () => showAll('files') }, allFiles ? `Show the longest ${TOP_FILES}` : `Show all ${f.files.length}`)) : null,
    );
  }

  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => chart && !chartBox.hidden && paint());

  async function refresh() {
    try {
      const res = await fetch('/admin/api/tests', { cache: 'no-store' });
      reply = res.ok ? await res.json() : null;
    } catch {
      reply = null;
    }
    section.hidden = !reply?.runs?.length;
    if (section.hidden) return;
    const running = reply.runs.filter((r) => r.status === 'running');
    badge.textContent = running.length ? 'running' : '';
    // (The times shown move on: "so far" every refresh, "ago" every minute.)
    const minute = Math.floor(Date.now() / 60000);
    part('where', [reply.dir, reply.kept], drawWhere);
    part('now', [running, reply.usual, running.length ? Date.now() : 0], () => drawNow(running));
    part('tiles', [reply.runs.slice(0, reply.usualOf + running.length), reply.usual, minute], drawTiles);
    part('chart', [reply.runs.slice(0, CHART_RUNS + running.length), reply.usual], drawChart);
    part('runs', [reply.runs, allRuns, [...open]], drawRuns);
    part('files', [reply.files, allFiles], drawFiles);
  }

  return { refresh };
}
