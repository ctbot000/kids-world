// The stock market's window (shared/stocks.js), opened from ui.js: the real
// companies on each exchange, with their real prices in coins and how they have
// gone today; and one company up close, with its chart, buying and selling. The
// prices come through js/market.js, and it asks for new ones while it is open.
//
// The big chart is Chart.js (public/vendor), loaded the first time it is wanted;
// the little lines in the list are plain SVG, as twenty charts' worth of axes and
// tooltips would only get in the way there.
import { market } from './market.js';
import { h } from './ui.js';
import {
  canBuy,
  COMPANIES,
  companiesIn,
  companyOf,
  HOUR,
  indexChange,
  isFresh,
  MARKETS,
  marketOf,
  marketTimes,
  MINUTE,
  moodOf,
  quote,
  SHARES_MAX,
  swingOf,
  toCoins,
  worth,
} from './shared/stocks.js';

// The chart's line, up and down: the arrows they come with say it too, for
// anyone who cannot tell the colours apart.
const LINE = '#2d7fc4';
const UP = '#1f9d6b';
const DOWN = '#d9453d';

// How far back the big chart can look.
const clock = (t) => new Date(t).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
const date = (t) => new Date(t).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
const SPANS = [
  { key: 'today', name: 'Today', label: clock },
  { key: 'month', name: '1 month', label: date },
  { key: 'year', name: '1 year', label: date },
];

const coins = (n) => `🪙 ${n.toLocaleString()}`;
// A price, in coins and cents.
const priced = (n) => `🪙 ${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const shares = (n) => `${n.toLocaleString()} ${n === 1 ? 'share' : 'shares'}`;
const pct = (change) => `${Math.abs(change * 100).toFixed(1)}%`;
// A price in its own money: ₩201,500, ¥8,880 or $353.02.
const nativePrice = (m, n) => `${m.sign}${n.toLocaleString(undefined, m.currency === 'USD' ? { minimumFractionDigits: 2, maximumFractionDigits: 2 } : { maximumFractionDigits: 1 })}`;

// Chart.js, the first time it is wanted: null if it cannot be had, and the rest
// of the window does without.
let charting = null;
const loadChart = () => (charting ??= import('../vendor/chart.umd.min.js').then(() => globalThis.Chart ?? null).catch(() => null));

// An arrow going up or down in its colour, and how much beside it in plain ink.
function moved(value, text = pct(value)) {
  const up = value >= 0;
  return h('span', { class: 'stock-change' }, h('span', { class: up ? 'stock-up' : 'stock-down', 'aria-label': up ? 'up' : 'down' }, up ? '▲' : '▼'), ` ${text}`);
}

// A little line of a company's last month, in the colour of which way it went.
function sparkline() {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', 'stock-spark');
  svg.setAttribute('viewBox', '0 0 100 30');
  svg.setAttribute('preserveAspectRatio', 'none');
  svg.setAttribute('aria-hidden', 'true');
  const line = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
  svg.append(line);
  svg.draw = (closes) => {
    svg.style.visibility = closes.length > 1 ? 'visible' : 'hidden';
    if (closes.length < 2) return;
    const lo = Math.min(...closes);
    const hi = Math.max(...closes);
    line.setAttribute('points', closes.map((p, i) => `${((i * 100) / (closes.length - 1)).toFixed(1)},${(28 - ((p - lo) / Math.max(hi - lo, 1e-6)) * 26).toFixed(1)}`).join(' '));
    line.setAttribute('stroke', closes.at(-1) >= closes[0] ? UP : DOWN);
  };
  return svg;
}

// A hairline down the chart from the point the finger is on.
const crosshair = {
  id: 'stockCrosshair',
  afterDatasetsDraw(chart) {
    const active = chart.tooltip?.getActiveElements?.()[0];
    if (!active) return;
    const { ctx, chartArea: area } = chart;
    ctx.save();
    ctx.strokeStyle = 'rgba(61, 46, 79, 0.35)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(active.element.x, area.top);
    ctx.lineTo(active.element.x, area.bottom);
    ctx.stroke();
    ctx.restore();
  },
};

function makeChart(Chart, canvas, labelOf) {
  Chart.defaults.font.family = getComputedStyle(document.documentElement).getPropertyValue('--font').trim();
  return new Chart(canvas, {
    type: 'line',
    data: { labels: [], datasets: [{ data: [], borderColor: LINE, borderWidth: 2, borderJoinStyle: 'round', borderCapStyle: 'round', pointRadius: 0, pointHitRadius: 12, pointHoverRadius: 5, pointHoverBackgroundColor: LINE, pointHoverBorderColor: '#fffaf0', pointHoverBorderWidth: 2, fill: true, backgroundColor: 'rgba(45, 127, 196, 0.1)', tension: 0.15 }] },
    options: {
      maintainAspectRatio: false,
      animation: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: {
          displayColors: false,
          callbacks: {
            title: (items) => labelOf(items[0]?.dataIndex),
            label: (item) => priced(item.raw),
          },
        },
      },
      scales: {
        x: { grid: { display: false }, border: { color: '#e4d6bd' }, ticks: { color: '#6c5a80', maxTicksLimit: 5, maxRotation: 0, autoSkipPadding: 16 } },
        y: { grace: '6%', grid: { color: '#f0e6d2' }, border: { display: false }, ticks: { color: '#6c5a80', maxTicksLimit: 5 } },
      },
    },
    plugins: [crosshair],
  });
}

// How it all works, for anyone who has not met a share before.
const howItWorks = () =>
  h(
    'details',
    { class: 'stock-how' },
    h('summary', {}, '❓ How does it work?'),
    h(
      'ul',
      {},
      h('li', {}, 'A share is a tiny piece of a company. These are real companies at the prices people are paying for them right now in the real world, but the shares here are pretend, and you buy them with your game coins. No real money, and no real shares!'),
      h('li', {}, 'A coin is worth one US dollar, so a share that costs $50 costs 🪙 50. Prices in Korean won and Japanese yen are changed into coins at the day’s exchange rate.'),
      h('li', {}, 'Prices go up when more people want to buy a company than sell it, and down when it is the other way round. Nobody knows what they will do next, not even grown-ups.'),
      h('li', {}, 'You make coins if you sell a share for more than you paid, and you lose coins if you sell it for less. Whole coins change hands, rounded up when you buy and down when you sell.'),
      h('li', {}, 'Each exchange is open for part of the day, and its prices stay still while it is shut. You can still buy and sell at the last price. When Seoul and Tokyo go to bed, New York wakes up!'),
      h('li', {}, 'Now and then a company splits its shares: one share becomes several, each worth that much less. If it happens, you will own more of them, worth the same.'),
    ),
  );

// The window. key: a company to open it at.
export function stockDialog(ui, key = null) {
  const p = ui.profile;
  let open = companyOf(key)?.key ?? null;
  let spanKey = 'today';
  let timer = null;
  let chart = null;
  let chartAt = 0;
  let closed = false;
  let onMarket = null;

  ui.openModal(
    (root) => {
      const purse = h('span', { class: 'coins', 'aria-label': 'Your coins' });
      const head = h(
        'div',
        { class: 'dialog-head' },
        h('h2', {}, '📈 Stock Market'),
        purse,
        h('button', { class: 'chip', type: 'button', onclick: () => ui.shopDialog() }, '🛒 Shop'),
      );
      // A word when the prices are not all they should be.
      const notice = h('p', { class: 'stock-notice', hidden: true });

      // ------------------------------------------------ every company
      const mood = h('div', { class: 'stock-mood' });
      const mine = h('div', { class: 'stock-mine' });
      const rows = new Map();
      const marketHeads = new Map();
      const sections = MARKETS.map((m) => {
        const status = h('span', { class: 'stock-status' });
        const index = h('span', { class: 'stock-index' });
        marketHeads.set(m.key, { status, index });
        return h(
          'section',
          { class: 'stock-market' },
          h('div', { class: 'stock-market-head' }, h('h3', {}, `${m.flag} ${m.name}`), status, index),
          h(
            'div',
            { class: 'stock-list', role: 'list' },
            ...companiesIn(m.key).map((c) => {
              const spark = sparkline();
              const price = h('span', { class: 'stock-price' });
              const change = h('span', { class: 'stock-moved' });
              const owned = h('span', { class: 'stock-owned' });
              const lately = h('span', { class: 'muted' });
              const row = h(
                'button',
                { class: 'stock-row', type: 'button', role: 'listitem', 'data-key': c.key, onclick: () => show(c.key) },
                h('span', { class: 'stock-icon' }, c.icon),
                h('span', { class: 'stock-name' }, h('b', {}, c.name), lately, owned),
                spark,
                h('span', { class: 'stock-figures' }, price, change),
              );
              rows.set(c.key, { row, spark, price, change, owned, lately });
              return row;
            }),
          ),
        );
      });
      const credit = h('p', { class: 'muted stock-credit' }, 'Real prices, pretend shares: it is a game, not advice. Prices from Naver Pay Securities, exchange rates from the European Central Bank.');
      const marketView = h('div', { class: 'stock-view' }, mood, mine, h('p', { class: 'muted stock-note' }, 'Pick a company to see more and to buy or sell. ▲▼ shows how it has gone today, and the little line its last month.'), ...sections, howItWorks(), credit);

      // ------------------------------------------------ one company
      const title = h('div', { class: 'stock-title' });
      const big = h('div', { class: 'stock-big' });
      const place = h('p', { class: 'muted stock-place' });
      const spans = SPANS.map((s) =>
        h('button', { class: 'chip stock-span', type: 'button', 'data-span': s.key, onclick: () => {
          spanKey = s.key;
          drawChart();
        } }, s.name),
      );
      const canvas = h('canvas', { role: 'img' });
      const chartBox = h('div', { class: 'stock-chart' }, canvas);
      const meter = h('div', { class: 'stock-meter' });
      const holding = h('div', { class: 'stock-holding' });
      const buyLine = h('div', { class: 'stock-side-title' });
      const sellLine = h('div', { class: 'stock-side-title' });
      const hint = h('p', { class: 'muted stock-hint' });
      const button = (label, onclick) => h('button', { class: 'chip stock-trade', type: 'button', onclick }, label);
      const buy1 = button('Buy 1', () => trade('buy', 1));
      const buy10 = button('Buy 10', () => trade('buy', 10));
      const buyMax = button('', () => trade('buy', canBuy(p.data.gear.stocks, open, p.data.coins, market.snapshot)));
      const sell1 = button('Sell 1', () => trade('sell', 1));
      const sell10 = button('Sell 10', () => trade('sell', 10));
      const sellAll = button('', () => trade('sell', p.data.gear.stocks[open]?.n ?? 0));
      const about = h('div', { class: 'stock-about' });
      const companyView = h(
        'div',
        { class: 'stock-view' },
        h('div', { class: 'stock-top' }, h('button', { class: 'chip stock-back', type: 'button', 'aria-label': 'Back to all the companies', onclick: () => show(null) }, '←'), title, big),
        place,
        h('div', { class: 'stock-spans' }, ...spans),
        chartBox,
        meter,
        holding,
        h(
          'div',
          { class: 'stock-sides' },
          h('div', { class: 'stock-side buy' }, buyLine, h('div', { class: 'stock-buttons' }, buy1, buy10, buyMax)),
          h('div', { class: 'stock-side sell' }, sellLine, h('div', { class: 'stock-buttons' }, sell1, sell10, sellAll)),
        ),
        hint,
        about,
      );

      // ------------------------------------------------ keeping it all up to date

      // When an exchange next opens or shuts, in the time here. A long way off, its
      // day of the week too.
      const whenText = (t, now) => (t - now < 20 * HOUR ? clock(t) : new Date(t).toLocaleString(undefined, { weekday: 'short', hour: 'numeric', minute: '2-digit' }));
      const statusOf = (snapshot, m, now) => {
        const times = marketTimes(snapshot, m.key, now);
        if (times.open) return h('span', {}, '🟢 Open', times.closes ? ` until ${whenText(times.closes, now)}` : '');
        return h('span', {}, '😴 Shut', times.opens ? `, opens ${whenText(times.opens, now)}` : '');
      };

      const drawMarket = (snapshot, now) => {
        const m = moodOf(snapshot);
        mood.hidden = !m;
        if (m) mood.replaceChildren(h('b', {}, `${m.icon} ${m.name}`), h('span', { class: 'muted' }, m.text));
        const stocks = p.data.gear.stocks;
        const w = worth(stocks, snapshot);
        const held = Object.keys(stocks).length;
        mine.replaceChildren(
          ...(held
            ? [h('b', {}, `💼 Your shares: ${coins(w.value)}`), h('span', {}, w.gain ? [w.gain > 0 ? 'up ' : 'down ', moved(w.gain, coins(Math.abs(w.gain)))] : 'just what you paid')]
            : [h('span', {}, '💼 You have no shares yet. Pick a company, and buy a tiny piece of it!')]),
        );
        for (const mk of MARKETS) {
          const heads = marketHeads.get(mk.key);
          heads.status.replaceChildren(statusOf(snapshot, mk, now));
          const change = indexChange(snapshot, mk.key);
          heads.index.replaceChildren(...(change === null ? [] : [`${mk.indexName} `, moved(change)]));
        }
        for (const c of COMPANIES) {
          const r = rows.get(c.key);
          const q = quote(snapshot, c.key);
          const swing = swingOf(snapshot, c.key);
          r.price.textContent = q ? priced(q.coins) : '—';
          r.change.replaceChildren(...(q ? [moved(q.change)] : []));
          r.owned.textContent = stocks[c.key] ? `You own ${stocks[c.key].n.toLocaleString()}` : '';
          r.lately.textContent = `${c.ticker}${swing ? ` · ${swing.icon} ${swing.name}` : ''}`;
          r.row.setAttribute('aria-label', q ? `${c.name}: ${q.coins} coins, ${q.change >= 0 ? 'up' : 'down'} ${pct(q.change)} today${stocks[c.key] ? `. You own ${shares(stocks[c.key].n)}` : ''}` : `${c.name}: no price just now`);
          r.spark.draw((snapshot?.stocks?.[c.key]?.month ?? []).map((v) => toCoins(snapshot, c.key, v)));
        }
      };

      const drawChart = async () => {
        const s = SPANS.find((x) => x.key === spanKey);
        for (const b of spans) b.classList.toggle('on', b.dataset.span === spanKey);
        const showing = open;
        const [Chart, data] = await Promise.all([loadChart(), market.chart(showing, s.key)]);
        // Gone, or on to something else, while that came.
        if (closed || open !== showing || spanKey !== s.key) return;
        chartAt = Date.now();
        const points = data?.points ?? [];
        chartBox.hidden = !Chart || points.length < 2;
        if (chartBox.hidden) return;
        const snapshot = market.snapshot;
        chart ??= makeChart(Chart, canvas, (i) => chart.$labels?.[i] ?? '');
        chart.$labels = points.map(([t]) => s.label(t));
        chart.data.labels = chart.$labels;
        chart.data.datasets[0].data = points.map(([, v]) => toCoins(snapshot, showing, v));
        chart.update('none');
        canvas.setAttribute('aria-label', `${companyOf(showing).name}'s price, ${s.name}: from ${Math.round(chart.data.datasets[0].data[0])} to ${Math.round(chart.data.datasets[0].data.at(-1))} coins.`);
      };

      const drawCompany = (snapshot, now) => {
        const c = companyOf(open);
        const m = marketOf(c.market);
        const q = quote(snapshot, open);
        const swing = swingOf(snapshot, open);
        const stocks = p.data.gear.stocks;
        const own = stocks[open];
        title.replaceChildren(h('span', { class: 'stock-icon' }, c.icon), h('span', { class: 'stock-name' }, h('b', {}, c.name), h('span', { class: 'muted' }, `${c.ticker}${swing ? ` · ${swing.icon} ${swing.name}` : ''}`)));
        big.replaceChildren(h('b', {}, q ? priced(q.coins) : '—'), ...(q ? [h('span', {}, moved(q.change), h('span', { class: 'muted' }, ' today'))] : []));
        place.replaceChildren(
          `${m.flag} ${m.name}`,
          q ? ` · ${nativePrice(m, q.native)}` : '',
          m.currency !== 'USD' && snapshot ? ` · ${m.sign}${Math.round(snapshot.fx[m.currency]).toLocaleString()} = 🪙 1` : '',
          m.late ? ` · prices about ${m.late} minutes late` : '',
          ' · ',
          statusOf(snapshot, m, now),
        );
        // Where the price is between the last year's lowest and highest.
        const s = snapshot?.stocks?.[open];
        if (s && q && s.hi > s.lo) {
          const at = Math.round((100 * (s.p - s.lo)) / Math.max(s.hi - s.lo, 1e-6));
          meter.hidden = false;
          meter.replaceChildren(
            h('span', { class: 'muted' }, `Year’s low ${priced(toCoins(snapshot, open, s.lo))}`),
            h('span', { class: 'stock-track', role: 'img', 'aria-label': `The price is ${at}% of the way from this year's lowest to its highest` }, h('span', { class: 'stock-dot', style: `left:${at}%` })),
            h('span', { class: 'muted' }, `High ${priced(toCoins(snapshot, open, s.hi))}`),
          );
        } else meter.hidden = true;
        // What you have of it.
        if (own) {
          const fetch = q ? Math.floor((q.cents * own.n) / 100) : own.paid;
          const gain = fetch - own.paid;
          holding.replaceChildren(
            h('b', {}, `You own ${shares(own.n)}.`),
            ` They cost you ${coins(own.paid)}, and would sell for ${coins(fetch)}: `,
            ...(gain ? [moved(gain, coins(Math.abs(gain))), gain > 0 ? ' more than you paid!' : ' less than you paid.'] : ['just what you paid.']),
          );
        } else {
          holding.replaceChildren('You own none of it yet.');
        }
        // Buying and selling, only at recent prices.
        const fresh = isFresh(snapshot, now);
        const can = fresh ? canBuy(stocks, open, p.data.coins, snapshot) : 0;
        const have = own?.n ?? 0;
        buyLine.replaceChildren(h('b', {}, `Buy for ${q ? priced(q.coins) : '—'}`), h('span', { class: 'muted' }, ' a share'));
        buy1.disabled = can < 1;
        buy10.disabled = can < 10;
        buyMax.textContent = can > 0 ? `Buy all I can (${can.toLocaleString()})` : 'Buy all I can';
        buyMax.disabled = can < 1;
        sellLine.replaceChildren(h('b', {}, `Sell for ${q ? priced(q.coins) : '—'}`), h('span', { class: 'muted' }, ' a share'));
        sell1.disabled = !fresh || have < 1;
        sell10.disabled = !fresh || have < 10;
        sellAll.textContent = have > 0 ? `Sell all (${have.toLocaleString()})` : 'Sell all';
        sellAll.disabled = !fresh || have < 1;
        const short = q ? Math.ceil(q.coins) - p.data.coins : 0;
        hint.textContent = !fresh ? '' : have >= SHARES_MAX ? `${SHARES_MAX.toLocaleString()} shares is as many as one player can own.` : can < 1 && short > 0 ? `You need ${short.toLocaleString()} more ${short === 1 ? 'coin' : 'coins'} for a share. Sell treasures from your basket in the 🛒 shop!` : '';
        hint.hidden = !hint.textContent;
        about.replaceChildren(h('p', {}, c.what), swing ? h('p', { class: 'muted' }, `${swing.icon} ${swing.name}: ${swing.text} That says what it has done, not what it will do.`) : '');
      };

      const draw = () => {
        const now = Date.now();
        const { snapshot, status } = market;
        purse.textContent = coins(p.data.coins);
        // No prices at all, or old ones: why, in words.
        const age = snapshot ? now - snapshot.at : 0;
        const fresh = isFresh(snapshot, now);
        notice.hidden = fresh;
        if (!snapshot) notice.textContent = status === 'away' ? '📡 The stock market gets its prices through the island keeper, and it is away just now. Come back soon!' : '📡 Getting the latest prices…';
        else if (!fresh) notice.textContent = `📡 These prices are ${age < 2 * 24 * HOUR ? `${Math.round(age / HOUR)} hours` : `${Math.round(age / (24 * HOUR))} days`} old, so nothing can be bought or sold until new ones come in.`;
        // Companies that split their shares since you last looked.
        for (const { key: k, from, to } of p.settleShares(snapshot)) {
          ui.sound.play('ui');
          ui.toast(companyOf(k).icon, `${companyOf(k).name} split its shares: your ${shares(from)} became ${shares(to)}, worth the same!`);
        }
        if (open) drawCompany(snapshot, now);
        else drawMarket(snapshot, now);
      };

      // Buying or selling: what happened, in words and a sound.
      const trade = (verb, n) => {
        const t = Date.now();
        const c = companyOf(open);
        const { snapshot } = market;
        if (verb === 'buy') {
          const got = p.buyShares(open, n, snapshot, t);
          if (!got) {
            ui.sound.play('no');
            return;
          }
          ui.sound.play('stock-buy');
          ui.toast(c.icon, `You bought ${shares(got.n)} of ${c.name} for ${coins(got.cost)}!`);
        } else {
          const got = p.sellShares(open, n, snapshot, t);
          if (!got || got.full) {
            ui.sound.play('no');
            if (got?.full) ui.toast('👛', `Your purse is full at ${coins(p.data.coins)}! Spend some coins, and then sell.`);
            return;
          }
          ui.sound.play(got.profit > 0 ? 'stock-win' : 'stock-loss');
          const sold = `Sold ${shares(got.n)} of ${c.name} for ${coins(got.coins)}`;
          ui.toast(got.profit > 0 ? '💰' : c.icon, got.profit > 0 ? `${sold}: that's ${coins(got.profit)} profit!` : got.profit < 0 ? `${sold}: ${coins(-got.profit)} less than you paid. Prices go down as well as up!` : `${sold}: just what you paid.`);
          if (got.n < n) ui.toast('👛', `Your purse is full, so ${shares(n - got.n)} stayed yours.`);
        }
        draw();
      };

      const toTop = () => {
        const panel = root.closest('.panel');
        if (panel) panel.scrollTop = 0;
      };

      const show = (k) => {
        open = k;
        marketView.hidden = Boolean(k);
        companyView.hidden = !k;
        // Whichever you come to, start at the top of it.
        toTop();
        ui.sound.play('ui');
        draw();
        if (k) drawChart();
      };

      root.append(head, notice, marketView, companyView);
      marketView.hidden = Boolean(open);
      companyView.hidden = !open;
      toTop();
      draw();
      if (open) drawChart();

      // New prices as they come, and asking for them every so often while it is
      // open; today's chart keeps up too, at the same sort of pace.
      onMarket = () => draw();
      market.addEventListener('change', onMarket);
      market.want(MINUTE);
      timer = setInterval(() => {
        market.want(MINUTE);
        draw();
        if (open && spanKey === 'today' && Date.now() - chartAt >= 2 * MINUTE) drawChart();
      }, 15000);
    },
    {
      onClose: () => {
        closed = true;
        clearInterval(timer);
        market.removeEventListener('change', onMarket);
        chart?.destroy();
        chart = null;
      },
    },
  );
}
