// The stock market: real companies at their real prices, on the real stock
// exchanges of Seoul, Tokyo and New York, bought and sold with 🪙 coins, at a
// Stock Terminal (blocks.js) or from the 🛒 shop. The prices are real; the
// shares and the coins are not: no real money or real trade comes anywhere near
// this. A coin is worth a US dollar, so a share costs in coins what it costs in
// dollars, and Seoul's and Tokyo's prices are changed at the day's exchange rate.
//
// The prices come as a snapshot, which server/market.js puts together and pages
// get from the keeper or their own server (js/market.js):
//   { at, fx: { KRW, JPY }, indexes: { market: { p, prev } },
//     stocks: { key: { p, prev, t, open, month: [...], lo, hi, splits: [[at, ratio]] } } }
// at: when it was fetched; fx: how much of each currency a coin (a dollar) buys;
// p: the price now, in its own currency; prev: the last day's close; t: when it
// last traded; open: whether its exchange is open; month: the closes of about the
// last month; lo and hi: the lowest and highest of the last year; splits: when
// the company split its shares, and how many each became.
//
// What you own is kept with your gear (shop.js cleanGear, as gear.stocks:
// { key: { n, paid, at } }, how many shares, the coins they cost you, and when you
// last bought or a split last changed them). It all happens on your own page, like
// buying in the shop.
import { BLOCKS } from './blocks.js';
import { cellNear } from './arcade.js';

export const SECOND = 1000;
export const MINUTE = 60 * SECOND;
export const HOUR = 60 * MINUTE;
export const DAY = 24 * HOUR;

// How often the screens in the world change what they show.
export const TICK_MS = 10 * SECOND;

// Prices older than this are not traded at: the feed has been away too long for
// them to be anywhere near what they are now.
export const STALE_MS = 6 * HOUR;

// The most shares of one company you can own.
export const SHARES_MAX = 9999;

// The exchanges: where, when (in their own time, on weekdays), in what currency,
// the index that says how the whole market is doing, and how many minutes late
// the feed tells their prices.
export const MARKETS = [
  { key: 'seoul', flag: '🇰🇷', name: 'Seoul', zone: 'Asia/Seoul', opens: [9, 0], closes: [15, 30], currency: 'KRW', sign: '₩', index: 'KOSPI', indexName: 'KOSPI', late: 0 },
  { key: 'tokyo', flag: '🇯🇵', name: 'Tokyo', zone: 'Asia/Tokyo', opens: [9, 0], closes: [15, 30], currency: 'JPY', sign: '¥', index: '.N225', indexName: 'Nikkei 225', late: 15 },
  { key: 'newyork', flag: '🇺🇸', name: 'New York', zone: 'America/New_York', opens: [9, 30], closes: [16, 0], currency: 'USD', sign: '$', index: '.INX', indexName: 'S&P 500', late: 0 },
];
const MARKET_BY_KEY = new Map(MARKETS.map((m) => [m.key, m]));
export const marketOf = (key) => MARKET_BY_KEY.get(key) ?? null;

// The companies, market by market. code: what the price feed calls it; ticker:
// what the market calls it.
export const COMPANIES = [
  { key: 'samsung', code: '005930', ticker: '005930', icon: '📱', name: 'Samsung Electronics', market: 'seoul', what: 'Phones, TVs and the chips inside them.' },
  { key: 'kakao', code: '035720', ticker: '035720', icon: '💬', name: 'Kakao', market: 'seoul', what: 'KakaoTalk, the chat app, and the Kakao Friends.' },
  { key: 'hyundai', code: '005380', ticker: '005380', icon: '🚗', name: 'Hyundai Motor', market: 'seoul', what: 'Cars, buses and trucks.' },
  { key: 'hybe', code: '352820', ticker: '352820', icon: '🎤', name: 'HYBE', market: 'seoul', what: 'The music company behind BTS.' },
  { key: 'orion', code: '271560', ticker: '271560', icon: '🍫', name: 'Orion', market: 'seoul', what: 'Snacks, like the Choco Pie.' },
  { key: 'binggrae', code: '005180', ticker: '005180', icon: '🍌', name: 'Binggrae', market: 'seoul', what: 'Banana Flavored Milk and ice cream.' },
  { key: 'nintendo', code: '7974.T', ticker: '7974', icon: '🎮', name: 'Nintendo', market: 'tokyo', what: 'Mario, Zelda and the Switch.' },
  { key: 'sony', code: '6758.T', ticker: '6758', icon: '🎧', name: 'Sony', market: 'tokyo', what: 'PlayStation, music, movies and cameras.' },
  { key: 'sanrio', code: '8136.T', ticker: '8136', icon: '🎀', name: 'Sanrio', market: 'tokyo', what: 'Hello Kitty and her friends.' },
  { key: 'bandai', code: '7832.T', ticker: '7832', icon: '🤖', name: 'Bandai Namco', market: 'tokyo', what: 'Toys and games: Gundam models, Pac-Man and Tamagotchi.' },
  { key: 'apple', code: 'AAPL.O', ticker: 'AAPL', icon: '🍎', name: 'Apple', market: 'newyork', what: 'iPhones, iPads and Macs.' },
  { key: 'alphabet', code: 'GOOGL.O', ticker: 'GOOGL', icon: '🔎', name: 'Alphabet', market: 'newyork', what: 'Google, YouTube and Android.' },
  { key: 'microsoft', code: 'MSFT.O', ticker: 'MSFT', icon: '💻', name: 'Microsoft', market: 'newyork', what: 'Windows, Xbox and Minecraft.' },
  { key: 'disney', code: 'DIS', ticker: 'DIS', icon: '🏰', name: 'Walt Disney', market: 'newyork', what: 'Mickey Mouse, movies and theme parks.' },
  { key: 'netflix', code: 'NFLX.O', ticker: 'NFLX', icon: '🎬', name: 'Netflix', market: 'newyork', what: 'Shows and movies to watch at home.' },
  { key: 'nike', code: 'NKE', ticker: 'NKE', icon: '👟', name: 'Nike', market: 'newyork', what: 'Sneakers and sportswear.' },
  { key: 'cocacola', code: 'KO', ticker: 'KO', icon: '🥤', name: 'Coca-Cola', market: 'newyork', what: 'Coke and lots of other drinks.' },
  { key: 'mcdonalds', code: 'MCD', ticker: 'MCD', icon: '🍔', name: "McDonald's", market: 'newyork', what: 'Burgers and fries all over the world.' },
  { key: 'mattel', code: 'MAT.O', ticker: 'MAT', icon: '🧸', name: 'Mattel', market: 'newyork', what: 'Barbie, Hot Wheels and UNO.' },
  { key: 'roblox', code: 'RBLX.K', ticker: 'RBLX', icon: '🧱', name: 'Roblox', market: 'newyork', what: 'The game where players make the games.' },
];
const COMPANY_BY_KEY = new Map(COMPANIES.map((c) => [c.key, c]));
export const companyOf = (key) => COMPANY_BY_KEY.get(key) ?? null;
export const companiesIn = (market) => COMPANIES.filter((c) => c.market === market);

// ---------------------------------------------------------------- the snapshot

const positive = (n) => Number.isFinite(n) && n > 0;

// A snapshot as a page takes it, or null with nothing to go on: only companies
// there are, and only sensible numbers.
export function cleanSnapshot(raw) {
  if (!raw || typeof raw !== 'object' || !positive(raw.at)) return null;
  const fx = {};
  for (const m of MARKETS) {
    if (m.currency === 'USD') continue;
    if (!positive(raw.fx?.[m.currency])) return null;
    fx[m.currency] = raw.fx[m.currency];
  }
  const stocks = {};
  for (const c of COMPANIES) {
    const s = raw.stocks?.[c.key];
    if (!positive(s?.p)) continue;
    const month = Array.isArray(s.month) ? s.month.filter(positive).slice(-40) : [];
    const splits = Array.isArray(s.splits) ? s.splits.filter((e) => Array.isArray(e) && positive(e[0]) && positive(e[1])).slice(-20).map(([at, ratio]) => [at, ratio]) : [];
    stocks[c.key] = {
      p: s.p,
      prev: positive(s.prev) ? s.prev : s.p,
      t: positive(s.t) ? s.t : raw.at,
      open: s.open === true,
      month,
      lo: positive(s.lo) ? Math.min(s.lo, s.p) : s.p,
      hi: positive(s.hi) ? Math.max(s.hi, s.p) : s.p,
      splits,
    };
  }
  if (!Object.keys(stocks).length) return null;
  const indexes = {};
  for (const m of MARKETS) {
    const i = raw.indexes?.[m.key];
    if (positive(i?.p)) indexes[m.key] = { p: i.p, prev: positive(i.prev) ? i.prev : i.p };
  }
  return { at: raw.at, fx, indexes, stocks };
}

// Whether a snapshot's prices are recent enough to trade at.
export const isFresh = (snapshot, t) => Boolean(snapshot) && t - snapshot.at < STALE_MS;

// How much of a company's currency one coin buys.
function rateOf(snapshot, company) {
  const { currency } = marketOf(company.market);
  return currency === 'USD' ? 1 : (snapshot?.fx?.[currency] ?? 0);
}

// A company's price as things stand, or null with none: cents, whole hundredths
// of a coin, and coins; in its own currency (native), how far it has moved since
// the last close (change: 0.02 for 2% up, whatever the exchange rate did), when it
// last traded, and whether its exchange is open.
export function quote(snapshot, key) {
  const c = companyOf(key);
  const s = snapshot?.stocks?.[key];
  const rate = c ? rateOf(snapshot, c) : 0;
  if (!s || !rate) return null;
  const cents = Math.max(1, Math.round((s.p / rate) * 100));
  return { cents, coins: cents / 100, native: s.p, change: s.prev ? s.p / s.prev - 1 : 0, t: s.t, open: s.open };
}

// A native price as coins, for charts and the like.
export function toCoins(snapshot, key, native) {
  const c = companyOf(key);
  const rate = c ? rateOf(snapshot, c) : 0;
  return rate ? native / rate : 0;
}

// Whether an exchange is open, as the feed says.
export const marketOpen = (snapshot, market) => companiesIn(market).some((c) => snapshot?.stocks?.[c.key]?.open);

// How an exchange's whole market has moved since the last close (0.02 for 2% up),
// or null when it is not known.
export function indexChange(snapshot, market) {
  const i = snapshot?.indexes?.[market];
  return i ? i.p / i.prev - 1 : null;
}

// What the markets are like, on the average of their indexes today: a bull throws
// things up on its horns and a bear swipes them down. Null when it is not known.
const MOOD_LINE = 0.004;
export function moodOf(snapshot) {
  const changes = MARKETS.map((m) => indexChange(snapshot, m.key)).filter((c) => c !== null);
  if (!changes.length) return null;
  const change = changes.reduce((a, b) => a + b, 0) / changes.length;
  if (change > MOOD_LINE) return { key: 'bull', icon: '🐂', name: 'Bull market', text: 'Prices are mostly going up today.', change };
  if (change < -MOOD_LINE) return { key: 'bear', icon: '🐻', name: 'Bear market', text: 'Prices are mostly going down today.', change };
  return { key: 'calm', icon: '😴', name: 'A quiet market', text: 'Prices are not going anywhere much today.', change };
}

// How much a company has been moving lately, from its last month of closes: the
// usual size of a day's move, and a word for it. Null with too few to tell.
export function swingOf(snapshot, key) {
  const closes = snapshot?.stocks?.[key]?.month ?? [];
  if (closes.length < 6) return null;
  const moves = closes.slice(1).map((c, i) => Math.abs(c / closes[i] - 1));
  const size = moves.reduce((a, b) => a + b, 0) / moves.length;
  if (size < 0.012) return { size, icon: '🐢', name: 'Calm lately', text: 'Small moves most days lately.' };
  if (size < 0.025) return { size, icon: '🐇', name: 'Bouncy lately', text: 'A fair move most days lately.' };
  return { size, icon: '🚀', name: 'Wild lately', text: 'Big ups and downs lately.' };
}

// ---------------------------------------------------------------- when they open

const zoneFormats = new Map();
// The date and time in a zone at time t.
function zoneParts(t, zone) {
  let format = zoneFormats.get(zone);
  if (!format) {
    format = new Intl.DateTimeFormat('en-US', { timeZone: zone, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric' });
    zoneFormats.set(zone, format);
  }
  const p = Object.fromEntries(format.formatToParts(new Date(t)).map(({ type, value }) => [type, Number(value)]));
  return { y: p.year, m: p.month, d: p.day, h: p.hour, min: p.minute, s: p.second };
}

// The moment it is this date and time in a zone.
export function zoneInstant(zone, y, m, d, h = 0, min = 0, s = 0) {
  const wanted = Date.UTC(y, m - 1, d, h, min, s);
  // Off by the zone's offset at first, and right on the second go even where
  // that offset changes on the day.
  let t = wanted;
  for (let i = 0; i < 2; i++) {
    const p = zoneParts(t, zone);
    t += wanted - Date.UTC(p.y, p.m - 1, p.d, p.h, p.min, p.s);
  }
  return t;
}

// The next time an exchange's hours say it trades (on a weekday; the clock knows
// nothing of holidays): { opens, closes }, with closes after t.
export function nextSession(market, t) {
  const m = marketOf(market);
  const { y, m: month, d } = zoneParts(t, m.zone);
  for (let i = 0; i < 8; i++) {
    const day = new Date(Date.UTC(y, month - 1, d + i));
    if (day.getUTCDay() === 0 || day.getUTCDay() === 6) continue;
    const at = (hours) => zoneInstant(m.zone, day.getUTCFullYear(), day.getUTCMonth() + 1, day.getUTCDate(), hours[0], hours[1]);
    const session = { opens: at(m.opens), closes: at(m.closes) };
    if (session.closes > t) return session;
  }
  return null;
}

// When an exchange next changes: { open, closes } as the feed says it is open, or
// { open: false, opens }. Its hours say it should be open and the feed says it is
// not: a holiday, and it is the next session it opens at.
export function marketTimes(snapshot, market, t) {
  const session = nextSession(market, t);
  if (marketOpen(snapshot, market)) return { open: true, closes: session?.opens <= t ? session.closes : null };
  const next = session && session.opens <= t ? nextSession(market, session.closes + 1) : session;
  return { open: false, opens: next?.opens ?? null };
}

// ---------------------------------------------------------------- what you own

// What you own as kept: only companies there are, whole numbers, nothing silly.
export function cleanStocks(raw) {
  const out = {};
  if (!raw || typeof raw !== 'object') return out;
  for (const c of COMPANIES) {
    const h = raw[c.key];
    if (!Number.isInteger(h?.n) || h.n < 1) continue;
    const n = Math.min(SHARES_MAX, h.n);
    out[c.key] = { n, paid: Number.isInteger(h.paid) && h.paid > 0 ? Math.min(h.paid, n * 100000) : 0, at: Number.isFinite(h.at) && h.at > 0 ? h.at : 0 };
  }
  return out;
}

// The make-believe companies the market had at first (2026-11-05), whose shares
// are worth what was paid for them, coming back as coins (profile.js).
const OLD_COMPANIES = ['carrot', 'brick', 'candy', 'burrow', 'car', 'dragon', 'robot', 'rocket'];
export function oldSharesPaid(raw) {
  let paid = 0;
  for (const key of OLD_COMPANIES) if (Number.isInteger(raw?.[key]?.paid) && raw[key].paid > 0) paid += raw[key].paid;
  return paid;
}

// What two lots of shares come to, for a guest's progress joining a login.
export function addStocks(a, b) {
  const out = cleanStocks(a);
  for (const [key, h] of Object.entries(cleanStocks(b))) {
    const had = out[key] ?? { n: 0, paid: 0, at: 0 };
    out[key] = { n: had.n + h.n, paid: had.paid + h.paid, at: Math.max(had.at, h.at) };
  }
  return cleanStocks(out);
}

// How many companies you own shares of, and on how many exchanges.
export const companiesHeld = (stocks) => Object.keys(stocks ?? {}).length;
export const marketsHeld = (stocks) => new Set(Object.keys(stocks ?? {}).map((key) => companyOf(key)?.market).filter(Boolean)).size;

// What n shares cost and bring, in whole coins: buying rounds up and selling
// rounds down, so going round in a circle never makes a coin.
const costOf = (cents, n) => Math.ceil((cents * n) / 100);
const saleOf = (cents, n) => Math.floor((cents * n) / 100);

// What all your shares would fetch, and what they cost you. Shares of a company
// with no price just now count for what they cost.
export function worth(stocks, snapshot) {
  let value = 0;
  let paid = 0;
  for (const [key, h] of Object.entries(stocks ?? {})) {
    const q = quote(snapshot, key);
    value += q ? saleOf(q.cents, h.n) : h.paid;
    paid += h.paid;
  }
  return { value, paid, gain: value - paid };
}

// How many shares of a company your coins buy, and you have room for.
export function canBuy(stocks, key, coins, snapshot) {
  const q = quote(snapshot, key);
  if (!q) return 0;
  return Math.max(0, Math.min(Math.floor((coins * 100) / q.cents), SHARES_MAX - (stocks?.[key]?.n ?? 0)));
}

// Buying n shares at time t: { stocks, n, cost }, or null when it cannot be done
// (no fresh price, not enough coins, not a whole number, or no room).
export function buying(stocks, key, n, coins, snapshot, t) {
  const q = quote(snapshot, key);
  if (!q || !isFresh(snapshot, t) || !Number.isInteger(n) || n < 1 || n > canBuy(stocks, key, coins, snapshot)) return null;
  const cost = costOf(q.cents, n);
  const had = stocks?.[key] ?? { n: 0, paid: 0, at: 0 };
  return { stocks: { ...stocks, [key]: { n: had.n + n, paid: had.paid + cost, at: t } }, n, cost };
}

// Selling n shares at time t: { stocks, n, coins, profit }, the profit (below 0 for
// a loss) against what those shares cost you, your average price for them; or null
// when it cannot be done.
export function selling(stocks, key, n, snapshot, t) {
  const q = quote(snapshot, key);
  const had = stocks?.[key];
  if (!q || !isFresh(snapshot, t) || !had || !Number.isInteger(n) || n < 1 || n > had.n) return null;
  const coins = saleOf(q.cents, n);
  const part = n === had.n ? had.paid : Math.round((had.paid * n) / had.n);
  const out = { ...stocks };
  if (n === had.n) delete out[key];
  else out[key] = { n: had.n - n, paid: had.paid - part, at: had.at };
  return { stocks: out, n, coins, profit: coins - part };
}

// Splits a company has made since you got your shares: a share of it becomes
// several, each worth that much less, so what you own is worth the same. Returns
// { stocks, done: [{ key, from, to }] } (done empty, and stocks as they were, with
// none to make).
export function splitting(stocks, snapshot) {
  const done = [];
  const out = { ...stocks };
  for (const [key, h] of Object.entries(stocks ?? {})) {
    const due = (snapshot?.stocks?.[key]?.splits ?? []).filter(([at]) => at > h.at).sort((a, b) => a[0] - b[0]);
    if (!due.length) continue;
    const ratio = due.reduce((r, [, each]) => r * each, 1);
    const n = Math.max(1, Math.min(SHARES_MAX, Math.round(h.n * ratio)));
    out[key] = { n, paid: h.paid, at: due.at(-1)[0] };
    done.push({ key, from: h.n, to: n });
  }
  return { stocks: done.length ? out : stocks, done };
}

// ---------------------------------------------------------------- the furniture

export const isTerminal = (id) => BLOCKS[id]?.model === 'stock-terminal';
export const isTicker = (id) => BLOCKS[id]?.model === 'stock-ticker';

// The Stock Terminal beside a body standing in reach of its cell, or null.
export const terminalNear = (world, body, reach = 2.2) => cellNear(world, body, (id) => (isTerminal(id) ? {} : null), reach);
