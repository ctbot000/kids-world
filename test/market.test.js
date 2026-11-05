// Where the stock market's real prices come from (server/market.js), against a
// feed answering the way the real one does: what it makes of what comes back, how
// seldom it asks, carrying on when the feed fails, noticing splits, and what the
// server and the keeper hand on to pages.
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { cleanSnapshot, COMPANIES, companyOf, DAY, HOUR, MARKETS, MINUTE, quote, SECOND, STALE_MS } from '../public/js/shared/stocks.js';
import { createGameServer } from '../server/server.js';
import { Keeper, KeeperStore, createIdentity } from '../server/keeper.js';
import { MarketFeed, splitRatio } from '../server/market.js';
import { KEEPER_VERSION } from '../public/js/shared/keeper.js';
import { Reassembler, sendText } from '../public/js/shared/framing.js';
import { fakeFeed } from './fixtures/market.js';

const NOW = Date.UTC(2026, 10, 5, 15);

// A feed answering as the real one does. opts: open, what status every price has;
// fail, to fail everything; price, a function of a company for its price.
function fakeFetch(opts = {}) {
  const asked = [];
  const days = opts.days ?? ((c) => [[20261103, 100], [20261104, 110], [20261105, 120]]);
  const ok = (body) => ({ ok: true, status: 200, json: async () => body });
  const fetch = async (url, init) => {
    asked.push({ url, init });
    if (opts.fail) throw new Error('no network');
    const { host, pathname } = new URL(url);
    if (host === 'api.frankfurter.dev') return ok({ amount: 1, base: 'USD', date: '2026-11-04', rates: { KRW: 1300, JPY: 150 } });
    if (host === 'polling.finance.naver.com') {
      const [, , , kind, what, codes] = pathname.split('/');
      const list = decodeURIComponent(codes).split(',');
      const rows = list.map((code) => {
        const row = { closePrice: '1,234.50', compareToPreviousClosePrice: '-34.50', localTradedAt: '2026-11-05T09:50:06-05:00', marketStatus: opts.open === false ? 'CLOSE' : 'OPEN' };
        return kind === 'domestic' ? { itemCode: code, ...row } : { reutersCode: code, ...row };
      });
      assert.ok(['stock', 'index'].includes(what));
      return ok({ pollingInterval: 70000, datas: rows });
    }
    if (host === 'api.stock.naver.com') {
      const code = decodeURIComponent(pathname.split('/')[4]);
      const company = COMPANIES.find((c) => c.code === code);
      if (pathname.endsWith('/day')) return ok(days(company).map(([localDate, closePrice]) => ({ localDate: String(localDate), closePrice })));
      return ok({
        lastClosePrice: 118,
        priceInfos: Array.from({ length: opts.minutes ?? 200 }, (_, i) => ({ localDateTime: `20261105${String(9 + Math.floor(i / 60)).padStart(2, '0')}${String(i % 60).padStart(2, '0')}00`, currentPrice: 120 + i / 100 })),
        lastPriceInfos: [{ localDateTime: '20261104153000', currentPrice: 118 }],
      });
    }
    throw new Error(`asked ${url}`);
  };
  return { fetch, asked };
}

function feedWith(opts = {}) {
  const clock = { t: opts.at ?? NOW };
  const logs = [];
  const f = fakeFetch(opts);
  const feed = new MarketFeed({ fetch: opts.fetch ?? f.fetch, now: () => clock.t, log: (text) => logs.push(text), pauseMs: 0, file: opts.file ?? null });
  return { feed, clock, logs, ...f };
}

test('a snapshot from what the feed says: prices with commas in, the last close from the change, the exchange rates and the indexes', async () => {
  const { feed } = feedWith();
  const raw = await feed.snapshot();
  await feed.catchingUp;
  const s = cleanSnapshot(raw);
  assert.ok(s, 'one a page takes');
  assert.equal(s.at, NOW);
  assert.deepEqual(s.fx, { KRW: 1300, JPY: 150 });
  for (const c of COMPANIES) {
    assert.equal(s.stocks[c.key].p, 1234.5, c.key);
    assert.equal(s.stocks[c.key].prev, 1269, 'the price less the change');
    assert.equal(s.stocks[c.key].open, true);
    assert.equal(s.stocks[c.key].t, Date.parse('2026-11-05T09:50:06-05:00'));
  }
  for (const m of MARKETS) assert.deepEqual(s.indexes[m.key], { p: 1234.5, prev: 1269 }, m.name);
  assert.equal(quote(s, 'samsung').coins, 0.95);
  assert.equal(quote(s, 'apple').coins, 1234.5);
});

test('it asks only the feeds it should, and says who it is without pretending to be a browser', async () => {
  const { feed, asked } = feedWith();
  await feed.snapshot();
  await feed.catchingUp;
  await feed.chart('apple', 'today');
  const hosts = new Set(asked.map(({ url }) => new URL(url).host));
  assert.deepEqual([...hosts].sort(), ['api.frankfurter.dev', 'api.stock.naver.com', 'polling.finance.naver.com'], 'not m.stock.naver.com, whose robots.txt says no');
  for (const { init } of asked) assert.equal(init.headers['User-Agent'], 'kids-world');
  // One request for all of a market's companies.
  assert.equal(asked.filter(({ url }) => url.includes('/domestic/stock/')).length, 1);
  assert.equal(asked.filter(({ url }) => url.includes('/worldstock/stock/')).length, 1);
  assert.ok(asked.find(({ url }) => url.includes('/domestic/stock/')).url.includes(companyOf('samsung').code));
  assert.ok(asked.find(({ url }) => url.includes('/worldstock/stock/')).url.includes(companyOf('nintendo').code));
});

test('it asks again no more than about once a minute with an exchange open, and far less when all are shut', async () => {
  for (const [open, gap] of [[true, 70 * SECOND], [false, 10 * MINUTE]]) {
    const { feed, clock, asked } = feedWith({ open });
    await feed.snapshot();
    await feed.catchingUp;
    const polls = () => asked.filter(({ url }) => url.includes('/stock/') && url.includes('polling')).length;
    assert.equal(polls(), 2);
    clock.t += gap - 1;
    await feed.snapshot();
    assert.equal(polls(), 2, 'still good');
    clock.t += 1;
    await feed.snapshot();
    await feed.refreshing;
    assert.equal(polls(), 4, 'and then again');
    // Nothing comes asking, nothing goes out.
    const was = asked.length;
    clock.t += 5 * DAY;
    assert.equal(asked.length, was);
  }
});

test('out of date, the last prices go out while new ones are fetched, and only the first asking waits', async () => {
  const { feed, clock } = feedWith();
  const first = await feed.snapshot();
  await feed.catchingUp;
  assert.equal(first.at, NOW, 'waited for');
  clock.t += 2 * MINUTE;
  const second = await feed.snapshot();
  assert.equal(second.at, NOW, 'not waited for');
  await feed.refreshing;
  assert.equal((await feed.snapshot()).at, clock.t);
});

test('the exchange rates are asked for a few times a day', async () => {
  const { feed, clock, asked } = feedWith();
  await feed.snapshot();
  await feed.catchingUp;
  const rates = () => asked.filter(({ url }) => url.includes('frankfurter')).length;
  assert.equal(rates(), 1);
  clock.t += HOUR;
  await feed.snapshot();
  await feed.refreshing;
  assert.equal(rates(), 1);
  clock.t += 6 * HOUR;
  await feed.snapshot();
  await feed.refreshing;
  assert.equal(rates(), 2);
});

test('the feed failing: nothing yet, or the last prices, told once, and then coming back', async () => {
  const f = fakeFetch();
  let down = true;
  const logs = [];
  const clock = { t: NOW };
  const feed = new MarketFeed({ fetch: (...args) => (down ? Promise.reject(new Error('no network')) : f.fetch(...args)), now: () => clock.t, log: (text) => logs.push(text), pauseMs: 0 });
  assert.equal(await feed.snapshot(), null, 'nothing to give, and no throwing');
  await feed.catchingUp;
  assert.equal(logs.length, 1);
  assert.match(logs[0], /no network/);
  down = false;
  clock.t += HOUR;
  await feed.snapshot();
  await feed.refreshing;
  await feed.catchingUp;
  assert.ok(feed.current());
  assert.match(logs[1], /coming in again/);
  const good = feed.current().at;
  // Failing again: the same prices, getting older.
  down = true;
  clock.t += HOUR;
  await feed.snapshot();
  await feed.refreshing;
  assert.equal(feed.current().at, good);
  assert.equal(logs.length, 3);
  clock.t += HOUR;
  await feed.snapshot();
  await feed.refreshing;
  assert.equal(logs.length, 3, 'told only the once');
  assert.ok(clock.t - feed.current().at < STALE_MS);
  // A bad answer is failing too.
  down = false;
  const bad = new MarketFeed({ fetch: async () => ({ ok: false, status: 429 }), now: () => clock.t, log: (text) => logs.push(text), pauseMs: 0 });
  assert.equal(await bad.snapshot(), null);
  assert.match(logs.at(-1), /429/);
});

test('each company\'s last year: its month, lowest and highest, fetched only a few times a day, one at a time', async () => {
  const { feed, clock, asked } = feedWith();
  await feed.snapshot();
  await feed.catchingUp;
  const years = () => asked.filter(({ url }) => url.includes('/day?')).length;
  assert.equal(years(), COMPANIES.length);
  const url = asked.find((a) => a.url.includes('/day?')).url;
  assert.match(url, /startDateTime=2025\d{4}0000&endDateTime=20261106/);
  const s = await feed.snapshot();
  assert.deepEqual(s.stocks.apple.month, [100, 110, 120]);
  assert.equal(s.stocks.apple.lo, 100);
  assert.equal(s.stocks.apple.hi, 120);
  clock.t += 5 * HOUR;
  await feed.snapshot();
  await feed.refreshing;
  await feed.catchingUp;
  assert.equal(years(), COMPANIES.length, 'still good');
  clock.t += HOUR;
  await feed.snapshot();
  await feed.refreshing;
  await feed.catchingUp;
  assert.equal(years(), 2 * COMPANIES.length);
});

test('only tidy numbers of shares are splits', () => {
  assert.equal(splitRatio(10), 10);
  assert.equal(splitRatio(10.3), 10);
  assert.equal(splitRatio(2), 2);
  assert.equal(splitRatio(1.5), 1.5);
  assert.equal(splitRatio(0.1), 0.1, 'ten into one');
  assert.equal(splitRatio(0.5), 0.5);
  for (const no of [1, 1.05, 1.3, 0.8, 2.5, 12, NaN, -1, 0]) assert.equal(splitRatio(no), null, `not ${no}`);
});

test('a company splitting its shares: its past closes marked down say so, at the next day\'s opening', async () => {
  let days = [[20261103, 1000], [20261104, 1100], [20261105, 1200]];
  const logs = [];
  const f = fakeFetch({ days: (c) => (c.key === 'netflix' ? days : [[20261104, 50], [20261105, 50]]) });
  const clock = { t: NOW };
  const feed = new MarketFeed({ fetch: f.fetch, now: () => clock.t, log: (t) => logs.push(t), pauseMs: 0 });
  await feed.snapshot();
  await feed.catchingUp;
  assert.deepEqual((await feed.snapshot()).stocks.netflix.splits, []);
  // Today's close moving on is no split, however far; nor is a new day.
  clock.t += 7 * HOUR;
  days = [[20261103, 1000], [20261104, 1100], [20261105, 500]];
  await feed.snapshot();
  await feed.refreshing;
  await feed.catchingUp;
  assert.deepEqual((await feed.snapshot()).stocks.netflix.splits, [], 'the last day, still going');
  // The next day, every close a tenth of what it was: ten for one.
  clock.t += DAY;
  days = [[20261103, 100], [20261104, 110], [20261105, 50], [20261106, 52]];
  await feed.snapshot();
  await feed.refreshing;
  await feed.catchingUp;
  const { splits } = (await feed.snapshot()).stocks.netflix;
  assert.equal(splits.length, 1);
  assert.equal(splits[0][1], 10);
  assert.equal(splits[0][0], Date.UTC(2026, 10, 6, 14, 30), 'when New York opened on the day after');
  assert.ok(logs.some((t) => t.includes('Netflix split')));
  // Not told twice.
  clock.t += DAY;
  days = [[20261104, 110], [20261105, 50], [20261106, 52], [20261109, 53]];
  await feed.snapshot();
  await feed.refreshing;
  await feed.catchingUp;
  assert.equal((await feed.snapshot()).stocks.netflix.splits.length, 1);
  // The others, no.
  assert.deepEqual((await feed.snapshot()).stocks.apple.splits, []);
});

test('charts: today by the minute, thinned; a month and a year of closes; nothing for what is not there', async () => {
  const { feed, clock, asked } = feedWith();
  await feed.snapshot();
  await feed.catchingUp;
  const today = await feed.chart('apple', 'today');
  assert.equal(today.key, 'apple');
  assert.equal(today.points.length, 90, 'thinned');
  assert.equal(today.prev, 118);
  assert.equal(today.points[0][0], Date.UTC(2026, 10, 5, 14), '09:00 in New York, in winter');
  assert.equal(today.points[0][1], 120);
  assert.equal(today.points.at(-1)[1], 121.99, 'to the last');
  const n = asked.length;
  await feed.chart('apple', 'today');
  assert.equal(asked.length, n, 'kept a while');
  clock.t += 71 * SECOND;
  await feed.chart('apple', 'today');
  assert.equal(asked.length, n + 1);
  const month = await feed.chart('apple', 'month');
  assert.equal(month.points.length, 3);
  assert.deepEqual(month.points[0], [Date.UTC(2026, 10, 3, 5), 100], 'that day in New York');
  assert.equal((await feed.chart('apple', 'year')).points.length, 3);
  assert.equal(await feed.chart('nope', 'today'), null);
  assert.equal(await feed.chart('apple', 'decade'), null);
  // In Seoul's time, from Seoul's feed.
  const seoul = await feed.chart('samsung', 'today');
  assert.equal(seoul.points[0][0], Date.UTC(2026, 10, 5, 0));
  assert.ok(asked.some(({ url }) => url.includes(`/domestic/item/${companyOf('samsung').code}?periodType=day`)));
  assert.ok(asked.some(({ url }) => url.includes('/foreign/item/AAPL.O?periodType=day')));
});

test('a chart with the feed down: what it had, or none', async () => {
  const f = fakeFetch();
  let down = false;
  const clock = { t: NOW };
  const feed = new MarketFeed({ fetch: (...a) => (down ? Promise.reject(new Error('no network')) : f.fetch(...a)), now: () => clock.t, log: () => {}, pauseMs: 0 });
  const before = await feed.chart('apple', 'today');
  down = true;
  clock.t += HOUR;
  assert.deepEqual((await feed.chart('apple', 'today')).points, before.points);
  assert.deepEqual((await feed.chart('sony', 'today')).points, []);
  assert.deepEqual((await feed.chart('sony', 'year')).points, []);
});

test('with no minutes yet today, a chart shows the last day that had any', async () => {
  const { feed } = feedWith({ minutes: 0 });
  const today = await feed.chart('apple', 'today');
  assert.deepEqual(today.points, [[Date.UTC(2026, 10, 4, 20, 30), 118]]);
});

test('what it fetched is kept, so a restart starts with it', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'kw-market-'));
  try {
    const file = join(dir, 'market.json');
    const first = feedWith({ file });
    await first.feed.snapshot();
    await first.feed.catchingUp;
    await first.feed.save();
    await first.feed.saving;
    const second = feedWith({ file });
    const s = await second.feed.snapshot();
    assert.equal(s.at, NOW, 'the prices it had');
    assert.deepEqual(s.stocks.apple.month, [100, 110, 120]);
    await second.feed.catchingUp;
    assert.equal(second.asked.length, 0, 'and no need to go asking');
    // A file that makes no sense is no trouble.
    const { writeFile } = await import('node:fs/promises');
    await writeFile(file, 'not json');
    const third = feedWith({ file });
    assert.equal((await third.feed.snapshot()).at, NOW);
    await third.feed.catchingUp;
    await third.feed.saving;
  } finally {
    await rm(dir, { recursive: true, force: true, maxRetries: 5 });
  }
});

test('the server hands its pages the prices, and has none to hand without a feed', async () => {
  const withFeed = createGameServer({ log: () => {}, market: fakeFeed() });
  const without = createGameServer({ log: () => {} });
  const listen = (s) => new Promise((r) => s.listen(0, '127.0.0.1', () => r(`http://127.0.0.1:${s.address().port}`)));
  try {
    const base = await listen(withFeed);
    const res = await fetch(`${base}/market.json`);
    assert.equal(res.status, 200);
    assert.equal(res.headers.get('cache-control'), 'no-store');
    assert.ok(cleanSnapshot(await res.json()));
    const chart = await (await fetch(`${base}/market-chart.json?key=apple&span=today`)).json();
    assert.equal(chart.key, 'apple');
    assert.equal(chart.points.length, 30);
    const bare = await listen(without);
    assert.equal((await fetch(`${bare}/market.json`)).status, 404);
    assert.equal((await fetch(`${bare}/market-chart.json?key=apple&span=today`)).status, 404);
  } finally {
    await withFeed.shutdown();
    await without.shutdown();
  }
});

test('the keeper hands any page the prices and charts, logged in or not, and says so with none', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'kw-market-'));
  try {
    const store = await new KeeperStore(dir).open();
    const keeper = new Keeper({ store, identity: await createIdentity(dir), log: () => {} });
    await keeper.loadKey();
    const replies = [];
    const pieces = new Reassembler();
    const conn = keeper.connection({ id: 'page', peer: 'page', pc: { close() {} } });
    conn.dc = {
      isOpen: () => !conn.closed,
      sendMessage: (piece) => {
        const text = pieces.accept(piece);
        if (text != null) replies.push(JSON.parse(text));
      },
      close() {},
    };
    keeper.conns.set(conn.id, conn);
    const say = async (msg) => {
      const parts = [];
      sendText({ send: (part) => parts.push(part) }, JSON.stringify(msg));
      for (const part of parts) await keeper.receive(conn, part);
      return replies.at(-1);
    };
    await say({ t: 'hello', v: KEEPER_VERSION, nonce: 'ab'.repeat(16) });
    await say({ t: 'me', device: 'd'.repeat(32) });
    assert.deepEqual(await say({ t: 'market' }), { t: 'market', market: null }, 'no feed, no prices');
    assert.deepEqual(await say({ t: 'market-chart', key: 'apple', span: 'today' }), { t: 'market-chart', chart: null });
    keeper.market = fakeFeed();
    const { market } = await say({ t: 'market' });
    assert.ok(cleanSnapshot(market));
    const { chart } = await say({ t: 'market-chart', key: 'apple', span: 'today' });
    assert.equal(chart.points.length, 30);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
