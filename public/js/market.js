// The stock market's prices on this page (shared/stocks.js): what came last, kept
// on this device so they are there straight away next time, and asked for when
// someone is looking at them. They come from the keeper (server/keeper.js), which
// fetches them (server/market.js), or from the page's own server when it has no
// keeper; a page on another site has no way to fetch them by itself. Says 'change'
// each time an asking is over, for whatever comes of it.
import { cleanSnapshot, MINUTE } from './shared/stocks.js';
import { load, save } from './storage.js';

const KEY = 'market';

export class Market extends EventTarget {
  constructor() {
    super();
    this.snapshot = cleanSnapshot(load(KEY, null));
    this.keeper = null;
    // 'waiting' until asked, 'ok' with an answer to the last asking, 'away' with none.
    this.status = 'waiting';
    this.askedAt = 0;
    this.asking = null;
    this.wanted = false;
  }

  // The keeper's connection (keeper.js), to ask it through. Asked again as soon
  // as it knows where the keeper is, if prices were wanted before that.
  useKeeper(keeper) {
    this.keeper = keeper;
    keeper.addEventListener('config', () => {
      if (this.wanted && this.status !== 'ok') this.refresh();
    });
  }

  // Asks for prices, unless the last asking was within `ms`.
  want(ms = MINUTE) {
    this.wanted = true;
    if (this.asking) return this.asking;
    if (Date.now() - this.askedAt < ms) return Promise.resolve();
    return this.refresh();
  }

  refresh() {
    this.askedAt = Date.now();
    this.asking = this.ask('market', {})
      .then((reply) => {
        const snapshot = cleanSnapshot(reply);
        if (!snapshot) throw new Error('no prices');
        this.status = 'ok';
        // With the same prices, a company's year may yet have come in since.
        if (JSON.stringify(snapshot) !== JSON.stringify(this.snapshot)) {
          this.snapshot = snapshot;
          save(KEY, snapshot);
        }
      })
      .catch(() => {
        this.status = 'away';
      })
      .finally(() => {
        this.asking = null;
        this.dispatchEvent(new CustomEvent('change'));
      });
    return this.asking;
  }

  // A chart of a company (server/market.js chart): { points: [[t, price]], prev },
  // or null when it cannot be had.
  async chart(key, span) {
    try {
      return await this.ask('market-chart', { key, span });
    } catch {
      return null;
    }
  }

  // Through the keeper if there is one and it answers, and otherwise from this
  // page's own server (nothing there, on a page from anywhere else).
  async ask(what, params) {
    if (this.keeper?.config) {
      try {
        const reply = await this.keeper.request({ t: what, ...params });
        if (reply) return what === 'market' ? reply.market : reply.chart;
      } catch {
        // Away: its own server may yet have them.
      }
    }
    const query = new URLSearchParams(params).toString();
    const res = await fetch(`${what}.json${query ? `?${query}` : ''}`, { cache: 'no-store' });
    if (!res.ok) throw new Error(`${res.status}`);
    return res.json();
  }
}

// The one for this page.
export const market = new Market();
