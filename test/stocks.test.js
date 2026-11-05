// The stock market: prices from the clock alone, going up and down without ever
// running away, the same for everybody; the gap between buying and selling, so a
// quick flip loses and a real move pays; the news; what you own, as kept, bought,
// sold, merged and paid dividends; its furniture and models, and the Stock
// Exchange stamp whichever way it faces.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as B from '../public/js/shared/blocks.js';
import { furnitureDrop, modelBoxes } from '../public/js/shared/furniture.js';
import { addProgress, keptProfile, mergeProfiles } from '../public/js/shared/keeper.js';
import { XP_FOR } from '../public/js/shared/levels.js';
import { LightMap } from '../public/js/shared/light.js';
import { cleanGear, COINS_MAX } from '../public/js/shared/shop.js';
import { placeTemplate, stampByKey } from '../public/js/shared/stamps.js';
import { STAT_KEYS, STICKERS } from '../public/js/shared/stickers.js';
import {
  addStocks,
  buying,
  canBuy,
  cleanDivDay,
  cleanStocks,
  COMPANIES,
  companiesHeld,
  companyOf,
  DAY,
  dayChange,
  DIVIDEND_DAYS,
  dividendOf,
  dividendsDue,
  dividendsPerDay,
  history,
  HOUR,
  indexAt,
  isTerminal,
  isTicker,
  kindOf,
  KINDS,
  marketDay,
  MINUTE,
  moodAt,
  newsBetween,
  NEWS_EVERY,
  priceAt,
  quote,
  selling,
  SHARES_MAX,
  terminalNear,
  TICK_MS,
  worth,
} from '../public/js/shared/stocks.js';
import { MAX_EDIT_CELLS, validCells } from '../public/js/shared/tools.js';
import { World } from '../public/js/shared/world.js';

const THREE = await import('../public/vendor/three.module.js');
const { SCREEN, STOCK_KINDS, TICKER, TICKER_BLOCKS, stockMaterials, stockModel, tickerPlace, tickerStrip } = await import('../public/js/render/stock-model.js');
const PIECES = [B.STOCK_TERMINAL, B.STOCK_TICKER, B.BULL_STATUE, B.BEAR_STATUE];

const NOW = Date.UTC(2026, 10, 5, 3);
// Moments spread over a long while, the same each run.
const moments = (n, span = 300 * DAY, from = NOW) => Array.from({ length: n }, (_, i) => from + Math.floor(((i + 0.5) / n) * span));

function spread(key, times) {
  const logs = times.map((t) => Math.log(priceAt(key, t) / companyOf(key).base));
  const mean = logs.reduce((a, b) => a + b, 0) / logs.length;
  return { mean, sd: Math.sqrt(logs.reduce((a, b) => a + (b - mean) ** 2, 0) / logs.length) };
}

// ---------------------------------------------------------------- the companies

test('eight companies with a name, ticker, icon and news of their own, in three kinds', () => {
  assert.equal(COMPANIES.length, 8);
  for (const field of ['key', 'ticker', 'name', 'icon']) assert.equal(new Set(COMPANIES.map((c) => c[field])).size, COMPANIES.length, `each ${field} its own`);
  for (const c of COMPANIES) {
    assert.ok(/^[A-Z]{3,4}$/.test(c.ticker), c.ticker);
    assert.ok(KINDS[c.kind], `${c.key} has a kind`);
    assert.ok(Number.isInteger(c.base) && c.base >= 10, `${c.key} is affordable at ${c.base}`);
    assert.ok(c.what.length > 10);
    assert.ok(c.good.length >= 3 && c.bad.length >= 3, `${c.key} has news both ways`);
    assert.equal(companyOf(c.key), c);
    assert.equal(kindOf(c.key), KINDS[c.kind]);
  }
  assert.equal(companyOf('nope'), null);
  assert.ok(new Set(COMPANIES.map((c) => c.kind)).size === 3, 'some of each kind');
  assert.ok(COMPANIES.some((c) => c.base <= 25), 'one a new player can afford');
});

// ---------------------------------------------------------------- prices

test('a price comes from the time alone: the same however often asked, and steady within a tick', () => {
  for (const c of COMPANIES) {
    assert.equal(priceAt(c.key, NOW), priceAt(c.key, NOW), 'the same for everybody');
    const start = Math.floor(NOW / TICK_MS) * TICK_MS;
    assert.equal(priceAt(c.key, start), priceAt(c.key, start + TICK_MS - 1), 'steady within a tick');
  }
  assert.equal(priceAt('nope', NOW), 0);
  assert.equal(quote('nope', NOW), null);
  // Moving, and not all together: on a given stretch they go their own ways.
  const moves = COMPANIES.map((c) => priceAt(c.key, NOW + HOUR) / priceAt(c.key, NOW));
  assert.ok(new Set(moves.map((m) => m.toFixed(4))).size === COMPANIES.length, 'each moves its own way');
  assert.ok(moves.some((m) => m > 1) && moves.some((m) => m < 1), 'some up and some down');
});

test('prices never run away or fall to nothing, and wander about what is usual for them', () => {
  const times = moments(6000, 3 * 365 * DAY);
  for (const c of COMPANIES) {
    for (const t of times) {
      const p = priceAt(c.key, t);
      assert.ok(p >= c.base * 0.3 && p <= c.base * 3.3, `${c.key} at ${p} from ${c.base}`);
      assert.ok(Number.isFinite(p));
    }
    const { mean } = spread(c.key, times);
    assert.ok(Math.abs(mean) < 0.04, `${c.key} stays about usual over the years (${mean.toFixed(3)})`);
  }
  // Far ahead too: nothing in it wears out as the numbers grow.
  for (const c of COMPANIES) assert.ok(priceAt(c.key, Date.UTC(2090, 0, 1)) > 0);
});

test('the wild ones move the most and the steady ones the least, but all of them move', () => {
  const times = moments(4000);
  const sd = Object.fromEntries(COMPANIES.map((c) => [c.key, spread(c.key, times).sd]));
  const of = (kind) => COMPANIES.filter((c) => c.kind === kind).map((c) => sd[c.key]);
  assert.ok(Math.max(...of('steady')) < Math.min(...of('bouncy')), 'steady under bouncy');
  assert.ok(Math.max(...of('bouncy')) < Math.min(...of('wild')), 'bouncy under wild');
  assert.ok(Math.min(...of('steady')) > 0.03, 'even a steady one goes somewhere');
  assert.ok(Math.max(...of('wild')) < 0.3, 'even a wild one stays in reason');
  // Something happens within a sitting: in 20 minutes prices have usually moved
  // by more than the gap between buying and selling, on all but the steady ones.
  for (const c of COMPANIES.filter((x) => x.kind !== 'steady')) {
    const moved = moments(500).filter((t) => Math.abs(priceAt(c.key, t + 20 * MINUTE) / priceAt(c.key, t) - 1) > 0.0202).length;
    assert.ok(moved > 250, `${c.key} moved enough in 20 minutes ${moved} times of 500`);
  }
});

test('you buy for more than you sell for, in whole coins, and only a real move in the price pays', () => {
  for (const c of COMPANIES) {
    for (const t of moments(400)) {
      const { price, buy, sell } = quote(c.key, t);
      for (const n of [price, buy, sell]) assert.ok(Number.isInteger(n) && n >= 1);
      assert.ok(buy > sell, `${c.key}: ${buy} to buy, ${sell} to sell`);
      assert.ok(buy >= price && sell <= price, 'either side of the price');
      assert.ok(buy - sell <= Math.max(2, Math.ceil(price * 0.03)), 'not a big gap');
    }
  }
  // However the rounding falls: selling for more than you bought for takes the
  // real price going up by more than the gap.
  for (const c of COMPANIES) {
    for (const t of moments(1500)) {
      const later = t + 11 * MINUTE;
      if (quote(c.key, later).sell > quote(c.key, t).buy) assert.ok(priceAt(c.key, later) / priceAt(c.key, t) > 1.02, `${c.key} at ${t}`);
    }
  }
});

test('flipping shares loses: a quick buy and sell almost never pays, but waiting often can', () => {
  const wins = (span) => {
    let won = 0;
    let n = 0;
    for (const c of COMPANIES) {
      for (const t of moments(300)) {
        n++;
        if (quote(c.key, t + span).sell > quote(c.key, t).buy) won++;
      }
    }
    return won / n;
  };
  assert.equal(wins(0), 0, 'straight away, never');
  assert.ok(wins(MINUTE) < 0.02, `after a minute ${wins(MINUTE)}`);
  assert.ok(wins(HOUR) > 0.15, `after an hour ${wins(HOUR)}`);
  // On average, buying at any old moment and selling at any other just loses
  // the gap: no free money, whichever company.
  for (const c of COMPANIES) {
    const times = moments(1500);
    const mean = times.reduce((sum, t) => sum + quote(c.key, t + 3 * DAY).sell / quote(c.key, t).buy - 1, 0) / times.length;
    assert.ok(mean < 0.03 && mean > -0.08, `${c.key} on average ${mean.toFixed(3)}`);
  }
});

test('buying when a company is cheap and selling when it is dear pays, as it should', () => {
  // A share bought at the lowest of a week and sold at the highest of the next.
  for (const c of COMPANIES) {
    const lows = history(c.key, NOW + 7 * DAY, 7 * DAY, 200).map((p) => p.price);
    const highs = history(c.key, NOW + 14 * DAY, 7 * DAY, 200).map((p) => p.price);
    assert.ok(Math.max(...highs) / Math.min(...lows) > 1.05, c.key);
  }
});

test('how a company did in the last day, how the whole market did, and its mood', () => {
  for (const c of COMPANIES) {
    assert.equal(dayChange(c.key, NOW), priceAt(c.key, NOW) / priceAt(c.key, NOW - DAY) - 1);
  }
  assert.equal(dayChange('nope', NOW), 0);
  const times = moments(2000);
  const indexes = times.map((t) => indexAt(t));
  assert.ok(Math.min(...indexes) > 60 && Math.max(...indexes) < 150, 'about 100');
  const seen = new Set();
  for (const t of times) {
    const m = moodAt(t);
    seen.add(m.key);
    if (m.key === 'bull') assert.ok(m.change > 0);
    if (m.key === 'bear') assert.ok(m.change < 0);
    assert.ok(m.icon && m.name && m.text);
  }
  assert.deepEqual([...seen].sort(), ['bear', 'bull', 'calm'], 'all three moods come round');
});

test('a chart: as many points as asked, in order, up to now', () => {
  const h = history('burrow', NOW, DAY, 97);
  assert.equal(h.length, 97);
  assert.equal(h.at(-1).t, NOW);
  assert.equal(h[0].t, NOW - DAY);
  assert.equal(h.at(-1).price, priceAt('burrow', NOW));
  for (let i = 1; i < h.length; i++) assert.ok(h[i].t > h[i - 1].t);
});

// ---------------------------------------------------------------- the news

test('the news: never from the future, moves the price the way it says, and fades', () => {
  const from = NOW - 40 * DAY;
  const news = newsBetween(from, NOW);
  assert.ok(news.length / 40 > 15 && news.length / 40 < 50, `${news.length / 40} a day: about one an hour`);
  for (const n of news) {
    assert.ok(n.at > from && n.at <= NOW, 'between them');
    const c = companyOf(n.key);
    assert.ok((n.good ? c.good : c.bad).includes(n.text), `${n.text} is about ${c.name}, as ${n.good ? 'good' : 'bad'} news`);
    assert.ok(n.size > 0.04 && n.size < 0.2, 'a jump, not a catastrophe');
  }
  for (let i = 1; i < news.length; i++) assert.ok(news[i].at <= news[i - 1].at, 'the latest first');
  assert.ok(news.some((n) => n.good) && news.some((n) => !n.good));
  assert.equal(newsBetween(NOW, NOW - DAY).length, 0);
  // What has not happened yet is not in it, even if it is on the way.
  const later = newsBetween(NOW - 3 * NEWS_EVERY, NOW + 3 * NEWS_EVERY);
  assert.deepEqual(newsBetween(NOW - 3 * NEWS_EVERY, NOW), later.filter((n) => n.at <= NOW));

  // Good news sends the price up, bad news down, on average over many: from
  // just before it, to a few minutes after it has jumped.
  const sum = { good: [0, 0], bad: [0, 0] };
  for (const n of newsBetween(NOW - 200 * DAY, NOW)) {
    const moved = Math.log(priceAt(n.key, n.at + 3 * MINUTE) / priceAt(n.key, n.at - TICK_MS));
    const side = sum[n.good ? 'good' : 'bad'];
    side[0] += moved;
    side[1]++;
  }
  assert.ok(sum.good[0] / sum.good[1] > 0.03, `good news moves it up ${sum.good[0] / sum.good[1]}`);
  assert.ok(sum.bad[0] / sum.bad[1] < -0.03, `bad news moves it down ${sum.bad[0] / sum.bad[1]}`);
});

test('the same news is not told twice running about a company', () => {
  for (const c of COMPANIES) {
    const items = newsBetween(NOW - 60 * DAY, NOW, c.key);
    assert.ok(items.length > 20, `${c.key} is in the news`);
    assert.ok(items.every((n) => n.key === c.key));
    for (let i = 1; i < items.length; i++) {
      if (items[i].at > items[i - 1].at - 3 * NEWS_EVERY) assert.notEqual(items[i].text, items[i - 1].text, `${c.key} at ${items[i].at}`);
    }
  }
  assert.deepEqual(newsBetween(NOW - DAY, NOW, 'nope'), []);
});

// ---------------------------------------------------------------- what you own

test('shares as kept: only companies there are, whole numbers, nothing silly', () => {
  assert.deepEqual(cleanStocks(null), {});
  assert.deepEqual(cleanStocks('hi'), {});
  assert.deepEqual(cleanStocks({ nope: { n: 3, paid: 10 }, burrow: { n: 0, paid: 5 }, candy: { n: -2, paid: 5 }, robot: { n: 1.5, paid: 5 }, car: { n: '3', paid: 5 }, rocket: 7 }), {});
  assert.deepEqual(cleanStocks({ burrow: { n: 3, paid: 180 } }), { burrow: { n: 3, paid: 180 } });
  assert.deepEqual(cleanStocks({ burrow: { n: 3, paid: -1 } }), { burrow: { n: 3, paid: 0 } });
  assert.deepEqual(cleanStocks({ burrow: { n: 3, paid: 'x' } }), { burrow: { n: 3, paid: 0 } });
  assert.equal(cleanStocks({ burrow: { n: 10 ** 9, paid: 1 } }).burrow.n, SHARES_MAX);
  assert.ok(cleanStocks({ burrow: { n: 1, paid: 10 ** 12 } }).burrow.paid < 10 ** 6, 'no silly sums');
  assert.equal(cleanDivDay(20000), 20000);
  for (const bad of [-1, 0, 1.5, 'x', null]) assert.equal(cleanDivDay(bad), 0);
  // With your gear, wherever that goes.
  const gear = cleanGear({ stocks: { burrow: { n: 3, paid: 180 }, nope: { n: 1, paid: 1 } }, divDay: 20000 });
  assert.deepEqual(gear.stocks, { burrow: { n: 3, paid: 180 } });
  assert.equal(gear.divDay, 20000);
  assert.deepEqual(cleanGear({}).stocks, {});
  assert.equal(cleanGear({}).divDay, 0);
  assert.equal(companiesHeld(gear.stocks), 1);
  assert.equal(companiesHeld(undefined), 0);
});

test('buying and selling: the sums, an average price, and refusing what cannot be done', () => {
  const t = NOW;
  const q = quote('burrow', t);
  const got = buying({}, 'burrow', 3, 10000, t);
  assert.deepEqual(got, { stocks: { burrow: { n: 3, paid: q.buy * 3 } }, n: 3, cost: q.buy * 3 });
  // More bought later: what they all cost adds up.
  const more = buying(got.stocks, 'burrow', 1, 10000, t + DAY);
  assert.equal(more.stocks.burrow.n, 4);
  assert.equal(more.stocks.burrow.paid, q.buy * 3 + quote('burrow', t + DAY).buy);
  // Not with these coins, nor a silly number, nor a company that is not there.
  assert.equal(buying({}, 'burrow', 3, q.buy * 3 - 1, t), null);
  assert.ok(buying({}, 'burrow', 3, q.buy * 3, t), 'just enough');
  for (const n of [0, -1, 1.5, '2', null]) assert.equal(buying({}, 'burrow', n, 10000, t), null, `not ${n}`);
  assert.equal(buying({}, 'nope', 1, 10000, t), null);
  // Only so many of one company.
  assert.equal(canBuy({ burrow: { n: SHARES_MAX - 2, paid: 1 } }, 'burrow', 99999, t), 2);
  assert.equal(buying({ burrow: { n: SHARES_MAX, paid: 1 } }, 'burrow', 1, 99999, t), null);
  assert.equal(canBuy({}, 'burrow', q.buy * 7 + 1, t), 7);
  assert.equal(canBuy({}, 'burrow', 0, t), 0);
  assert.equal(canBuy({}, 'nope', 99999, t), 0);

  // Selling some takes the average of what they cost; selling the rest, all the
  // rest of it, whatever the rounding.
  const held = { burrow: { n: 3, paid: 100 } };
  const sell1 = selling(held, 'burrow', 1, t);
  assert.equal(sell1.coins, q.sell);
  assert.equal(sell1.profit, q.sell - 33);
  assert.deepEqual(sell1.stocks, { burrow: { n: 2, paid: 67 } });
  const sell2 = selling(sell1.stocks, 'burrow', 2, t);
  assert.equal(sell2.profit, q.sell * 2 - 67);
  assert.deepEqual(sell2.stocks, {}, 'none left, none kept');
  assert.equal(selling(held, 'burrow', 4, t), null);
  assert.equal(selling(held, 'candy', 1, t), null);
  assert.equal(selling(held, 'burrow', 0, t), null);
  assert.equal(selling(held, 'burrow', 1.5, t), null);
  assert.deepEqual(held, { burrow: { n: 3, paid: 100 } }, 'none of it changes what it was given');
});

test('what all your shares would fetch and what they cost', () => {
  const stocks = { burrow: { n: 2, paid: 100 }, carrot: { n: 10, paid: 150 } };
  const w = worth(stocks, NOW);
  const value = quote('burrow', NOW).sell * 2 + quote('carrot', NOW).sell * 10;
  assert.deepEqual(w, { value, paid: 250, gain: value - 250 });
  assert.deepEqual(worth({}, NOW), { value: 0, paid: 0, gain: 0 });
  assert.deepEqual(worth(undefined, NOW), { value: 0, paid: 0, gain: 0 });
});

test('dividends: steady ones pay the most, wild ones nothing, and at least a coin for owning any', () => {
  const steady = COMPANIES.find((c) => c.kind === 'steady');
  const bouncy = COMPANIES.find((c) => c.kind === 'bouncy');
  const wild = COMPANIES.find((c) => c.kind === 'wild');
  assert.equal(dividendOf(wild.key, 100), 0);
  assert.equal(dividendOf(steady.key, 1), 1, 'even a single share');
  assert.equal(dividendOf(bouncy.key, 1), 1);
  assert.equal(dividendOf(steady.key, 0), 0);
  assert.equal(dividendOf('nope', 10), 0);
  // For the same coins, a steady company pays more than a bouncy one.
  const coins = 100000;
  assert.ok(dividendOf(steady.key, Math.floor(coins / steady.base)) > dividendOf(bouncy.key, Math.floor(coins / bouncy.base)));
  // Less than a price can be expected to move: a sweetener, not a money machine.
  for (const c of COMPANIES) assert.ok(dividendOf(c.key, 1000) <= c.base * 1000 * 0.01, c.key);
  assert.equal(dividendsPerDay({ [steady.key]: { n: 1, paid: 1 }, [wild.key]: { n: 50, paid: 1 } }), 1);
  assert.equal(dividendsPerDay({}), 0);
  assert.equal(dividendsPerDay(undefined), 0);

  const stocks = { [steady.key]: { n: 10, paid: 1 } };
  const perDay = dividendOf(steady.key, 10);
  assert.deepEqual(dividendsDue(stocks, 100, 100), { days: 0, coins: 0 }, 'paid already today');
  assert.deepEqual(dividendsDue(stocks, 100, 101), { days: 1, coins: perDay });
  assert.deepEqual(dividendsDue(stocks, 100, 103), { days: 3, coins: 3 * perDay });
  assert.deepEqual(dividendsDue(stocks, 100, 500), { days: DIVIDEND_DAYS, coins: DIVIDEND_DAYS * perDay }, 'only so many days wait for you');
  assert.deepEqual(dividendsDue(stocks, 0, 500), { days: 0, coins: 0 }, 'nothing for days before you had any');
  assert.deepEqual(dividendsDue(stocks, 500, 100), { days: 0, coins: 0 }, 'a clock gone back owes nothing');
  // A market day starts at midnight in Korea.
  const midnight = Date.UTC(2026, 10, 5, 15);
  assert.equal(marketDay(midnight) - marketDay(midnight - 1), 1);
  assert.equal(marketDay(midnight + DAY - 1), marketDay(midnight));
});

test('the keeper keeps your shares, a newer device wins, and a guest brings theirs along', () => {
  const profile = { name: 'Sunny Otter', changedAt: 5, gear: { stocks: { burrow: { n: 3, paid: 180 }, nope: { n: 1, paid: 1 } }, divDay: 20000 } };
  const kept = keptProfile(profile);
  assert.deepEqual(kept.gear.stocks, { burrow: { n: 3, paid: 180 } });
  assert.equal(kept.gear.divDay, 20000);
  // Sent to the keeper and back, the same.
  assert.deepEqual(keptProfile(JSON.parse(JSON.stringify(kept))).gear.stocks, kept.gear.stocks);
  const newer = { name: 'Sunny Otter', changedAt: 9, gear: { stocks: { candy: { n: 1, paid: 40 } }, divDay: 20001 } };
  assert.deepEqual(mergeProfiles(profile, newer).gear.stocks, { candy: { n: 1, paid: 40 } }, 'sold on one device stays sold');
  assert.deepEqual(mergeProfiles(newer, profile).gear.stocks, { candy: { n: 1, paid: 40 } }, 'whichever asks');
  // What you did as a guest joins your login.
  const added = addProgress({ gear: { stocks: { burrow: { n: 3, paid: 180 } }, divDay: 20000 } }, { gear: { stocks: { burrow: { n: 2, paid: 100 }, candy: { n: 1, paid: 40 } }, divDay: 20002 } });
  assert.deepEqual(added.gear.stocks, { burrow: { n: 5, paid: 280 }, candy: { n: 1, paid: 40 } });
  assert.equal(added.gear.divDay, 20002);
  assert.deepEqual(addStocks(undefined, { burrow: { n: 1, paid: 2 } }), { burrow: { n: 1, paid: 2 } });
  assert.equal(addStocks({ burrow: { n: SHARES_MAX, paid: 2 } }, { burrow: { n: 5, paid: 2 } }).burrow.n, SHARES_MAX);
});

// ---------------------------------------------------------------- your profile

let profiles = 0;

async function withProfile(run) {
  const store = new Map();
  globalThis.localStorage = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k), clear: () => store.clear(), key: (i) => [...store.keys()][i], get length() { return store.size; } };
  try {
    const { Profile } = await import('../public/js/profile.js');
    // Under a key of its own: what is kept in memory outlives the store above.
    const key = `stocks-test-${profiles++}`;
    await run(new Profile(key), Profile, key);
  } finally {
    delete globalThis.localStorage;
  }
}

test('your profile buys and sells: the coins and shares change, are kept, and earn stickers and XP', async () => {
  await withProfile(async (p, Profile, key) => {
    const t = NOW;
    const q = quote('burrow', t);
    assert.equal(p.buyShares('burrow', 1, t), null, 'no coins, no shares');
    assert.deepEqual(p.data.gear.stocks, {});
    p.earn(q.buy * 5 + 3);
    const earned = p.data.stats.earned;
    const before = p.progress.xp;
    assert.deepEqual(p.buyShares('burrow', 5, t), { n: 5, cost: q.buy * 5 });
    assert.equal(p.data.coins, 3);
    assert.deepEqual(p.data.gear.stocks, { burrow: { n: 5, paid: q.buy * 5 } });
    assert.ok(p.data.stickers['first-share'], 'the sticker');
    assert.equal(p.data.stats.stockbuys, 1);
    assert.equal(p.data.stats.stocksheld, 1);
    assert.ok(p.progress.xp > before, 'XP for it');
    assert.equal(p.data.stats.earned, earned, 'spending earns nothing');
    assert.deepEqual(new Profile(key).data.gear.stocks, p.data.gear.stocks, 'kept on this device');
    // Sold for less than they cost: your coins back, and nothing earned.
    const sold = p.sellShares('burrow', 2, t);
    assert.equal(sold.n, 2);
    assert.equal(sold.coins, q.sell * 2);
    assert.ok(sold.profit < 0);
    assert.equal(p.data.coins, 3 + q.sell * 2);
    assert.equal(p.data.stats.earned, earned, 'your own coins coming back are not earned');
    assert.equal(p.data.stats.stockwins, 0);
    assert.equal(p.data.gear.stocks.burrow.n, 3);
    assert.equal(p.sellShares('burrow', 4, t), null, 'not more than you have');
    assert.equal(p.sellShares('candy', 1, t), null, 'not what you do not have');
    // Sold for more: only the profit counts as earned, towards the Millionaire
    // sticker too, so going round and round earns nothing.
    p.data.gear.stocks.burrow.paid = 3;
    const won = p.sellShares('burrow', 3, t);
    assert.equal(won.profit, q.sell * 3 - 3);
    assert.equal(p.data.stats.earned, earned + won.profit);
    assert.equal(p.data.stats.stockwins, 1);
    assert.equal(p.data.stats.stockgain, won.profit);
    assert.ok(p.data.stickers['buy-low']);
    assert.deepEqual(p.data.gear.stocks, {});
  });
});

test('owning every company earns its sticker, and profit its two', async () => {
  await withProfile(async (p) => {
    p.earn(COINS_MAX);
    const t = NOW;
    COMPANIES.forEach((c, i) => {
      assert.ok(!p.data.stickers['every-basket'], `not with ${i}`);
      assert.ok(p.buyShares(c.key, 1, t));
    });
    assert.ok(p.data.stickers['every-basket']);
    assert.equal(p.data.stats.stocksheld, COMPANIES.length);
    // Selling them does not take it back, nor the count.
    p.data.coins = 0;
    for (const c of COMPANIES) assert.ok(p.sellShares(c.key, 1, t).n === 1);
    assert.equal(p.data.stats.stocksheld, COMPANIES.length);
    assert.deepEqual(p.data.gear.stocks, {});
    // Big profits.
    p.data.gear.stocks = { rocket: { n: 10, paid: 1 } };
    const { profit } = p.sellShares('rocket', 10, t);
    assert.ok(profit >= 1000 && p.data.stickers['bull-run']);
    assert.ok(!p.data.stickers['stock-tycoon']);
    p.data.coins = 0;
    p.data.gear.stocks = { rocket: { n: 400, paid: 1 } };
    p.sellShares('rocket', 400, t);
    assert.ok(p.data.stickers['stock-tycoon']);
  });
});

test('a purse only holds so much: what will not fit stays as shares, never lost', async () => {
  await withProfile(async (p) => {
    const t = NOW;
    const sell = quote('rocket', t).sell;
    p.data.gear.stocks = { rocket: { n: 100, paid: 100 } };
    p.data.coins = COINS_MAX - sell * 3 - 1;
    const got = p.sellShares('rocket', 100, t);
    assert.equal(got.n, 3, 'only as many as fit');
    assert.equal(p.data.coins, COINS_MAX - 1);
    assert.equal(p.data.gear.stocks.rocket.n, 97);
    assert.deepEqual(p.sellShares('rocket', 5, t), { full: true }, 'and then none');
    assert.equal(p.data.gear.stocks.rocket.n, 97);
    // A test player's purse is always full, and it can sell all the same.
    p.setUnlimited(true);
    assert.equal(p.sellShares('rocket', 97, t).n, 97);
    assert.deepEqual(p.data.gear.stocks, {});
    assert.equal(p.data.coins, COINS_MAX);
  });
});

test('your shares pay dividends once a day, for the days you owned them, and not twice', async () => {
  await withProfile(async (p) => {
    const steady = COMPANIES.find((c) => c.kind === 'steady');
    const perDay = dividendOf(steady.key, 10);
    const t = NOW;
    assert.equal(p.collectDividends(t), null, 'no shares, no dividends');
    assert.equal(p.data.gear.divDay, 0);
    p.earn(5000);
    p.buyShares(steady.key, 10, t);
    const today = marketDay(t);
    assert.equal(p.data.gear.divDay, today, 'they start paying from tomorrow');
    assert.equal(p.collectDividends(t), null, 'not on the day you bought them');
    const coins = p.data.coins;
    const earned = p.data.stats.earned;
    const paid = p.collectDividends(t + DAY);
    assert.deepEqual(paid, { coins: perDay, days: 1 });
    assert.equal(p.data.coins, coins + perDay);
    assert.equal(p.data.stats.earned, earned + perDay, 'dividends are coins earned');
    assert.equal(p.data.stats.dividends, perDay);
    assert.ok(p.data.stickers['dividend-day']);
    assert.equal(p.collectDividends(t + DAY), null, 'not twice');
    // Days add up, but only so many wait for you.
    assert.deepEqual(p.collectDividends(t + 4 * DAY), { coins: 3 * perDay, days: 3 });
    assert.deepEqual(p.collectDividends(t + 100 * DAY), { coins: DIVIDEND_DAYS * perDay, days: DIVIDEND_DAYS });
    // A clock put back: nothing for it, and the days count on from there.
    assert.equal(p.collectDividends(t + 50 * DAY), null);
    assert.deepEqual(p.collectDividends(t + 51 * DAY), { coins: perDay, days: 1 });
    // Sell the lot, wait, and buy some more: nothing for the days between.
    p.sellShares(steady.key, 10, t + 51 * DAY);
    assert.equal(p.collectDividends(t + 60 * DAY), null);
    p.buyShares(steady.key, 10, t + 60 * DAY);
    assert.equal(p.data.gear.divDay, marketDay(t + 60 * DAY));
    assert.equal(p.collectDividends(t + 60 * DAY), null);
    // What your shares earned first, before buying more.
    const was = p.data.coins;
    p.buyShares(steady.key, 1, t + 61 * DAY);
    assert.equal(p.data.coins, was + perDay - quote(steady.key, t + 61 * DAY).buy, 'the ten that were there earned it');
  });
});

test('a wild company earns nothing, but the first day counts as paid so it can start', async () => {
  await withProfile(async (p) => {
    const wild = COMPANIES.find((c) => c.kind === 'wild');
    const t = NOW;
    p.earn(5000);
    p.buyShares(wild.key, 10, t);
    const coins = p.data.coins;
    assert.equal(p.collectDividends(t + 3 * DAY), null);
    assert.equal(p.data.coins, coins);
    assert.equal(p.data.gear.divDay, marketDay(t + 3 * DAY));
  });
});

// ---------------------------------------------------------------- stickers and XP

test('its stickers, with the counts behind them and XP for each', () => {
  const by = new Map(STICKERS.map((s, i) => [s.key, { ...s, i }]));
  const stats = (o) => ({ stockbuys: 0, stockwins: 0, stockgain: 0, stocksheld: 0, dividends: 0, ...o });
  for (const key of ['first-share', 'buy-low', 'dividend-day', 'every-basket', 'bull-run', 'stock-tycoon']) assert.ok(by.has(key), key);
  for (const key of ['stockbuys', 'stockwins', 'stockgain', 'stocksheld', 'dividends']) {
    assert.ok(STAT_KEYS.includes(key), key);
    assert.ok(XP_FOR[key]?.xp > 0 && XP_FOR[key].cap, `${key} earns XP, up to a point`);
  }
  assert.ok(by.get('first-share').test(stats({ stockbuys: 1 })) && !by.get('first-share').test(stats()));
  assert.ok(by.get('buy-low').test(stats({ stockwins: 1 })) && !by.get('buy-low').test(stats()));
  assert.ok(by.get('dividend-day').test(stats({ dividends: 1 })) && !by.get('dividend-day').test(stats()));
  // Every company, as many as there are.
  const every = by.get('every-basket');
  assert.ok(every.text.includes(String(COMPANIES.length)));
  assert.equal(every.goal, COMPANIES.length);
  assert.ok(every.test(stats({ stocksheld: COMPANIES.length })) && !every.test(stats({ stocksheld: COMPANIES.length - 1 })));
  // A step up, right after it.
  const run = by.get('bull-run');
  const tycoon = by.get('stock-tycoon');
  assert.equal(tycoon.i, run.i + 1);
  assert.ok(run.test(stats({ stockgain: run.goal })) && !run.test(stats({ stockgain: run.goal - 1 })));
  assert.ok(tycoon.test(stats({ stockgain: tycoon.goal })) && !tycoon.test(stats({ stockgain: tycoon.goal - 1 })));
  assert.ok(tycoon.goal > run.goal);
});

// ---------------------------------------------------------------- the furniture

test('its pieces in the Home tab after the robot kit, drawn as real models, their pictures inside their cells', () => {
  const home = B.blocksIn('home');
  const at = home.indexOf(B.ROBOT_KIT);
  assert.deepEqual(home.slice(at + 1, at + 1 + PIECES.length), PIECES, 'after the robot kit, together');
  for (const id of PIECES) {
    const d = B.block(id);
    assert.ok(STOCK_KINDS.has(d.real), `${d.key} is drawn for real`);
    assert.equal(d.turns, true, `${d.key} turns to face you`);
    assert.ok(modelBoxes(id).length > 1, `${d.key} has a picture`);
    for (const [x0, y0, z0, x1, y1, z1] of modelBoxes(id)) assert.ok(x0 >= 0 && z0 >= 0 && y0 >= 0 && x1 <= 1 && y1 <= 1 && z1 <= 1 && x1 > x0 && y1 > y0 && z1 > z0, `${d.key}'s picture is inside its cell`);
    assert.ok(d.category === 'home');
    assert.equal(furnitureDrop(id, B.TABLE), 0, 'none of them stands on a table');
  }
  assert.ok(B.SOLID[B.STOCK_TERMINAL] && B.SOLID[B.BULL_STATUE] && B.SOLID[B.BEAR_STATUE]);
  assert.ok(!B.SOLID[B.STOCK_TICKER], 'a ticker is flat on its wall');
  assert.ok(B.block(B.STOCK_TICKER).wall, 'and hangs on one');
  assert.ok(B.block(B.STOCK_TERMINAL).light > 0 && B.block(B.STOCK_TICKER).light > 0, 'they glow');
  for (let front = 0; front < 4; front++) {
    assert.ok(isTerminal(B.turnedTo(B.STOCK_TERMINAL, front)));
    assert.ok(isTicker(B.turnedTo(B.STOCK_TICKER, front)));
  }
  assert.ok(!isTerminal(B.STOCK_TICKER) && !isTicker(B.STOCK_TERMINAL) && !isTerminal(B.COMPUTER));
});

test('the terminal beside you is found, and none further away', () => {
  const w = new World({ W: 32, H: 32, D: 32, sea: 1 });
  const id = B.turnedTo(B.STOCK_TERMINAL, 1);
  w.set(10, 5, 10, id);
  const near = terminalNear(w, { x: 11.8, y: 5, z: 10.5 });
  assert.deepEqual([near.x, near.y, near.z], [10, 5, 10]);
  assert.equal(terminalNear(w, { x: 14.5, y: 5, z: 10.5 }), null, 'too far');
  assert.equal(terminalNear(new World({ W: 32, H: 32, D: 32, sea: 1 }), { x: 11.8, y: 5, z: 10.5 }), null, 'none here');
});

test('tickers side by side, whichever way they face, make one long strip read from the left', () => {
  // The direction the viewer's right goes in, looking at each front.
  const rights = [[0, -1], [1, 0], [0, 1], [-1, 0]];
  for (let front = 0; front < 4; front++) {
    const id = B.turnedTo(B.STOCK_TICKER, front);
    assert.equal(B.block(id).front, front);
    const [rx, rz] = rights[front];
    const here = tickerPlace(5, 7, 5, id);
    // Viewed from in front, the next one to your right is one block further on,
    // however far out on the island.
    assert.equal(tickerPlace(5 + rx, 7, 5 + rz, id), here + 1);
    assert.equal(tickerPlace(5 - rx, 7, 5 - rz, id), here - 1);
    assert.equal(tickerPlace(5 + 40 * rx, 7, 5 + 40 * rz, id), here + 40);
    // Rows one above the other do not say the same thing at the same moment.
    assert.notEqual((tickerPlace(5, 8, 5, id) - here) % TICKER_BLOCKS, 0);
  }
  // Each piece's strip runs on from the last: its u at its right edge is the next
  // one's at its left, and it reads rightwards as seen from in front (the model's
  // -x, a piece's right edge).
  const uv = (along) => {
    const g = tickerStrip(along);
    const p = g.attributes.position;
    const u = g.attributes.uv;
    const edge = { left: null, right: null };
    for (let i = 0; i < p.count; i++) edge[p.getX(i) > 0 ? 'left' : 'right'] = u.getX(i);
    return edge;
  };
  const a = uv(3.5);
  const b = uv(4.5);
  assert.ok(a.right > a.left, 'further along the strip to your right');
  assert.ok(Math.abs(a.right - b.left) < 1e-6, 'the next one takes up where it stops');
  assert.ok(Math.abs(a.right - a.left - 1 / TICKER_BLOCKS) < 1e-6, 'a block of the strip for a block of board');
  // It faces out from its wall, -z.
  const g = tickerStrip(0);
  const [i0, i1, i2] = g.index.array;
  const p = g.attributes.position;
  const [v0, v1, v2] = [i0, i1, i2].map((i) => new THREE.Vector3().fromBufferAttribute(p, i));
  assert.ok(v1.clone().sub(v0).cross(v2.clone().sub(v0)).z < 0, 'wound to be seen from in front');
  for (let i = 0; i < p.count; i++) assert.ok(Math.abs(p.getZ(i) - TICKER.front) < 1e-6 && p.getY(i) >= TICKER.y0 && p.getY(i) <= TICKER.y1);
});

test('its models: inside their cells (a little over at most), and the terminal looks up at you', () => {
  const materials = stockMaterials();
  for (const kind of STOCK_KINDS) {
    const id = PIECES.find((p) => B.block(p).real === kind);
    const model = stockModel(materials, kind, [3, 4, 5, id]);
    model.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(model);
    assert.ok(box.min.x >= -0.5 && box.max.x <= 0.5 && box.min.z >= -0.5 && box.max.z <= 0.5, `${kind} across: ${JSON.stringify(box)}`);
    assert.ok(box.min.y >= -0.001 && box.max.y <= 1.02, `${kind} up: ${JSON.stringify(box)}`);
    model.traverse((o) => {
      if (!o.isMesh) return;
      assert.ok(o.material, `${kind} has a material for every part`);
      const pos = o.geometry.attributes.position;
      for (let i = 0; i < pos.count; i += 37) assert.ok(Number.isFinite(pos.getX(i) + pos.getY(i) + pos.getZ(i)));
    });
  }
  // The terminal's screen faces you, and up a bit; and every terminal updates.
  const terminal = stockModel(materials, 'stock-terminal');
  const screen = terminal.children.find((m) => m.material === materials.screen);
  const g = screen.geometry;
  const [i0, i1, i2] = g.index.array;
  const [a, b, c] = [i0, i1, i2].map((i) => new THREE.Vector3().fromBufferAttribute(g.attributes.position, i));
  const n = b.clone().sub(a).cross(c.clone().sub(a)).normalize();
  assert.ok(n.z < -0.8, `it faces the front (${n.z})`);
  assert.ok(n.y > 0.2, `it looks up at you (${n.y})`);
  assert.ok(Math.abs(n.dot(new THREE.Vector3(0, Math.sin(SCREEN.tilt), -Math.cos(SCREEN.tilt))) - 1) < 1e-6);
  // Sits in front of what is behind it.
  const body = new THREE.Box3();
  for (const m of terminal.children) if (m.material === materials.navy) body.expandByObject(m);
  const middle = new THREE.Box3().setFromBufferAttribute(g.attributes.position).getCenter(new THREE.Vector3());
  assert.ok(middle.z < 0, 'towards the front of it');
  assert.doesNotThrow(() => terminal.userData.tick(1, 0.5));
  // A ticker gives back what is its own, and moves along.
  const ticker = stockModel(materials, 'stock-ticker', [3, 4, 5, B.STOCK_TICKER]);
  assert.ok(ticker.userData.together, 'all of them together, not each at a time of its own');
  assert.doesNotThrow(() => ticker.userData.tick(12.5, 0.5));
  assert.doesNotThrow(() => ticker.userData.dispose());
  assert.ok(stockModel(materials, 'bull-statue').children.length > 2);
  assert.ok(stockModel(materials, 'bear-statue').children.length > 2);
});

// ---------------------------------------------------------------- the stamp

test('the Stock Exchange stamp, whichever way it faces: a way in, eight terminals to walk up to, tickers on walls and daylight', () => {
  const stamp = stampByKey('stock-exchange');
  assert.ok(stamp && stamp.icon === '🏦');
  assert.equal(new Set(stamp.cells.map(([x, y, z]) => `${x},${y},${z}`)).size, stamp.cells.length, 'each cell once');
  assert.ok(stamp.cells.length <= MAX_EDIT_CELLS);
  const DIRS = [[1, 0], [0, 1], [-1, 0], [0, -1]];
  for (let facing = 0; facing < 4; facing++) {
    const w = new World({ W: 64, H: 40, D: 64, sea: 1 });
    const placed = placeTemplate(stamp.cells, 32, 20, 32, facing);
    for (const [x, y, z, id] of placed) w.set(x, y, z, id);
    const flat = placed.flat();
    assert.ok(validCells(w, flat), 'one edit');
    const find = (id) => placed.filter((c) => B.baseOf(c[3]) === id);
    const { f, r } = [
      { f: [0, 1], r: [-1, 0] },
      { f: [1, 0], r: [0, 1] },
      { f: [0, -1], r: [1, 0] },
      { f: [-1, 0], r: [0, -1] },
    ][facing];
    const at = (dx, dy, dz) => w.get(32 + dx * r[0] + dz * f[0], 20 + dy, 32 + dx * r[1] + dz * f[1]);
    // The way in, three wide, and clear from the square to the wall at the back.
    for (const dx of [-1, 0, 1]) for (const dy of [0, 1, 2]) for (let dz = -2; dz <= 12; dz++) assert.ok(!B.SOLID[at(dx, dy, dz)], `the way in at ${dx},${dy},${dz}`);
    // Eight terminals, all with room in front of them to walk up to.
    const terminals = find(B.STOCK_TERMINAL);
    assert.equal(terminals.length, 8);
    for (const [x, y, z, id] of terminals) {
      const [fx, fz] = DIRS[B.block(id).front];
      assert.ok(!B.SOLID[w.get(x + fx, y, z + fz)] && !B.SOLID[w.get(x + fx, y + 1, z + fz)], 'room in front');
      // Facing the way you came in.
      assert.deepEqual([fx, fz], [-f[0] || 0, -f[1] || 0], 'looking at you as you come in');
      assert.ok(terminalNear(w, { x: x + 0.5 + fx * 1.2, y, z: z + 0.5 + fz * 1.2 }), 'one to be found from there');
    }
    // Every ticker on a wall, in a row of them, facing out into the open.
    const tickers = find(B.STOCK_TICKER);
    assert.ok(tickers.length >= 40, `${tickers.length} tickers`);
    for (const [x, y, z, id] of tickers) {
      const [fx, fz] = DIRS[B.block(id).front];
      assert.ok(B.SOLID[w.get(x - fx, y, z - fz)], 'a wall behind it');
      assert.ok(!B.SOLID[w.get(x + fx, y, z + fz)], 'open in front');
    }
    assert.equal(find(B.BULL_STATUE).length, 1);
    assert.equal(find(B.BEAR_STATUE).length, 1);
    // A bull and a bear out the front, on the square, a step off the carpet.
    for (const [dx] of [[-4], [4]]) assert.notEqual(at(dx, 0, -2), 0);
    // Daylight comes in over the terminals, and lamps for after dark.
    const light = new LightMap(w);
    light.computeAll();
    const [tx, ty, tz] = terminals[0];
    const [fx, fz] = DIRS[B.block(terminals[0][3]).front];
    assert.ok(light.skyAt(tx + fx, ty, tz + fz) >= 6, `daylight in the hall (${light.skyAt(tx + fx, ty, tz + fz)})`);
    assert.ok(light.lampAt(tx + fx, ty, tz + fz) >= 5, `lamplight in the hall (${light.lampAt(tx + fx, ty, tz + fz)})`);
  }
});
