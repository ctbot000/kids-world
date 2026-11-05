// The real prices for the stock market (shared/stocks.js): fetched here, on the
// computer running the server and the keeper, and handed to pages by them, as the
// feeds cannot be read from a page on another site, and so that however many
// players there are, the feeds only ever see this one computer.
//
// Prices come from the JSON feed behind Naver Pay Securities' pages, the one
// source found that needs no key and covers Seoul, Tokyo and New York; it is
// not a published API, so it can change or go, and then the market carries on
// with the last prices it got until they are too old to trade at (STALE_MS). The
// exchange rates are the European Central Bank's, from Frankfurter. Fetching is
// only ever done when a page asks and what is here has gone out of date: at most
// about once a minute while an exchange is open, and much less when none is.
//
// What is fetched is kept in a file in the keeper's data folder, so a restart
// starts with it.
import { readFile, rename, writeFile } from 'node:fs/promises';
import { companyOf, COMPANIES, DAY, HOUR, MARKETS, marketOf, MINUTE, SECOND, zoneInstant } from '../public/js/shared/stocks.js';

const POLLING = 'https://polling.finance.naver.com/api/realtime';
const CHARTS = 'https://api.stock.naver.com/chart';
const RATES = 'https://api.frankfurter.dev/v1/latest?base=USD&symbols=KRW,JPY';

// How long what was fetched stays good. The feed itself asks for no more than one
// request every 70 seconds for Seoul's prices.
const QUOTES_OPEN_MS = 70 * SECOND;
const QUOTES_SHUT_MS = 10 * MINUTE;
const HISTORY_MS = 6 * HOUR;
const RATES_MS = 6 * HOUR;
const TODAY_OPEN_MS = 70 * SECOND;
const TODAY_SHUT_MS = 30 * MINUTE;
const TIMEOUT_MS = 10 * SECOND;
const HISTORY_PAUSE_MS = 500;

// How many points a chart of today, or of a year, is sent with.
const TODAY_POINTS = 90;
const YEAR_POINTS = 130;
// The closes in a snapshot, for the line in the list: about a month.
const MONTH_CLOSES = 23;

export const CHART_SPANS = ['today', 'month', 'year'];

const isSeoul = (company) => company.market === 'seoul';
const number = (text) => Number(String(text ?? '').replaceAll(',', ''));

// '20261105093000' or '20261105', in a zone, as a moment.
function stamp(text, zone) {
  const s = String(text);
  const part = (from, to) => Number(s.slice(from, to));
  return zoneInstant(zone, part(0, 4), part(4, 6), part(6, 8), part(8, 10) || 0, part(10, 12) || 0);
}

const dateText = (t) => new Date(t).toISOString().slice(0, 10).replaceAll('-', '');

// At most `max` of a list, evenly along it, and always the last.
function thin(list, max) {
  if (list.length <= max) return list;
  const out = [];
  for (let i = 0; i < max; i++) out.push(list[Math.round((i * (list.length - 1)) / (max - 1))]);
  return out;
}

// The tidy number of shares a share became, from how far a close was marked down
// afterwards (10 for a ten-for-one split, 0.1 for ten into one), or null when it
// is not a split at all.
const SPLITS = [1.5, 2, 3, 4, 5, 6, 7, 8, 10, 15, 20, 25, 30, 50, 100];
export function splitRatio(moved) {
  if (!Number.isFinite(moved) || moved <= 0) return null;
  const big = moved >= 1 ? moved : 1 / moved;
  if (big < 1.4) return null;
  const ratio = SPLITS.find((s) => Math.abs(big / s - 1) < 0.06);
  if (!ratio) return null;
  return moved >= 1 ? ratio : 1 / ratio;
}

export class MarketFeed {
  // file: where what was fetched is kept, or nowhere. fetch and now: for the
  // tests. pauseMs: between fetching one company's year and the next.
  constructor({ file = null, fetch = globalThis.fetch, now = () => Date.now(), log = (text) => console.log(text), pauseMs = HISTORY_PAUSE_MS } = {}) {
    this.file = file;
    this.fetch = fetch;
    this.now = now;
    this.log = log;
    this.pauseMs = pauseMs;
    // { at, fx, fxAt, stocks, indexes, history: { key: { at, days: [[date, close]] } }, splits: { key: [[at, ratio]] } }
    this.kept = { at: 0, fx: null, fxAt: 0, stocks: {}, indexes: {}, history: {}, splits: {} };
    // What today has been like for each company, as asked for: { at, points, prev }.
    this.today = new Map();
    this.refreshing = null;
    this.catchingUp = null;
    this.loaded = null;
    this.saving = null;
    this.saveAgain = false;
    this.failed = false;
  }

  load() {
    this.loaded ??= (async () => {
      if (!this.file) return;
      try {
        const saved = JSON.parse(await readFile(this.file, 'utf8'));
        if (saved && typeof saved === 'object') this.kept = { ...this.kept, ...saved };
      } catch {
        // None yet, or not one to read: starting afresh is fine.
      }
    })();
    return this.loaded;
  }

  // Keeps what was fetched, one write at a time, the newest last.
  save() {
    if (!this.file) return Promise.resolve();
    if (this.saving) {
      this.saveAgain = true;
      return this.saving;
    }
    const tmp = `${this.file}.tmp`;
    this.saving = writeFile(tmp, JSON.stringify(this.kept))
      .then(() => rename(tmp, this.file))
      .catch((error) => this.log(`Stock market: could not keep the prices: ${error.message}`))
      .finally(() => {
        this.saving = null;
        if (this.saveAgain) {
          this.saveAgain = false;
          this.save();
        }
      });
    return this.saving;
  }

  async json(url) {
    const res = await this.fetch(url, { headers: { Accept: 'application/json', 'User-Agent': 'kids-world' }, signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (!res.ok) throw new Error(`${res.status} from ${new URL(url).host}`);
    return res.json();
  }

  // The feed failing, once, and coming back, once, rather than every minute.
  told(error) {
    if (error) {
      if (!this.failed) this.log(`Stock market: no new prices (${error.message}); carrying on with the last ones.`);
      this.failed = true;
    } else if (this.failed) {
      this.failed = false;
      this.log('Stock market: prices are coming in again.');
    }
  }

  get anyOpen() {
    return Object.values(this.kept.stocks).some((s) => s.open);
  }

  // The prices as pages take them (shared/stocks.js), or null with none yet.
  // Out of date, they are fetched afresh while these go out: only the very first
  // time does a page wait for them.
  async snapshot() {
    await this.load();
    if (this.now() - this.kept.at >= (this.anyOpen ? QUOTES_OPEN_MS : QUOTES_SHUT_MS)) {
      this.refreshing ??= this.refresh().finally(() => (this.refreshing = null));
      if (!this.kept.at) await this.refreshing;
    }
    if (!this.catchingUp && COMPANIES.some((c) => this.now() - (this.kept.history[c.key]?.at ?? 0) >= HISTORY_MS)) {
      this.catchingUp = this.catchUp().finally(() => (this.catchingUp = null));
    }
    return this.current();
  }

  current() {
    const { at, fx, stocks, indexes, history, splits } = this.kept;
    if (!at || !fx) return null;
    const out = {};
    for (const c of COMPANIES) {
      const s = stocks[c.key];
      if (!s) continue;
      const closes = (history[c.key]?.days ?? []).map(([, close]) => close);
      out[c.key] = {
        ...s,
        month: closes.slice(-MONTH_CLOSES),
        lo: closes.length ? Math.min(...closes) : s.p,
        hi: closes.length ? Math.max(...closes) : s.p,
        splits: splits[c.key] ?? [],
      };
    }
    return { at, fx, indexes, stocks: out };
  }

  // Fetches the prices and, when they are due, the exchange rates. The last good
  // ones stay if it fails.
  async refresh() {
    const { kept } = this;
    try {
      if (this.now() - kept.fxAt >= RATES_MS || !kept.fx) {
        const { rates } = await this.json(RATES);
        if (rates?.KRW > 0 && rates?.JPY > 0) {
          kept.fx = { KRW: rates.KRW, JPY: rates.JPY };
          kept.fxAt = this.now();
        }
      }
      const seoul = COMPANIES.filter(isSeoul);
      const world = COMPANIES.filter((c) => !isSeoul(c));
      const [homeStocks, abroadStocks, homeIndex, abroadIndex] = await Promise.all([
        this.json(`${POLLING}/domestic/stock/${seoul.map((c) => c.code).join(',')}`),
        this.json(`${POLLING}/worldstock/stock/${world.map((c) => c.code).join(',')}`),
        this.json(`${POLLING}/domestic/index/${marketOf('seoul').index}`),
        this.json(`${POLLING}/worldstock/index/${MARKETS.filter((m) => m.key !== 'seoul').map((m) => m.index).join(',')}`),
      ]);
      const stocks = {};
      for (const d of [...(homeStocks.datas ?? []), ...(abroadStocks.datas ?? [])]) {
        const c = COMPANIES.find((x) => x.code === (d.itemCode ?? d.reutersCode));
        const p = number(d.closePrice);
        if (!c || !(p > 0)) continue;
        const change = number(d.compareToPreviousClosePrice);
        const t = Date.parse(d.localTradedAt);
        stocks[c.key] = { p, prev: p - change > 0 ? p - change : p, t: Number.isFinite(t) ? t : this.now(), open: d.marketStatus === 'OPEN' };
      }
      const indexes = {};
      for (const d of [...(homeIndex.datas ?? []), ...(abroadIndex.datas ?? [])]) {
        const m = MARKETS.find((x) => x.index === (d.itemCode ?? d.reutersCode));
        const p = number(d.closePrice);
        if (m && p > 0) indexes[m.key] = { p, prev: p - number(d.compareToPreviousClosePrice) };
      }
      if (!Object.keys(stocks).length) throw new Error('the feed had no prices in it');
      kept.stocks = { ...kept.stocks, ...stocks };
      kept.indexes = { ...kept.indexes, ...indexes };
      kept.at = this.now();
      this.told(null);
      this.save();
    } catch (error) {
      this.told(error);
    }
  }

  // Each company's last year of closes, one company at a time, for those it is
  // time to fetch again.
  async catchUp() {
    for (const c of COMPANIES) {
      if (this.now() - (this.kept.history[c.key]?.at ?? 0) < HISTORY_MS) continue;
      try {
        await this.fetchYear(c);
      } catch (error) {
        this.told(error);
        return;
      }
      if (this.pauseMs) await new Promise((r) => setTimeout(r, this.pauseMs));
    }
    this.save();
  }

  async fetchYear(company) {
    const end = this.now();
    const kind = isSeoul(company) ? 'domestic' : 'foreign';
    const url = `${CHARTS}/${kind}/item/${encodeURIComponent(company.code)}/day?startDateTime=${dateText(end - 366 * DAY)}0000&endDateTime=${dateText(end + DAY)}2359`;
    const rows = await this.json(url);
    if (!Array.isArray(rows)) throw new Error('the feed had no history in it');
    const days = rows.map((r) => [Number(r.localDate), Number(r.closePrice)]).filter(([date, close]) => date > 0 && close > 0);
    if (!days.length) throw new Error('the feed had no history in it');
    this.noticeSplit(company, days);
    this.kept.history[company.key] = { at: this.now(), days };
    return days;
  }

  // A company that split its shares has its past closes marked down to match, so
  // a close already kept that now reads differently says it did, and by how much.
  // Only finished days: the last one in the feed may be today, still going.
  noticeSplit(company, days) {
    const before = this.kept.history[company.key]?.days;
    if (!before?.length) return;
    const fresh = new Map(days);
    const newest = days.at(-1)[0];
    for (let i = before.length - 1; i >= 0; i--) {
      const [date, close] = before[i];
      if (date >= newest || !fresh.has(date)) continue;
      const ratio = splitRatio(close / fresh.get(date));
      if (ratio) {
        // It took effect some time after the last day that read as before: the
        // next trading day's opening, as near as can be told.
        const after = days.find(([d]) => d > date)?.[0] ?? newest;
        const m = marketOf(company.market);
        const [y, mo, d] = [Math.floor(after / 10000), Math.floor(after / 100) % 100, after % 100];
        const at = Math.min(zoneInstant(m.zone, y, mo, d, m.opens[0], m.opens[1]), this.now());
        this.kept.splits[company.key] = [...(this.kept.splits[company.key] ?? []), [at, ratio]].slice(-20);
        this.log(`Stock market: ${company.name} split its shares, each now ${ratio}.`);
      }
      return;
    }
  }

  // A chart of a company: { key, span, points: [[t, price]], prev } in its own
  // currency (prev: the last close, for a chart of today), or null for nothing to
  // show. Its year is fetched first if it has not been yet.
  async chart(key, span) {
    await this.load();
    const company = companyOf(key);
    if (!company || !CHART_SPANS.includes(span)) return null;
    try {
      if (span === 'today') return await this.chartToday(company);
      const days = this.kept.history[key]?.days ?? (await this.fetchYear(company));
      const m = marketOf(company.market);
      const points = days.map(([date, close]) => [stamp(`${date}`, m.zone), close]);
      return { key, span, points: span === 'month' ? points.slice(-MONTH_CLOSES) : thin(points, YEAR_POINTS) };
    } catch (error) {
      this.told(error);
      return { key, span, points: [] };
    }
  }

  async chartToday(company) {
    const have = this.today.get(company.key);
    const open = this.kept.stocks[company.key]?.open;
    if (have && this.now() - have.at < (open ? TODAY_OPEN_MS : TODAY_SHUT_MS)) return { key: company.key, span: 'today', points: have.points, prev: have.prev };
    try {
      const kind = isSeoul(company) ? 'domestic' : 'foreign';
      const d = await this.json(`${CHARTS}/${kind}/item/${encodeURIComponent(company.code)}?periodType=day`);
      const rows = d.priceInfos?.length ? d.priceInfos : (d.lastPriceInfos ?? []);
      const { zone } = marketOf(company.market);
      const points = thin(
        rows.map((r) => [stamp(r.localDateTime, zone), Number(r.currentPrice)]).filter(([t, p]) => t > 0 && p > 0),
        TODAY_POINTS,
      );
      const prev = Number(d.lastClosePrice) > 0 ? Number(d.lastClosePrice) : null;
      this.today.set(company.key, { at: this.now(), points, prev });
      return { key: company.key, span: 'today', points, prev };
    } catch (error) {
      if (have) return { key: company.key, span: 'today', points: have.points, prev: have.prev };
      throw error;
    }
  }
}
