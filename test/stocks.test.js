// The stock market: real companies, their real prices in a snapshot, as coins and
// their own money; when the exchanges open; what you own, as kept, bought, sold,
// merged and split; its furniture and models, and the Stock Exchange stamp
// whichever way it faces. (server/market.js has test/market.test.js.)
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
  cleanSnapshot,
  cleanStocks,
  COMPANIES,
  companiesHeld,
  companiesIn,
  companyOf,
  DAY,
  HOUR,
  indexChange,
  isFresh,
  isTerminal,
  isTicker,
  MARKETS,
  marketOf,
  marketOpen,
  marketsHeld,
  marketTimes,
  moodOf,
  nextSession,
  oldSharesPaid,
  quote,
  selling,
  SHARES_MAX,
  splitting,
  STALE_MS,
  swingOf,
  terminalNear,
  toCoins,
  worth,
  zoneInstant,
} from '../public/js/shared/stocks.js';
import { MAX_EDIT_CELLS, validCells } from '../public/js/shared/tools.js';
import { World } from '../public/js/shared/world.js';
import { COINS, fakeSnapshot, FX, native } from './fixtures/market.js';

const THREE = await import('../public/vendor/three.module.js');
const { paintTerminal, paintTicker, SCREEN, SCREEN_ROWS, STOCK_KINDS, TICKER, TICKER_BLOCKS, TICKER_W, stockMaterials, stockModel, tickerPlace, tickerStrip } = await import('../public/js/render/stock-model.js');
const PIECES = [B.STOCK_TERMINAL, B.STOCK_TICKER, B.BULL_STATUE, B.BEAR_STATUE];

const NOW = Date.UTC(2026, 10, 5, 15);
const SNAP = fakeSnapshot(NOW);

// ---------------------------------------------------------------- the companies

test('real companies on three real exchanges, each with what the feed calls it', () => {
  assert.deepEqual(MARKETS.map((m) => m.key), ['seoul', 'tokyo', 'newyork']);
  for (const field of ['key', 'code', 'ticker', 'name', 'icon']) assert.equal(new Set(COMPANIES.map((c) => c[field])).size, COMPANIES.length, `each ${field} its own`);
  for (const c of COMPANIES) {
    assert.ok(marketOf(c.market), `${c.key} is on an exchange`);
    assert.ok(c.what.length > 10, `${c.key} says what it does`);
    assert.equal(companyOf(c.key), c);
    if (c.market === 'seoul') assert.match(c.code, /^\d{6}$/);
    if (c.market === 'tokyo') assert.match(c.code, /^\d{4}\.T$/);
    if (c.market === 'newyork') assert.match(c.code, /^[A-Z]+(\.[A-Z])?$/);
  }
  assert.equal(companyOf('nope'), null);
  assert.equal(marketOf('nope'), null);
  for (const m of MARKETS) assert.ok(companiesIn(m.key).length >= 4, `${m.name} has a good few`);
  assert.equal(MARKETS.flatMap((m) => companiesIn(m.key)).length, COMPANIES.length);
  // Enough of them that 8 can be owned at once.
  assert.ok(COMPANIES.length >= 8);
});

// ---------------------------------------------------------------- the snapshot

test('a snapshot as a page takes it: only companies there are, and only sensible numbers', () => {
  assert.deepEqual(cleanSnapshot(SNAP), SNAP);
  // It survives being sent.
  assert.deepEqual(cleanSnapshot(JSON.parse(JSON.stringify(SNAP))), SNAP);
  for (const bad of [null, 'hi', {}, { at: 'x' }, { at: NOW }, { at: NOW, fx: FX }, { at: NOW, fx: { KRW: 1300 }, stocks: {} }, { at: NOW, fx: FX, stocks: { apple: { p: -3 } } }, { at: NOW, fx: FX, stocks: { nope: { p: 3 } } }]) assert.equal(cleanSnapshot(bad), null, JSON.stringify(bad));
  const tidied = cleanSnapshot({
    at: NOW,
    fx: FX,
    stocks: {
      apple: { p: 100, prev: 'x', open: 'yes', month: [1, 'a', -2, 3], lo: 200, hi: 50, splits: [[NOW, 10], 'x', [NOW], [-1, 2]] },
      disney: { p: 'x' },
      nope: { p: 3 },
    },
    indexes: { seoul: { p: 5 }, tokyo: { p: 'x' }, nope: { p: 1 } },
  });
  assert.deepEqual(tidied, {
    at: NOW,
    fx: FX,
    indexes: { seoul: { p: 5, prev: 5 } },
    stocks: { apple: { p: 100, prev: 100, t: NOW, open: false, month: [1, 3], lo: 100, hi: 100, splits: [[NOW, 10]] } },
  });
});

test('a price in coins: a coin is a dollar, and won and yen go at the exchange rate', () => {
  assert.equal(quote(SNAP, 'apple').coins, COINS.apple);
  assert.equal(quote(SNAP, 'apple').native, COINS.apple);
  assert.equal(quote(SNAP, 'samsung').coins, COINS.samsung);
  assert.equal(quote(SNAP, 'samsung').native, COINS.samsung * FX.KRW);
  assert.equal(quote(SNAP, 'nintendo').coins, COINS.nintendo);
  assert.equal(quote(SNAP, 'nintendo').native, COINS.nintendo * FX.JPY);
  // In whole hundredths of a coin.
  const q = quote({ ...SNAP, stocks: { ...SNAP.stocks, samsung: { ...SNAP.stocks.samsung, p: 201500 } } }, 'samsung');
  assert.equal(q.cents, Math.round((201500 / FX.KRW) * 100));
  assert.equal(q.coins, q.cents / 100);
  // How far it has moved, whatever the rate did.
  assert.ok(Math.abs(quote(SNAP, 'apple').change - 0.01) < 1e-9);
  assert.ok(Math.abs(quote({ ...SNAP, fx: { KRW: 2000, JPY: 150 } }, 'samsung').change - 0.01) < 1e-9);
  assert.equal(quote(SNAP, 'apple').open, true);
  assert.equal(quote(SNAP, 'nope'), null);
  assert.equal(quote(null, 'apple'), null);
  assert.equal(quote({ ...SNAP, stocks: {} }, 'apple'), null);
  // Never nothing, however cheap.
  assert.equal(quote(fakeSnapshot(NOW, { stocks: { apple: { p: 0.001 } } }), 'apple').cents, 1);
  assert.equal(toCoins(SNAP, 'samsung', 2600), 2);
  assert.equal(toCoins(SNAP, 'apple', 2600), 2600);
  assert.equal(toCoins(SNAP, 'nope', 2600), 0);
});

test('prices are traded at only while they are recent', () => {
  assert.ok(isFresh(SNAP, NOW));
  assert.ok(isFresh(SNAP, NOW + STALE_MS - 1));
  assert.ok(!isFresh(SNAP, NOW + STALE_MS));
  assert.ok(!isFresh(null, NOW));
  assert.equal(buying({}, 'apple', 1, 10000, SNAP, NOW + STALE_MS), null);
  assert.equal(selling({ apple: { n: 1, paid: 1, at: 0 } }, 'apple', 1, SNAP, NOW + STALE_MS), null);
  assert.ok(buying({}, 'apple', 1, 10000, SNAP, NOW + STALE_MS - 1));
});

test('whether an exchange is open, how its market is doing and the mood of them all', () => {
  assert.ok(marketOpen(SNAP, 'seoul'));
  assert.ok(!marketOpen(fakeSnapshot(NOW, { open: false }), 'seoul'));
  assert.ok(!marketOpen(null, 'seoul'));
  assert.ok(Math.abs(indexChange(SNAP, 'newyork') - (7500 / 7425 - 1)) < 1e-9);
  assert.equal(indexChange({ ...SNAP, indexes: {} }, 'newyork'), null);
  assert.equal(moodOf(SNAP).key, 'bull');
  const down = { ...SNAP, indexes: { seoul: { p: 90, prev: 100 } } };
  assert.equal(moodOf(down).key, 'bear');
  assert.equal(moodOf({ ...SNAP, indexes: { seoul: { p: 100.1, prev: 100 }, tokyo: { p: 99.9, prev: 100 } } }).key, 'calm');
  assert.equal(moodOf({ ...SNAP, indexes: {} }), null);
  assert.equal(moodOf(null), null);
});

test('how much a company has been moving lately, from its month of closes', () => {
  const closes = (each) => Array.from({ length: 23 }, (_, i) => 100 * (1 + (i % 2) * each));
  const with_ = (month) => fakeSnapshot(NOW, { stocks: { apple: { month } } });
  assert.equal(swingOf(with_(closes(0.005)), 'apple').icon, '🐢');
  assert.equal(swingOf(with_(closes(0.018)), 'apple').icon, '🐇');
  assert.equal(swingOf(with_(closes(0.05)), 'apple').icon, '🚀');
  assert.equal(swingOf(with_([1, 2, 3]), 'apple'), null, 'too few to tell');
  assert.equal(swingOf(null, 'apple'), null);
});

test('a page asks the keeper, then its own server, takes what comes and says when nothing does', async () => {
  const { Market } = await import('../public/js/market.js');
  const m = new Market();
  const changes = [];
  m.addEventListener('change', () => changes.push(m.status));
  const ask = { keeper: null, server: null };
  const real = globalThis.fetch;
  globalThis.fetch = async (url) => {
    ask.url = url;
    if (!ask.server) return { ok: false, status: 404 };
    return { ok: true, json: async () => ask.server };
  };
  try {
    m.useKeeper({
      config: { id: 'keeper' },
      addEventListener() {},
      request: async (msg) => {
        ask.msg = msg;
        if (!ask.keeper) throw new Error('away');
        return { market: ask.keeper };
      },
    });
    // Nothing anywhere: none, and it says so.
    m.snapshot = null;
    await m.want(0);
    assert.equal(m.status, 'away');
    assert.equal(m.snapshot, null);
    assert.equal(ask.url, 'market.json');
    // From the keeper.
    ask.keeper = fakeSnapshot(NOW);
    await m.want(0);
    assert.equal(ask.msg.t, 'market');
    assert.equal(m.status, 'ok');
    assert.equal(m.snapshot.at, NOW);
    // Not asked again so soon.
    ask.msg = null;
    await m.want(60000);
    assert.equal(ask.msg, null);
    // The same prices with a company's year come in since: taken.
    ask.keeper = fakeSnapshot(NOW, { stocks: { apple: { lo: 1 } } });
    await m.want(0);
    assert.equal(m.snapshot.stocks.apple.lo, 1);
    // The keeper gone: from its own server. Both gone: the last ones stay.
    ask.keeper = null;
    ask.server = fakeSnapshot(NOW + 5);
    await m.want(0);
    assert.equal(m.snapshot.at, NOW + 5);
    ask.server = null;
    await m.want(0);
    assert.equal(m.status, 'away');
    assert.equal(m.snapshot.at, NOW + 5);
    // Nonsense is no answer.
    ask.server = { at: 5 };
    await m.want(0);
    assert.equal(m.status, 'away');
    assert.equal(m.snapshot.at, NOW + 5);
    assert.equal(changes.length, 6, 'each asking told');
    // Charts the same way, and none when none can be had.
    ask.server = null;
    assert.equal(await m.chart('apple', 'today'), null);
    m.keeper.request = async () => ({ chart: { key: 'apple', span: 'today', points: [] } });
    ask.keeper = true;
    assert.deepEqual(await m.chart('apple', 'today'), { key: 'apple', span: 'today', points: [] });
  } finally {
    globalThis.fetch = real;
  }
});

// ---------------------------------------------------------------- when they open

test('a moment in a zone, right either side of the clocks changing', () => {
  assert.equal(zoneInstant('Asia/Seoul', 2026, 11, 6, 9, 0), Date.UTC(2026, 10, 6, 0, 0));
  assert.equal(zoneInstant('Asia/Tokyo', 2026, 11, 6, 15, 30), Date.UTC(2026, 10, 6, 6, 30));
  assert.equal(zoneInstant('America/New_York', 2026, 11, 6, 9, 30), Date.UTC(2026, 10, 6, 14, 30), 'winter time');
  assert.equal(zoneInstant('America/New_York', 2026, 7, 6, 9, 30), Date.UTC(2026, 6, 6, 13, 30), 'summer time');
});

test('the next session of an exchange, on weekdays, by its own clock', () => {
  // A Thursday, 15:00 UTC: midnight in Seoul (Friday's session to come), and New
  // York mid-morning (this one going on).
  const thu = Date.UTC(2026, 10, 5, 15);
  assert.deepEqual(nextSession('seoul', thu), { opens: Date.UTC(2026, 10, 6, 0), closes: Date.UTC(2026, 10, 6, 6, 30) });
  assert.deepEqual(nextSession('newyork', thu), { opens: Date.UTC(2026, 10, 5, 14, 30), closes: Date.UTC(2026, 10, 5, 21) });
  // After Friday's close it is Monday's.
  const fridayNight = Date.UTC(2026, 10, 6, 22);
  assert.equal(nextSession('newyork', fridayNight).opens, Date.UTC(2026, 10, 9, 14, 30));
  assert.equal(nextSession('seoul', fridayNight).opens, Date.UTC(2026, 10, 9, 0));
  assert.equal(nextSession('tokyo', Date.UTC(2026, 10, 7, 12)).opens, Date.UTC(2026, 10, 9, 0), 'from a Saturday');
});

test('when an exchange next changes: as the feed says it is, and past a holiday', () => {
  const thu = Date.UTC(2026, 10, 5, 15);
  const open = fakeSnapshot(thu, { open: true });
  const shut = fakeSnapshot(thu, { open: false });
  assert.deepEqual(marketTimes(open, 'newyork', thu), { open: true, closes: Date.UTC(2026, 10, 5, 21) });
  assert.deepEqual(marketTimes(shut, 'seoul', thu), { open: false, opens: Date.UTC(2026, 10, 6, 0) });
  // The clock says New York should be open and the feed says not: a holiday, so
  // it opens at the next session.
  assert.deepEqual(marketTimes(shut, 'newyork', thu), { open: false, opens: Date.UTC(2026, 10, 6, 14, 30) });
  // The feed says open outside its hours: no closing time to give.
  assert.deepEqual(marketTimes(open, 'seoul', thu), { open: true, closes: null });
});

// ---------------------------------------------------------------- what you own

test('shares as kept: only companies there are, whole numbers, nothing silly', () => {
  assert.deepEqual(cleanStocks(null), {});
  assert.deepEqual(cleanStocks('hi'), {});
  assert.deepEqual(cleanStocks({ nope: { n: 3, paid: 10 }, apple: { n: 0, paid: 5 }, disney: { n: -2, paid: 5 }, sony: { n: 1.5, paid: 5 }, nike: { n: '3', paid: 5 }, kakao: 7 }), {});
  assert.deepEqual(cleanStocks({ apple: { n: 3, paid: 180, at: 5 } }), { apple: { n: 3, paid: 180, at: 5 } });
  assert.deepEqual(cleanStocks({ apple: { n: 3, paid: -1, at: 'x' } }), { apple: { n: 3, paid: 0, at: 0 } });
  assert.equal(cleanStocks({ apple: { n: 10 ** 9, paid: 1 } }).apple.n, SHARES_MAX);
  assert.ok(cleanStocks({ apple: { n: 1, paid: 10 ** 12 } }).apple.paid <= 100000, 'no silly sums');
  // With your gear, wherever that goes.
  assert.deepEqual(cleanGear({ stocks: { apple: { n: 3, paid: 180, at: 5 }, nope: { n: 1, paid: 1 } } }).stocks, { apple: { n: 3, paid: 180, at: 5 } });
  assert.deepEqual(cleanGear({}).stocks, {});
  assert.equal(companiesHeld({ apple: {}, sony: {}, nike: {} }), 3);
  assert.equal(companiesHeld(undefined), 0);
  assert.equal(marketsHeld({ apple: {}, nike: {} }), 1);
  assert.equal(marketsHeld({ apple: {}, sony: {}, kakao: {} }), 3);
  assert.equal(marketsHeld(undefined), 0);
});

test('buying and selling: the sums in whole coins, an average price, and refusing what cannot be done', () => {
  const t = NOW;
  // At 15.46 a share: three cost 46.38, rounded up.
  const got = buying({}, 'mattel', 3, 10000, SNAP, t);
  assert.deepEqual(got, { stocks: { mattel: { n: 3, paid: 47, at: t } }, n: 3, cost: 47 });
  // More bought later: what they all cost adds up.
  const more = buying(got.stocks, 'mattel', 1, 10000, SNAP, t + 5);
  assert.deepEqual(more.stocks.mattel, { n: 4, paid: 47 + 16, at: t + 5 });
  // Not with these coins, nor a silly number, nor a company that is not there.
  assert.equal(buying({}, 'mattel', 3, 46, SNAP, t), null);
  assert.ok(buying({}, 'mattel', 3, 47, SNAP, t), 'just enough');
  for (const n of [0, -1, 1.5, '2', null]) assert.equal(buying({}, 'mattel', n, 10000, SNAP, t), null, `not ${n}`);
  assert.equal(buying({}, 'nope', 1, 10000, SNAP, t), null);
  // Only so many of one company.
  assert.equal(canBuy({ mattel: { n: SHARES_MAX - 2, paid: 1, at: 0 } }, 'mattel', 99999, SNAP), 2);
  assert.equal(buying({ mattel: { n: SHARES_MAX, paid: 1, at: 0 } }, 'mattel', 1, 99999, SNAP, t), null);
  assert.equal(canBuy({}, 'mattel', 47, SNAP), 3);
  assert.equal(canBuy({}, 'mattel', 46, SNAP), 2, 'and what it says it can buy, it can');
  assert.ok(buying({}, 'mattel', 2, 46, SNAP, t));
  assert.equal(canBuy({}, 'mattel', 0, SNAP), 0);
  assert.equal(canBuy({}, 'nope', 99999, SNAP), 0);

  // Selling some takes the average of what they cost; selling the rest, all the
  // rest of it, whatever the rounding. Three at 15.46 bring 46.38, rounded down.
  const held = { mattel: { n: 3, paid: 100, at: 9 } };
  const sell1 = selling(held, 'mattel', 1, SNAP, t);
  assert.equal(sell1.coins, 15);
  assert.equal(sell1.profit, 15 - 33);
  assert.deepEqual(sell1.stocks, { mattel: { n: 2, paid: 67, at: 9 } });
  const sell2 = selling(sell1.stocks, 'mattel', 2, SNAP, t);
  assert.equal(sell2.coins, 30);
  assert.equal(sell2.profit, 30 - 67);
  assert.deepEqual(sell2.stocks, {}, 'none left, none kept');
  assert.equal(selling(held, 'mattel', 3, SNAP, t).coins, 46);
  assert.equal(selling(held, 'mattel', 4, SNAP, t), null);
  assert.equal(selling(held, 'sony', 1, SNAP, t), null);
  assert.equal(selling(held, 'mattel', 0, SNAP, t), null);
  assert.equal(selling(held, 'mattel', 1.5, SNAP, t), null);
  assert.deepEqual(held, { mattel: { n: 3, paid: 100, at: 9 } }, 'none of it changes what it was given');
});

test('going round in a circle at one price never makes a coin, and a real move does', () => {
  for (const c of COMPANIES) {
    for (const n of [1, 2, 3, 7, 10, 99, 1000]) {
      const b = buying({}, c.key, n, 10 ** 8, SNAP, NOW);
      const s = selling(b.stocks, c.key, n, SNAP, NOW);
      assert.ok(s.coins <= b.cost, `${c.key} x${n}`);
      assert.ok(b.cost - s.coins <= 1, `only the rounding: ${c.key} x${n}`);
      assert.equal(s.profit, s.coins - b.cost);
    }
  }
  const b = buying({}, 'apple', 10, 10000, SNAP, NOW);
  const later = fakeSnapshot(NOW + DAY, { stocks: { apple: { p: COINS.apple * 1.05 } } });
  assert.ok(selling(b.stocks, 'apple', 10, later, NOW + DAY).profit > 170, '5% up on ten shares');
});

test('what all your shares would fetch and what they cost', () => {
  const stocks = { mattel: { n: 2, paid: 30, at: 0 }, sony: { n: 10, paid: 250, at: 0 } };
  const value = Math.floor(COINS.mattel * 2) + Math.floor(COINS.sony * 10);
  assert.deepEqual(worth(stocks, SNAP), { value, paid: 280, gain: value - 280 });
  assert.deepEqual(worth({}, SNAP), { value: 0, paid: 0, gain: 0 });
  assert.deepEqual(worth(undefined, SNAP), { value: 0, paid: 0, gain: 0 });
  assert.deepEqual(worth(stocks, null), { value: 280, paid: 280, gain: 0 }, 'with no prices, what they cost');
});

test('a company splitting its shares: more of them for what they cost, once, only if you had them first', () => {
  const splitAt = NOW - DAY;
  const snap = fakeSnapshot(NOW, { stocks: { netflix: { splits: [[splitAt, 10]] } } });
  // Owned from before: ten for one.
  const before = { netflix: { n: 3, paid: 900, at: splitAt - 1 }, apple: { n: 1, paid: 300, at: 5 } };
  const { stocks, done } = splitting(before, snap);
  assert.deepEqual(done, [{ key: 'netflix', from: 3, to: 30 }]);
  assert.deepEqual(stocks.netflix, { n: 30, paid: 900, at: splitAt }, 'what they cost stays');
  assert.deepEqual(stocks.apple, before.apple, 'the others stay');
  assert.deepEqual(before.netflix, { n: 3, paid: 900, at: splitAt - 1 }, 'what it was given stays');
  // Only the once.
  const again = splitting(stocks, snap);
  assert.deepEqual(again.done, []);
  assert.equal(again.stocks, stocks);
  // Bought after it: already at the new price.
  assert.deepEqual(splitting({ netflix: { n: 3, paid: 200, at: splitAt + 1 } }, snap).done, []);
  // Two since you last looked, and one that goes the other way: never to nothing.
  const two = fakeSnapshot(NOW, { stocks: { apple: { splits: [[NOW - 5, 2], [NOW - 9, 2]] }, sony: { splits: [[NOW - 5, 0.1]] } } });
  const both = splitting({ apple: { n: 3, paid: 9, at: 1 }, sony: { n: 3, paid: 9, at: 1 } }, two);
  assert.deepEqual(both.stocks.apple, { n: 12, paid: 9, at: NOW - 5 });
  assert.equal(both.stocks.sony.n, 1, 'a holding never splits away to nothing');
  assert.equal(splitting({ apple: { n: 9000, paid: 9, at: 1 } }, two).stocks.apple.n, SHARES_MAX);
  assert.deepEqual(splitting(undefined, snap).done, []);
  assert.deepEqual(splitting(before, null).done, []);
});

test('the keeper keeps your shares, a newer device wins, and a guest brings theirs along', () => {
  const profile = { name: 'Sunny Otter', changedAt: 5, gear: { stocks: { apple: { n: 3, paid: 180, at: 7 }, nope: { n: 1, paid: 1 } } } };
  const kept = keptProfile(profile);
  assert.deepEqual(kept.gear.stocks, { apple: { n: 3, paid: 180, at: 7 } });
  // Sent to the keeper and back, the same.
  assert.deepEqual(keptProfile(JSON.parse(JSON.stringify(kept))).gear.stocks, kept.gear.stocks);
  const newer = { name: 'Sunny Otter', changedAt: 9, gear: { stocks: { sony: { n: 1, paid: 40, at: 8 } } } };
  assert.deepEqual(mergeProfiles(profile, newer).gear.stocks, { sony: { n: 1, paid: 40, at: 8 } }, 'sold on one device stays sold');
  assert.deepEqual(mergeProfiles(newer, profile).gear.stocks, { sony: { n: 1, paid: 40, at: 8 } }, 'whichever asks');
  // What you did as a guest joins your login.
  const added = addProgress({ gear: { stocks: { apple: { n: 3, paid: 180, at: 7 } } } }, { gear: { stocks: { apple: { n: 2, paid: 100, at: 9 }, sony: { n: 1, paid: 40, at: 3 } } } });
  assert.deepEqual(added.gear.stocks, { apple: { n: 5, paid: 280, at: 9 }, sony: { n: 1, paid: 40, at: 3 } });
  assert.deepEqual(addStocks(undefined, { apple: { n: 1, paid: 2, at: 1 } }), { apple: { n: 1, paid: 2, at: 1 } });
  assert.equal(addStocks({ apple: { n: SHARES_MAX, paid: 2 } }, { apple: { n: 5, paid: 2 } }).apple.n, SHARES_MAX);
});

// ---------------------------------------------------------------- your profile

let profiles = 0;

async function withProfile(run, start = null) {
  const store = new Map();
  globalThis.localStorage = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k), clear: () => store.clear(), key: (i) => [...store.keys()][i], get length() { return store.size; } };
  try {
    const { Profile } = await import('../public/js/profile.js');
    // Under a key of its own: what is kept in memory outlives the store above.
    const key = `stocks-test-${profiles++}`;
    if (start) {
      const { save } = await import('../public/js/storage.js');
      save(key, start);
    }
    await run(new Profile(key), Profile, key);
  } finally {
    delete globalThis.localStorage;
  }
}

test('your profile buys and sells: the coins and shares change, are kept, and earn stickers and XP', async () => {
  await withProfile(async (p, Profile, key) => {
    const t = NOW;
    assert.equal(p.buyShares('mattel', 1, SNAP, t), null, 'no coins, no shares');
    assert.deepEqual(p.data.gear.stocks, {});
    p.earn(80);
    const earned = p.data.stats.earned;
    const before = p.progress.xp;
    assert.deepEqual(p.buyShares('mattel', 5, SNAP, t), { n: 5, cost: 78 });
    assert.equal(p.data.coins, 2);
    assert.deepEqual(p.data.gear.stocks, { mattel: { n: 5, paid: 78, at: t } });
    assert.ok(p.data.stickers['first-share'], 'the sticker');
    assert.equal(p.data.stats.stockbuys, 1);
    assert.equal(p.data.stats.stocksheld, 1);
    assert.equal(p.data.stats.stockworld, 1);
    assert.ok(p.progress.xp > before, 'XP for it');
    assert.equal(p.data.stats.earned, earned, 'spending earns nothing');
    assert.deepEqual(new Profile(key).data.gear.stocks, p.data.gear.stocks, 'kept on this device');
    // Sold at the same price: your coins back, near enough, and nothing earned.
    const sold = p.sellShares('mattel', 2, SNAP, t);
    assert.deepEqual(sold, { n: 2, coins: 30, profit: 30 - 31 });
    assert.equal(p.data.coins, 32);
    assert.equal(p.data.stats.earned, earned, 'your own coins coming back are not earned');
    assert.equal(p.data.stats.stockwins, 0);
    assert.equal(p.data.gear.stocks.mattel.n, 3);
    assert.equal(p.sellShares('mattel', 4, SNAP, t), null, 'not more than you have');
    assert.equal(p.sellShares('sony', 1, SNAP, t), null, 'not what you do not have');
    assert.equal(p.buyShares('mattel', 1, null, t), null, 'not with no prices');
    assert.equal(p.sellShares('mattel', 1, null, t), null);
    assert.equal(p.sellShares('mattel', 1, SNAP, t + STALE_MS), null, 'not with old ones');
    // Sold for more: only the profit counts as earned, towards the Millionaire
    // sticker too, so going round and round earns nothing.
    const up = fakeSnapshot(t + DAY, { stocks: { mattel: { p: 30 } } });
    const won = p.sellShares('mattel', 3, up, t + DAY);
    assert.equal(won.coins, 90);
    assert.equal(won.profit, 90 - 47);
    assert.equal(p.data.stats.earned, earned + won.profit);
    assert.equal(p.data.stats.stockwins, 1);
    assert.equal(p.data.stats.stockgain, won.profit);
    assert.ok(p.data.stickers['buy-low']);
    assert.deepEqual(p.data.gear.stocks, {});
  });
});

test('owning eight companies, owning on all three exchanges and big profits earn their stickers', async () => {
  await withProfile(async (p) => {
    p.earn(COINS_MAX);
    const t = NOW;
    // Eight of them, on no more than two exchanges.
    const eight = COMPANIES.filter((c) => c.market !== 'newyork').slice(0, 8);
    assert.equal(eight.length, 8);
    eight.forEach((c, i) => {
      assert.ok(!p.data.stickers['every-basket'], `not with ${i}`);
      assert.ok(p.buyShares(c.key, 1, SNAP, t));
    });
    assert.ok(p.data.stickers['every-basket']);
    assert.equal(p.data.stats.stocksheld, 8);
    assert.ok(!p.data.stickers['around-the-world'], 'not with New York missing');
    assert.equal(p.data.stats.stockworld, marketsHeld(p.data.gear.stocks));
    for (const key of ['samsung', 'nintendo', 'apple']) assert.ok(p.buyShares(key, 1, SNAP, t));
    assert.ok(p.data.stickers['around-the-world']);
    const held = Object.keys(p.data.gear.stocks).length;
    // Selling them does not take them back, nor the counts.
    p.data.coins = 0;
    for (const [key, { n }] of Object.entries(p.data.gear.stocks)) assert.equal(p.sellShares(key, n, SNAP, t).n, n);
    assert.equal(p.data.stats.stocksheld, held);
    assert.equal(p.data.stats.stockworld, 3);
    assert.deepEqual(p.data.gear.stocks, {});
    // Big profits.
    p.data.gear.stocks = { apple: { n: 10, paid: 1, at: t } };
    const { profit } = p.sellShares('apple', 10, SNAP, t);
    assert.ok(profit >= 1000 && p.data.stickers['bull-run']);
    assert.ok(!p.data.stickers['stock-tycoon']);
    p.data.coins = 0;
    p.data.gear.stocks = { apple: { n: 100, paid: 1, at: t } };
    p.sellShares('apple', 100, SNAP, t);
    assert.ok(p.data.stickers['stock-tycoon']);
  });
});

test('a purse only holds so much: what will not fit stays as shares, never lost', async () => {
  await withProfile(async (p) => {
    const t = NOW;
    p.data.gear.stocks = { apple: { n: 100, paid: 100, at: t } };
    p.data.coins = COINS_MAX - 1100;
    const got = p.sellShares('apple', 100, SNAP, t);
    assert.equal(got.n, 3, 'only as many as fit');
    assert.equal(p.data.coins, COINS_MAX - 1100 + Math.floor(COINS.apple * 3));
    assert.equal(p.data.gear.stocks.apple.n, 97);
    assert.deepEqual(p.sellShares('apple', 5, SNAP, t), { full: true }, 'and then none');
    assert.equal(p.data.gear.stocks.apple.n, 97);
    // A test player's purse is always full, and it can sell all the same.
    p.setUnlimited(true);
    assert.equal(p.sellShares('apple', 97, SNAP, t).n, 97);
    assert.deepEqual(p.data.gear.stocks, {});
    assert.equal(p.data.coins, COINS_MAX);
  });
});

test('a split is made before a trade, so a sale counts the shares you really have', async () => {
  await withProfile(async (p) => {
    const t = NOW;
    const split = fakeSnapshot(t + DAY, { stocks: { netflix: { p: 6.6, splits: [[t + 5, 10]] } } });
    p.data.gear.stocks = { netflix: { n: 2, paid: 132, at: t } };
    assert.deepEqual(p.settleShares(split), [{ key: 'netflix', from: 2, to: 20 }]);
    assert.equal(p.data.gear.stocks.netflix.n, 20);
    assert.deepEqual(p.settleShares(split), [], 'only once');
    // Worth the same in all.
    assert.equal(worth(p.data.gear.stocks, split).value, 132);
    p.data.gear.stocks = { netflix: { n: 2, paid: 132, at: t } };
    assert.equal(p.sellShares('netflix', 20, split, t + DAY).coins, 132, 'all twenty of them');
    p.earn(100);
    p.data.gear.stocks = { netflix: { n: 2, paid: 132, at: t } };
    assert.ok(p.buyShares('netflix', 1, split, t + DAY));
    assert.equal(p.data.gear.stocks.netflix.n, 21);
  });
});

test('shares of the market\'s first, make-believe companies come back as what they cost', async () => {
  assert.equal(oldSharesPaid({ carrot: { n: 3, paid: 45 }, rocket: { n: 1, paid: 300 }, apple: { n: 9, paid: 1000 } }), 345);
  assert.equal(oldSharesPaid(null), 0);
  assert.equal(oldSharesPaid({ carrot: { n: 3, paid: 'x' } }), 0);
  const before = Date.now();
  await withProfile(
    async (p, Profile, key) => {
      assert.equal(p.data.coins, 10 + 345);
      assert.deepEqual(p.data.gear.stocks, {});
      assert.ok(p.data.changedAt >= before, 'newer than any copy still holding them');
      // Only the once.
      assert.equal(new Profile(key).data.coins, 10 + 345);
    },
    { name: 'Sunny Otter', coins: 10, changedAt: 5, gear: { stocks: { carrot: { n: 3, paid: 45 }, rocket: { n: 1, paid: 300 } }, divDay: 20000 } },
  );
});

// ---------------------------------------------------------------- stickers and XP

test('its stickers, with the counts behind them and XP for each', () => {
  const by = new Map(STICKERS.map((s, i) => [s.key, { ...s, i }]));
  const stats = (o) => ({ stockbuys: 0, stockwins: 0, stockgain: 0, stocksheld: 0, stockworld: 0, ...o });
  for (const key of ['first-share', 'buy-low', 'every-basket', 'around-the-world', 'bull-run', 'stock-tycoon']) assert.ok(by.has(key), key);
  for (const key of ['stockbuys', 'stockwins', 'stockgain', 'stocksheld', 'stockworld']) {
    assert.ok(STAT_KEYS.includes(key), key);
    assert.ok(XP_FOR[key]?.xp > 0 && XP_FOR[key].cap, `${key} earns XP, up to a point`);
  }
  assert.ok(by.get('first-share').test(stats({ stockbuys: 1 })) && !by.get('first-share').test(stats()));
  assert.ok(by.get('buy-low').test(stats({ stockwins: 1 })) && !by.get('buy-low').test(stats()));
  const every = by.get('every-basket');
  assert.equal(every.goal, 8);
  assert.ok(every.goal <= COMPANIES.length);
  assert.ok(every.test(stats({ stocksheld: 8 })) && !every.test(stats({ stocksheld: 7 })));
  const world = by.get('around-the-world');
  assert.equal(MARKETS.length, 3);
  assert.ok(world.test(stats({ stockworld: 3 })) && !world.test(stats({ stockworld: 2 })));
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

test('its screens paint the prices, with or without any, and the terminal goes through them all', () => {
  const said = [];
  const ctx = new Proxy(
    { fillText: (text) => said.push(String(text)), measureText: (text) => ({ width: String(text).length * 20 }) },
    { get: (o, k) => o[k] ?? (() => {}), set: () => true },
  );
  paintTicker(ctx, SNAP);
  for (const c of COMPANIES) assert.ok(said.includes(c.ticker), `${c.ticker} on the ticker`);
  assert.ok(said.includes('15.46'), 'its price in coins');
  assert.ok(said.includes('352.0'), 'a dear one with less after the point');
  assert.ok(said.some((t) => t === '▲1.0%'));
  // Every company's words end before the next one's start, and the last ones end
  // inside the strip, so it loops round without running into itself, however long
  // the prices: the words get smaller if they must.
  const placed = [];
  const room = { font: '' };
  const widthOf = (text, font) => [...String(text)].length * parseFloat(font.match(/([\d.]+)px/)[1]);
  const measuring = new Proxy(
    { fillText: (text, x) => placed.push({ x, end: x + widthOf(text, room.font) }), measureText: (text) => ({ width: widthOf(text, room.font) }) },
    {
      get: (o, k) => (k === 'font' ? room.font : (o[k] ?? (() => {}))),
      set: (o, k, v) => {
        if (k === 'font') room.font = v;
        return true;
      },
    },
  );
  for (const p of [10, 1234567]) {
    placed.length = 0;
    paintTicker(measuring, fakeSnapshot(NOW, { stocks: Object.fromEntries(COMPANIES.map((c) => [c.key, { p }])) }));
    assert.equal(placed.length, COMPANIES.length * 4);
    for (let i = 1; i < placed.length; i++) assert.ok(placed[i].x >= placed[i - 1].end, `word ${i} starts after the one before ends, with prices of ${p}`);
    assert.ok(placed[0].x > 0, 'a gap at the start');
    assert.ok(placed.at(-1).end <= TICKER_W, 'and the last ends inside the strip');
    // An even gap, there and at the join.
    const gaps = COMPANIES.slice(1).map((_, i) => placed[(i + 1) * 4].x - placed[(i + 1) * 4 - 1].end);
    assert.ok(Math.max(...gaps) - Math.min(...gaps) < 1e-6, 'even gaps');
    assert.ok(Math.abs(TICKER_W - placed.at(-1).end + placed[0].x - gaps[0]) < 1e-6, 'the same across the join');
    assert.ok(gaps[0] >= 30, `a real gap (${gaps[0]})`);
  }
  said.length = 0;
  paintTicker(ctx, null);
  assert.ok(said.includes('AAPL') && said.includes('...'), 'waiting for prices');
  said.length = 0;
  const pages = Math.ceil(COMPANIES.length / SCREEN_ROWS);
  for (let page = 0; page < pages; page++) paintTerminal(ctx, SNAP, page);
  for (const c of COMPANIES) assert.ok(said.includes(c.ticker), `${c.ticker} on the screen`);
  assert.ok(said.includes('🐂'), 'and the mood');
  said.length = 0;
  paintTerminal(ctx, SNAP, pages);
  assert.ok(said.includes(COMPANIES[0].ticker), 'round to the start again');
  assert.doesNotThrow(() => paintTerminal(ctx, null, 123));
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
