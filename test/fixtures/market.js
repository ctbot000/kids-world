// Stock market prices for the tests, in the shape server/market.js makes them.
import { COMPANIES, DAY, marketOf } from '../../public/js/shared/stocks.js';

export const FX = { KRW: 1300, JPY: 150 };

// What each company costs in coins.
export const COINS = {
  samsung: 150,
  skhynix: 410.5,
  naver: 137.2,
  kakao: 24.2,
  hyundai: 218.9,
  hybe: 110.7,
  orion: 90.5,
  binggrae: 62.75,
  nintendo: 56,
  sony: 26.61,
  sanrio: 8.21,
  bandai: 42.7,
  apple: 352.03,
  alphabet: 287.24,
  microsoft: 545,
  disney: 119.8,
  netflix: 66,
  nike: 40.19,
  cocacola: 96.69,
  mcdonalds: 280.89,
  mattel: 15.46,
  roblox: 47.4,
};

// A company's price in its own money, for that many coins.
export const native = (key, coins = COINS[key]) => {
  const { currency } = marketOf(COMPANIES.find((c) => c.key === key).market);
  return currency === 'USD' ? coins : coins * FX[currency];
};

// A snapshot at time `at`: every company 1% up on the day and its exchange open,
// or as given: open, a word on any company ({ apple: { p: 300 } }).
export function fakeSnapshot(at = Date.now(), { open = true, stocks = {} } = {}) {
  const out = {};
  for (const c of COMPANIES) {
    const p = native(c.key);
    const month = Array.from({ length: 23 }, (_, i) => p * (0.9 + (i % 5) * 0.03));
    out[c.key] = { p, prev: p / 1.01, t: at, open, month: [...month.slice(0, -1), p], lo: p * 0.7, hi: p * 1.3, splits: [], ...stocks[c.key] };
  }
  return { at, fx: { ...FX }, indexes: { seoul: { p: 5000, prev: 4950 }, tokyo: { p: 60000, prev: 59400 }, newyork: { p: 7500, prev: 7425 } }, stocks: out };
}

// What the server and the keeper ask for prices, without going near the feed.
export function fakeFeed() {
  return {
    snapshot: async () => fakeSnapshot(Date.now()),
    chart: async (key, span) => {
      const now = Date.now();
      const p = native(key);
      const step = span === 'today' ? 60000 : DAY;
      const count = span === 'today' ? 30 : span === 'month' ? 23 : 120;
      return { key, span, points: Array.from({ length: count }, (_, i) => [now - (count - 1 - i) * step, p * (1 + 0.02 * Math.sin(i))]), ...(span === 'today' ? { prev: p / 1.01 } : {}) };
    },
  };
}
