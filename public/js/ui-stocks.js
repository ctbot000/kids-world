// The stock market's window (shared/stocks.js), opened from ui.js: every
// company with its price and how it has gone over the last day, your shares and
// the news; and one company up close, with its chart, buying and selling. The
// prices are worked out from the clock, so it keeps itself up to date.
//
// The big chart is Chart.js (public/vendor), loaded the first time it is
// wanted; the little lines in the list are plain SVG, as eight charts' worth of
// axes and tooltips would only get in the way there.
import { h } from './ui.js';
import {
  canBuy,
  COMPANIES,
  companyOf,
  DAY,
  dayChange,
  dividendOf,
  dividendsPerDay,
  history,
  HOUR,
  indexAt,
  kindOf,
  MINUTE,
  moodAt,
  newsBetween,
  quote,
  SHARES_MAX,
  TICK_MS,
  worth,
} from './shared/stocks.js';

// The chart's line, up and down: the arrows they come with say it too, for
// anyone who cannot tell the colours apart.
const LINE = '#2d7fc4';
const UP = '#1f9d6b';
const DOWN = '#d9453d';

// How far back the big chart can look.
const SPANS = [
  { key: 'hour', name: '1 hour', span: HOUR, points: 61, label: (t) => clock(t) },
  { key: 'day', name: '1 day', span: DAY, points: 97, label: (t) => clock(t) },
  { key: 'week', name: '1 week', span: 7 * DAY, points: 113, label: (t) => new Date(t).toLocaleDateString(undefined, { weekday: 'short', hour: 'numeric' }) },
];
const clock = (t) => new Date(t).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });

const coins = (n) => `🪙 ${n.toLocaleString()}`;
const shares = (n) => `${n.toLocaleString()} ${n === 1 ? 'share' : 'shares'}`;
const pct = (change) => `${Math.abs(change * 100).toFixed(1)}%`;

// Chart.js, the first time it is wanted: null if it cannot be had, and the rest
// of the window does without.
let charting = null;
const loadChart = () => (charting ??= import('../vendor/chart.umd.min.js').then(() => globalThis.Chart ?? null).catch(() => null));

// An arrow going up or down in its colour, and how much beside it in plain ink.
function change(value, text = pct(value)) {
  const up = value >= 0;
  return h('span', { class: 'stock-change' }, h('span', { class: up ? 'stock-up' : 'stock-down', 'aria-label': up ? 'up' : 'down' }, up ? '▲' : '▼'), ` ${text}`);
}

// A little line of the last day, in the colour of which way it went.
function sparkline() {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', 'stock-spark');
  svg.setAttribute('viewBox', '0 0 100 30');
  svg.setAttribute('preserveAspectRatio', 'none');
  svg.setAttribute('aria-hidden', 'true');
  const line = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
  svg.append(line);
  svg.draw = (key, t) => {
    const prices = history(key, t, DAY, 49).map((p) => p.price);
    const lo = Math.min(...prices);
    const hi = Math.max(...prices);
    line.setAttribute('points', prices.map((p, i) => `${((i * 100) / (prices.length - 1)).toFixed(1)},${(28 - ((p - lo) / Math.max(hi - lo, 1e-6)) * 26).toFixed(1)}`).join(' '));
    line.setAttribute('stroke', prices.at(-1) >= prices[0] ? UP : DOWN);
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
            label: (item) => coins(Math.max(1, Math.round(item.raw))),
          },
        },
      },
      scales: {
        x: { grid: { display: false }, border: { color: '#e4d6bd' }, ticks: { color: '#6c5a80', maxTicksLimit: 5, maxRotation: 0, autoSkipPadding: 16 } },
        y: { grace: '6%', grid: { color: '#f0e6d2' }, border: { display: false }, ticks: { color: '#6c5a80', maxTicksLimit: 5, precision: 0 } },
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
      h('li', {}, 'A share is a tiny piece of a company. Buy one and a tiny bit of that company is yours!'),
      h('li', {}, 'Prices go up when lots of people want a company, and down when fewer do. News can change that fast, so read the 📰 news.'),
      h('li', {}, 'Buy low, sell high: you make coins when you sell a share for more than you paid. But prices go down as well as up, and then you get back less.'),
      h('li', {}, 'You buy for a little more than the price and sell for a little less, so buying and selling again straight away costs a coin or two. It pays to wait!'),
      h('li', {}, '🐢 Steady companies hardly move, 🐇 Bouncy ones move more, and 🚀 Wild ones go up and down a lot. Owning a few different ones means one bad day does not sink you.'),
      h('li', {}, '🐢 and 🐇 companies pay a dividend, a share of what they earn: some coins every day, just for owning them. Come back to collect them, at least once a week.'),
      h('li', {}, 'It is all make-believe: these companies live only in Kids World, and only coins are ever used.'),
    ),
  );

// The window. key: a company to open it at.
export function stockDialog(ui, key = null) {
  const p = ui.profile;
  let open = companyOf(key)?.key ?? null;
  let spanKey = 'day';
  let timer = null;
  let chart = null;
  let lastTick = null;
  let seenNews = null;
  let closed = false;

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

      // ------------------------------------------------ every company
      const mood = h('div', { class: 'stock-mood' });
      const mine = h('div', { class: 'stock-mine' });
      const rows = new Map();
      const list = h(
        'div',
        { class: 'stock-list', role: 'list' },
        ...COMPANIES.map((c) => {
          const spark = sparkline();
          const price = h('span', { class: 'stock-price' });
          const moved = h('span', { class: 'stock-moved' });
          const owned = h('span', { class: 'stock-owned' });
          const row = h(
            'button',
            { class: 'stock-row', type: 'button', role: 'listitem', 'data-key': c.key, onclick: () => show(c.key) },
            h('span', { class: 'stock-icon' }, c.icon),
            h('span', { class: 'stock-name' }, h('b', {}, c.name), h('span', { class: 'muted' }, `${c.ticker} · ${kindOf(c.key).icon} ${kindOf(c.key).name}`), owned),
            spark,
            h('span', { class: 'stock-figures' }, price, moved),
          );
          rows.set(c.key, { row, spark, price, moved, owned });
          return row;
        }),
      );
      const news = h('ul', { class: 'stock-news' });
      const market = h('div', { class: 'stock-view' }, mood, mine, h('p', { class: 'muted stock-note' }, 'Pick a company to see more and to buy or sell. ▲▼ shows how it has gone in the last day.'), list, h('h3', {}, '📰 News'), news, howItWorks());

      // ------------------------------------------------ one company
      const title = h('div', { class: 'stock-title' });
      const big = h('div', { class: 'stock-big' });
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
      const buyMax = button('', () => trade('buy', canBuy(p.data.gear.stocks, open, p.data.coins, Date.now())));
      const sell1 = button('Sell 1', () => trade('sell', 1));
      const sell10 = button('Sell 10', () => trade('sell', 10));
      const sellAll = button('', () => trade('sell', p.data.gear.stocks[open]?.n ?? 0));
      const about = h('div', { class: 'stock-about' });
      const told = h('ul', { class: 'stock-news' });
      const company = h(
        'div',
        { class: 'stock-view' },
        h('div', { class: 'stock-top' }, h('button', { class: 'chip stock-back', type: 'button', 'aria-label': 'Back to all the companies', onclick: () => show(null) }, '←'), title, big),
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
        h('h3', {}, '📰 News about it'),
        told,
      );

      // ------------------------------------------------ keeping it all up to date

      // News as a list of lines, the newest first. fresh: the ones not seen yet,
      // which pop a little.
      const newsLines = (items, t, fresh = () => false) =>
        items.map((n) => {
          const c = companyOf(n.key);
          const ago = t - n.at;
          const when = ago < MINUTE ? 'just now' : ago < HOUR ? `${Math.floor(ago / MINUTE)} min ago` : `${Math.floor(ago / HOUR)} h ago`;
          return h(
            'li',
            { class: fresh(n) ? 'fresh' : '' },
            h('span', { class: 'stock-icon small' }, c.icon),
            h('span', { class: 'stock-told' }, h('b', {}, `${c.name}: `), n.text, h('span', { class: 'muted stock-when' }, ` ${when}`)),
            h('span', { class: n.good ? 'stock-up' : 'stock-down', 'aria-label': n.good ? 'good news' : 'bad news' }, n.good ? '▲' : '▼'),
          );
        });

      const drawMarket = (t) => {
        const m = moodAt(t);
        mood.replaceChildren(h('b', {}, `${m.icon} ${m.name}`), h('span', { class: 'muted' }, m.text), h('span', { class: 'stock-index' }, `Index ${indexAt(t).toFixed(1)} `, change(m.change)));
        const stocks = p.data.gear.stocks;
        const w = worth(stocks, t);
        const held = Object.keys(stocks).length;
        const perDay = dividendsPerDay(stocks);
        mine.replaceChildren(
          ...(held
            ? [
                h('b', {}, `💼 Your shares: ${coins(w.value)}`),
                h('span', {}, w.gain ? [w.gain > 0 ? 'up ' : 'down ', change(w.gain, coins(Math.abs(w.gain)))] : 'just what you paid'),
                perDay ? h('span', { class: 'muted' }, `Dividends: ${coins(perDay)} a day`) : null,
              ].filter(Boolean)
            : [h('span', {}, '💼 You have no shares yet. Pick a company, and buy a tiny piece of it!')]),
        );
        for (const c of COMPANIES) {
          const r = rows.get(c.key);
          const q = quote(c.key, t);
          r.price.textContent = coins(q.price);
          r.moved.replaceChildren(change(dayChange(c.key, t)));
          r.owned.textContent = stocks[c.key] ? `You own ${stocks[c.key].n.toLocaleString()}` : '';
          r.row.setAttribute('aria-label', `${c.name}: ${q.price} coins, ${dayChange(c.key, t) >= 0 ? 'up' : 'down'} ${pct(dayChange(c.key, t))} in the last day${stocks[c.key] ? `. You own ${shares(stocks[c.key].n)}` : ''}`);
          r.spark.draw(c.key, t);
        }
        // The latest few, and a word for any just in.
        const latest = newsBetween(t - DAY, t).slice(0, 6);
        const newest = latest[0]?.at ?? 0;
        news.replaceChildren(...newsLines(latest, t, (n) => seenNews !== null && n.at > seenNews));
        if (seenNews !== null && newest > seenNews) ui.sound.play('ui');
        seenNews = Math.max(seenNews ?? 0, newest);
      };

      const drawChart = async () => {
        const s = SPANS.find((x) => x.key === spanKey);
        for (const b of spans) b.classList.toggle('on', b.dataset.span === spanKey);
        const Chart = await loadChart();
        if (closed || !open) return;
        if (!Chart) {
          chartBox.hidden = true;
          return;
        }
        const t = Date.now();
        const points = history(open, t, s.span, s.points);
        chart ??= makeChart(Chart, canvas, (i) => chart.$labels?.[i] ?? '');
        chart.$labels = points.map((x) => s.label(x.t));
        chart.data.labels = chart.$labels;
        chart.data.datasets[0].data = points.map((x) => x.price);
        chart.update('none');
        canvas.setAttribute('aria-label', `${companyOf(open).name}'s price over the last ${s.name}: from ${Math.round(points[0].price)} to ${Math.round(points.at(-1).price)} coins.`);
      };

      const drawCompany = (t) => {
        const c = companyOf(open);
        const kind = kindOf(open);
        const q = quote(open, t);
        const stocks = p.data.gear.stocks;
        const h1 = stocks[open];
        title.replaceChildren(h('span', { class: 'stock-icon' }, c.icon), h('span', { class: 'stock-name' }, h('b', {}, c.name), h('span', { class: 'muted' }, `${c.ticker} · ${kind.icon} ${kind.name}`)));
        big.replaceChildren(h('b', {}, coins(q.price)), h('span', {}, change(dayChange(open, t)), h('span', { class: 'muted' }, ' in a day')));
        // Where the price is between this week's lowest and highest.
        const week = history(open, t, 7 * DAY, 113).map((x) => x.price);
        const lo = Math.min(...week);
        const hi = Math.max(...week);
        const at = Math.round((100 * (week.at(-1) - lo)) / Math.max(hi - lo, 1e-6));
        meter.replaceChildren(
          h('span', { class: 'muted' }, `Week’s low ${coins(Math.round(lo))}`),
          h('span', { class: 'stock-track', role: 'img', 'aria-label': `The price is ${at}% of the way from this week's lowest to its highest` }, h('span', { class: 'stock-dot', style: `left:${at}%` })),
          h('span', { class: 'muted' }, `High ${coins(Math.round(hi))}`),
        );
        // What you have of it.
        if (h1) {
          const now = q.sell * h1.n;
          const gain = now - h1.paid;
          holding.replaceChildren(
            h('b', {}, `You own ${shares(h1.n)}.`),
            ` They cost you ${coins(h1.paid)}, and would sell for ${coins(now)}: `,
            ...(gain ? [change(gain, coins(Math.abs(gain))), gain > 0 ? ' more than you paid!' : ' less than you paid.'] : ['just what you paid.']),
          );
        } else {
          holding.replaceChildren('You own none of it yet.');
        }
        // Buying and selling.
        const can = canBuy(stocks, open, p.data.coins, t);
        buyLine.replaceChildren(h('b', {}, `Buy for ${coins(q.buy)}`), h('span', { class: 'muted' }, ' a share'));
        buy1.disabled = can < 1;
        buy10.disabled = can < 10;
        buyMax.textContent = can > 0 ? `Buy all I can (${can.toLocaleString()})` : 'Buy all I can';
        buyMax.disabled = can < 1;
        const have = h1?.n ?? 0;
        sellLine.replaceChildren(h('b', {}, `Sell for ${coins(q.sell)}`), h('span', { class: 'muted' }, ' a share'));
        sell1.disabled = have < 1;
        sell10.disabled = have < 10;
        sellAll.textContent = have > 0 ? `Sell all (${have.toLocaleString()})` : 'Sell all';
        sellAll.disabled = have < 1;
        hint.textContent = have >= SHARES_MAX ? `${SHARES_MAX.toLocaleString()} shares is as many as one player can own.` : can < 1 ? `You need ${q.buy - p.data.coins} more ${q.buy - p.data.coins === 1 ? 'coin' : 'coins'} for a share. Sell treasures from your basket in the 🛒 shop!` : '';
        hint.hidden = !hint.textContent;
        // What it is, how it behaves and what it pays.
        const pays = dividendOf(open, Math.max(1, have));
        about.replaceChildren(
          h('p', {}, c.what),
          h('p', { class: 'muted' }, `${kind.icon} ${kind.name}: ${kind.text}`, pays ? ` ${have ? `Your ${shares(have)} pay` : 'A share pays'} ${coins(pays)} a day.` : ''),
        );
        // The same words said again a while later would only look odd here.
        const items = newsBetween(t - 3 * DAY, t, open)
          .filter((n, i, all) => all.findIndex((m) => m.text === n.text) === i)
          .slice(0, 4);
        told.replaceChildren(...(items.length ? newsLines(items, t) : [h('li', { class: 'muted' }, 'No news lately.')]));
      };

      const draw = () => {
        const t = Date.now();
        purse.textContent = coins(p.data.coins);
        if (open) drawCompany(t);
        else drawMarket(t);
      };

      // Buying or selling: what happened, in words and a sound.
      const trade = (verb, n) => {
        const t = Date.now();
        const c = companyOf(open);
        if (verb === 'buy') {
          const got = p.buyShares(open, n, t);
          if (!got) {
            ui.sound.play('no');
            return;
          }
          ui.sound.play('stock-buy');
          ui.toast(c.icon, `You bought ${shares(got.n)} of ${c.name} for ${coins(got.cost)}!`);
        } else {
          const got = p.sellShares(open, n, t);
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
        if (open) drawChart();
      };

      const toTop = () => {
        const panel = root.closest('.panel');
        if (panel) panel.scrollTop = 0;
      };

      const show = (key) => {
        open = key;
        market.hidden = Boolean(key);
        company.hidden = !key;
        // Whichever you come to, start at the top of it.
        toTop();
        ui.sound.play('ui');
        draw();
        if (key) drawChart();
      };

      root.append(head, market, company);
      market.hidden = Boolean(open);
      company.hidden = !open;
      toTop();
      draw();
      if (open) drawChart();

      // Dividends your shares earned since you last came.
      const paid = p.collectDividends();
      if (paid) {
        ui.sound.play('stock-pay');
        ui.toast('💌', `Dividends! Your shares paid you ${coins(paid.coins)}${paid.days > 1 ? ` for ${paid.days} days` : ''}.`);
        draw();
      }

      // Prices change every tick; a second is plenty to notice. Whatever else
      // changes your coins while it is open shows too.
      lastTick = Math.floor(Date.now() / TICK_MS);
      timer = setInterval(() => {
        const tick = Math.floor(Date.now() / TICK_MS);
        if (tick === lastTick) return;
        lastTick = tick;
        draw();
        if (open) drawChart();
      }, 1000);
    },
    {
      onClose: () => {
        closed = true;
        clearInterval(timer);
        chart?.destroy();
        chart = null;
      },
    },
  );
}
