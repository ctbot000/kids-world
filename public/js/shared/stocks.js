// The stock market: shares of eight make-believe companies, bought and sold
// for 🪙 coins, at a Stock Terminal (blocks.js) or from the 🛒 shop. A share is
// a tiny piece of a company: when more people want the company, its price goes
// up, and when fewer do, it goes down. Buy low, sell high, and keep an eye on
// the news.
//
// Prices are worked out from the time and nothing else, so every player on
// every island and every device sees the same market at the same moment, with
// no server to keep it: priceAt(key, t) can say what a company cost at any
// moment, past or to come, without having worked out the moments in between.
// A price is the company's own usual price, multiplied up and down by
//   - wobbles: smooth random waves, from a minute long to a week long,
//   - the mood of the whole market: longer waves that all companies share, and
//   - the news: now and then something happens to a company, its price jumps up
//     or down over a couple of minutes, and then slowly goes back to usual.
// So prices never run away or fall to nothing, however long the game goes on:
// a cheap moment comes back, and so does a dear one.
//
// You buy for a little more than a share's price and sell for a little less
// (quote), so buying and selling again straight away always costs a little,
// and only a real move in the price makes money. And the steady companies pay
// a dividend, a share of what they earn, to whoever owns their shares, every
// day: so waiting patiently pays too.
//
// What you own is kept with your gear (shop.js cleanGear, as gear.stocks:
// { key: { n, paid } }, how many shares and the coins they cost you, and
// gear.divDay, the market day you were last paid a dividend for). It all
// happens on your own page, like buying in the shop.
import { BLOCKS } from './blocks.js';
import { cellNear } from './arcade.js';
import { hash2, hashString } from './rng.js';

export const SECOND = 1000;
export const MINUTE = 60 * SECOND;
export const HOUR = 60 * MINUTE;
export const DAY = 24 * HOUR;

// How often prices change.
export const TICK_MS = 10 * SECOND;

// A market day, for dividends, starts at midnight in Korea.
const DAY_SHIFT = 9 * HOUR;
export const marketDay = (t) => Math.floor((t + DAY_SHIFT) / DAY);

// The most shares of one company you can own.
export const SHARES_MAX = 9999;

// How a company's shares behave. swing: how far its price moves, against the
// others; pays: the share of its usual price it pays each share in a dividend,
// each day. The wild ones move the most and pay nothing; the steady ones hardly
// move and pay the most.
export const KINDS = {
  steady: { icon: '🐢', name: 'Steady', swing: 0.55, pays: 0.005, text: 'Small ups and downs, and a dividend for every share each day.' },
  bouncy: { icon: '🐇', name: 'Bouncy', swing: 1, pays: 0.002, text: 'Goes up and down a fair bit, and pays a little dividend each day.' },
  wild: { icon: '🚀', name: 'Wild', swing: 1.6, pays: 0, text: 'Big ups and big downs, and no dividend: exciting, and risky!' },
};

// The companies, in the order the market shows them. base: the price it
// usually costs. good and bad: what the news says of it.
export const COMPANIES = [
  {
    key: 'carrot',
    ticker: 'CRNC',
    icon: '🥕',
    name: 'Crunchy Carrot Farms',
    kind: 'steady',
    base: 15,
    what: 'Grows the crunchiest carrots on the islands.',
    good: ['Bunnies everywhere can’t get enough of its carrots!', 'A record harvest, and every carrot sold!', 'Its new rainbow carrots are a hit at picnics!', 'Carrot cake is the new craze at birthday parties!', 'A snowman on every island needs a carrot nose!'],
    bad: ['A very hungry rabbit got into the carrot field.', 'Too much rain: the carrots are a bit soggy.', 'Everyone wants pumpkins this week, not carrots.', 'A whole truck of carrots rolled into the sea.', 'Somebody said carrots taste like soap. They don’t!'],
  },
  {
    key: 'brick',
    ticker: 'BRIK',
    icon: '🧱',
    name: 'Big Brick Co.',
    kind: 'steady',
    base: 120,
    what: 'Makes the little studded bricks everything is built with.',
    good: ['Everyone is building castles: brick sales are up!', 'Its new sparkly bricks have sold out!', 'A huge new island has ordered a million bricks!', 'A world record for the tallest brick tower!', 'Every school is teaching building with bricks!'],
    bad: ['A box of bricks spilled, and somebody stepped on one. Ouch!', 'Nobody is building this week: they’ve all gone fishing.', 'A batch of bricks came out a funny colour.', 'The new bricks don’t quite snap together.', 'A big tower fell over. It was just too tall!'],
  },
  {
    key: 'candy',
    ticker: 'SWT',
    icon: '🍭',
    name: 'Candy Cove Sweets',
    kind: 'bouncy',
    base: 35,
    what: 'Sweets, frosting and cotton candy for the whole sea.',
    good: ['Its new sour drops are the talk of the playground!', 'A giant birthday party ordered ALL the frosting!', 'Kids voted its gummies the yummiest of the year!', 'A lollipop as big as a house opens this week!', 'Its cotton candy now comes in rainbow!'],
    bad: ['Its toffee stuck the factory door shut.', 'Dentists say: maybe a few less lollipops?', 'A seagull flew off with the secret recipe!', 'Ants have found the sugar store.', 'The new broccoli-flavour lollipops are not a hit.'],
  },
  {
    key: 'burrow',
    ticker: 'BUN',
    icon: '🐰',
    name: 'Bunny Burrows',
    kind: 'bouncy',
    base: 60,
    what: 'Builds cozy homes under the ground for bunnies.',
    good: ['So many baby bunnies: everyone needs a bigger burrow!', 'Its new burrows come with a carrot fridge!', 'Burrow of the Year goes to... Bunny Burrows!', 'Ducks want burrows now too!', 'A cozy winter is coming: everyone wants to move in!'],
    bad: ['A digger dug right through a burrow by mistake.', 'A leaky pond flooded three burrows. Everyone’s fine, just damp.', 'Foxes have moved in next door. Prices dropped!', 'The new burrows have a very small front door.', 'Bunnies say the neighbours thump too loudly.'],
  },
  {
    key: 'car',
    ticker: 'VROM',
    icon: '🚗',
    name: 'Vroom Toy Cars',
    kind: 'bouncy',
    base: 180,
    what: 'Toy cars, go-karts and very shiny wheels.',
    good: ['Its new go-kart won every race this week!', 'Everyone wants the new car with the loud horn!', 'A big race is coming, and the karts have sold out!', 'Its tiny car can now drive up a ramp!', 'A new kind of wheel makes everything faster!'],
    bad: ['The new car’s horn plays the wrong song.', 'A wheel fell off at the big race!', 'Everyone rides ponies this week instead.', 'The shiny paint comes off in the rain.', 'Its fastest kart went round the track backwards.'],
  },
  {
    key: 'dragon',
    ticker: 'DRGN',
    icon: '🐉',
    name: 'Dragon Rides',
    kind: 'wild',
    base: 25,
    what: 'Rides on a real dragon. A brand new company with big dreams!',
    good: ['A dragon flew round the whole island without one sneeze!', 'Long lines for rides: every seat is taken!', 'A second dragon has joined the company!', 'Riders got a free loop-the-loop!', 'The dragon has learned to land very gently!'],
    bad: ['The dragon sneezed and toasted the ticket booth.', 'The dragon is asleep and will not get up.', 'Riders say it’s a bit warm up there.', 'The dragon ate all the snacks for sale.', 'A storm has grounded all the flights today.'],
  },
  {
    key: 'robot',
    ticker: 'BEEP',
    icon: '🤖',
    name: 'Beep Robots',
    kind: 'wild',
    base: 90,
    what: 'Friendly robots that help around the house.',
    good: ['Its new robot can tidy a whole bedroom!', 'A robot just won the school spelling bee!', 'Every island wants a robot helper!', 'Its robot learned to bake a cake, and it’s tasty!', 'A robot found a lost kitten!'],
    bad: ['Robots keep tidying away people’s homework.', 'A robot went beep beep beep all night long.', 'A software bug made all the robots dance.', 'The robots have gone on a tea break.', 'A robot watered the sofa instead of the plants.'],
  },
  {
    key: 'rocket',
    ticker: 'WHSH',
    icon: '🚀',
    name: 'Whoosh Rockets',
    kind: 'wild',
    base: 300,
    what: 'Rockets to the moon, one day, maybe very soon.',
    good: ['Its rocket made it all the way to the clouds!', 'Astronauts have lined up for the first trip to the moon!', 'A test flight went perfectly, and it landed too!', 'Its new engine is twice as whooshy!', 'A rocket brought back a bag of moon rocks!'],
    bad: ['The rocket fizzled out on the launch pad.', 'Oops! The rocket went sideways into the sea.', 'The moon trip has been put off until next year.', 'Someone forgot to fill up the fuel tank.', 'Clouds got in the way, so everyone went home.'],
  },
];
const BY_KEY = new Map(COMPANIES.map((c) => [c.key, c]));
export const companyOf = (key) => BY_KEY.get(key) ?? null;
export const kindOf = (key) => KINDS[companyOf(key)?.kind] ?? null;

// The waves every company's price goes up and down on: how long each is and
// how big, as a share of the price.
const WOBBLES = [
  [MINUTE, 0.006],
  [5 * MINUTE, 0.02],
  [20 * MINUTE, 0.04],
  [HOUR, 0.05],
  [6 * HOUR, 0.05],
  [DAY, 0.06],
  [7 * DAY, 0.09],
];
// The waves of the whole market's mood, the same for every company.
const MOODS = [
  [8 * HOUR, 0.025],
  [2 * DAY, 0.04],
  [10 * DAY, 0.05],
];

// The news. In each stretch of NEWS_EVERY, a company has a NEWS_CHANCE of
// something happening, at a moment of its own in that stretch: its price jumps
// by NEWS_MIN to NEWS_MAX over NEWS_RISE and goes back over about NEWS_FADE.
export const NEWS_EVERY = 2 * HOUR;
const NEWS_CHANCE = 0.3;
const NEWS_MIN = 0.05;
const NEWS_MAX = 0.16;
const NEWS_RISE = 2 * MINUTE;
const NEWS_FADE = 3 * HOUR;
// How long ago news can still matter: it has all but faded by then.
const NEWS_REACH = 5 * NEWS_FADE;

// However things go, a price stays within this far of usual (as a power of e):
// about a third of it, up to about three times.
const FARTHEST = 1.15;

// You buy for this much more than the price, and sell for this much less.
export const SPREAD = 0.01;

const seeds = new Map(COMPANIES.map((c) => [c.key, hashString(`stocks ${c.key}`)]));
const MOOD_SEED = hashString('stocks mood');

// A wave from -1 to 1: a random height every `period`, joined up smoothly.
function wave(seed, t, period) {
  const x = t / period;
  const i = Math.floor(x);
  const f = x - i;
  const a = hash2(seed, i, period / SECOND);
  const b = hash2(seed, i + 1, period / SECOND);
  return (a + (b - a) * (f * f * (3 - 2 * f))) * 2 - 1;
}

const waves = (seed, t, list) => {
  let sum = 0;
  for (const [period, size] of list) sum += wave(seed, t, period) * size;
  return sum;
};

// The piece of news about a company in stretch `w` of NEWS_EVERY, or null if
// nothing happened then: { key, at, good, size, text }.
function newsIn(company, w) {
  const seed = seeds.get(company.key);
  if (hash2(seed ^ 0x51ed27, w, 1) >= NEWS_CHANCE) return null;
  const good = hash2(seed ^ 0x51ed27, w, 2) < 0.5;
  const list = good ? company.good : company.bad;
  return {
    key: company.key,
    at: Math.floor((w + hash2(seed ^ 0x51ed27, w, 3)) * NEWS_EVERY),
    good,
    size: NEWS_MIN + (NEWS_MAX - NEWS_MIN) * hash2(seed ^ 0x51ed27, w, 4),
    // By the stretch, not at random, so the same words do not come twice running.
    text: list[w % list.length],
  };
}

// How far the news has moved a company's price at time t, up or down.
function newsPush(company, t) {
  let sum = 0;
  const last = Math.floor(t / NEWS_EVERY);
  for (let w = Math.floor((t - NEWS_REACH) / NEWS_EVERY); w <= last; w++) {
    const n = newsIn(company, w);
    if (!n || n.at > t) continue;
    const since = t - n.at;
    sum += (n.good ? n.size : -n.size) * Math.min(1, since / NEWS_RISE) * Math.exp(-since / NEWS_FADE);
  }
  return sum;
}

// The moment prices are worked out for: prices stay put from tick to tick.
const tickOf = (t) => Math.floor(t / TICK_MS) * TICK_MS;

// What a company's share is worth at time t (milliseconds, as Date.now()), not
// yet rounded to coins. 0 for no such company.
export function priceAt(key, t) {
  const c = companyOf(key);
  if (!c) return 0;
  const at = tickOf(t);
  const pushed = (waves(seeds.get(key), at, WOBBLES) + newsPush(c, at)) * KINDS[c.kind].swing + waves(MOOD_SEED, at, MOODS);
  return c.base * Math.exp(FARTHEST * Math.tanh(pushed / FARTHEST));
}

// A company's prices in whole coins at time t: the price, what a share costs to
// buy and what it brings when sold. You always buy for more than you sell for.
// To make money, a company's real price has to go up by more than the gap
// between them, however the rounding falls.
export function quote(key, t) {
  const p = priceAt(key, t);
  if (!p) return null;
  const sell = Math.max(1, Math.round(p * (1 - SPREAD)));
  return { price: Math.max(1, Math.round(p)), buy: Math.max(sell + 1, Math.round(p * (1 + SPREAD))), sell };
}

// How a company has done over the last day, at time t, as a share of its price
// then: 0.02 for 2% up.
export const dayChange = (key, t) => {
  const was = priceAt(key, t - DAY);
  return was ? priceAt(key, t) / was - 1 : 0;
};

// The Kids World Index: how all the companies are doing together, 100 being
// usual.
export const indexAt = (t) => (100 * COMPANIES.reduce((sum, c) => sum + priceAt(c.key, t) / c.base, 0)) / COMPANIES.length;

// What the market has been like over the last day, as a bull throws things up
// on its horns and a bear swipes them down: a bull market when prices are mostly
// going up, a bear market when they are mostly going down. change: of the index.
const MOOD_LINE = 0.015;
export function moodAt(t) {
  const change = indexAt(t) / indexAt(t - DAY) - 1;
  if (change > MOOD_LINE) return { key: 'bull', icon: '🐂', name: 'Bull market', text: 'Most prices have been going up.', change };
  if (change < -MOOD_LINE) return { key: 'bear', icon: '🐻', name: 'Bear market', text: 'Most prices have been going down.', change };
  return { key: 'calm', icon: '😴', name: 'A quiet market', text: 'Prices have not gone anywhere much.', change };
}

// The prices from `span` ago up to t, `points` of them with the last at t: for
// charts. Each is { t, price }, the price not rounded.
export function history(key, t, span, points = 60) {
  const out = [];
  for (let i = 0; i < points; i++) {
    const at = t - span + (span * i) / (points - 1);
    out.push({ t: at, price: priceAt(key, at) });
  }
  return out;
}

// The news from time `from` up to t, the latest first (key: of that company
// only): each { key, at, good, size, text }, and none from after t.
export function newsBetween(from, t, key = null) {
  const out = [];
  for (const c of key ? [companyOf(key)].filter(Boolean) : COMPANIES) {
    for (let w = Math.floor(from / NEWS_EVERY); w <= Math.floor(t / NEWS_EVERY); w++) {
      const n = newsIn(c, w);
      if (n && n.at > from && n.at <= t) out.push(n);
    }
  }
  return out.sort((a, b) => b.at - a.at);
}

// ---------------------------------------------------------------- what you own

// What you own as kept: only companies there are, whole numbers, never silly.
// A share cannot have cost less than nothing, or a silly lot.
export function cleanStocks(raw) {
  const out = {};
  if (!raw || typeof raw !== 'object') return out;
  for (const c of COMPANIES) {
    const h = raw[c.key];
    const n = h?.n;
    if (!Number.isInteger(n) || n < 1) continue;
    const count = Math.min(SHARES_MAX, n);
    out[c.key] = { n: count, paid: Number.isInteger(h.paid) && h.paid > 0 ? Math.min(h.paid, count * c.base * 100) : 0 };
  }
  return out;
}

// The market day you were last paid for, as kept.
export const cleanDivDay = (n) => (Number.isInteger(n) && n > 0 ? n : 0);

// What two lots of shares come to, for a guest's progress joining a login.
export function addStocks(a, b) {
  const out = cleanStocks(a);
  for (const [key, h] of Object.entries(cleanStocks(b))) {
    const had = out[key] ?? { n: 0, paid: 0 };
    out[key] = { n: had.n + h.n, paid: had.paid + h.paid };
  }
  return cleanStocks(out);
}

// How many companies you own shares of.
export const companiesHeld = (stocks) => Object.keys(stocks ?? {}).length;

// How much all your shares would sell for at time t, and what they cost you.
export function worth(stocks, t) {
  let value = 0;
  let paid = 0;
  for (const [key, h] of Object.entries(stocks ?? {})) {
    const q = quote(key, t);
    if (!q) continue;
    value += q.sell * h.n;
    paid += h.paid;
  }
  return { value, paid, gain: value - paid };
}

// How many shares of a company your coins buy at time t, and you have room for.
export function canBuy(stocks, key, coins, t) {
  const q = quote(key, t);
  if (!q) return 0;
  return Math.max(0, Math.min(Math.floor(coins / q.buy), SHARES_MAX - (stocks?.[key]?.n ?? 0)));
}

// Buying n shares at time t: { stocks, n, cost }, or null when it cannot be
// done (no such company, not enough coins, not a whole number, or no room).
export function buying(stocks, key, n, coins, t) {
  const q = quote(key, t);
  if (!q || !Number.isInteger(n) || n < 1 || n > canBuy(stocks, key, coins, t)) return null;
  const cost = q.buy * n;
  const had = stocks?.[key] ?? { n: 0, paid: 0 };
  return { stocks: { ...stocks, [key]: { n: had.n + n, paid: had.paid + cost } }, n, cost };
}

// Selling n shares at time t: { stocks, n, coins, profit }, the profit (below 0
// for a loss) against what those shares cost you, your average price for them;
// or null when it cannot be done.
export function selling(stocks, key, n, t) {
  const q = quote(key, t);
  const had = stocks?.[key];
  if (!q || !had || !Number.isInteger(n) || n < 1 || n > had.n) return null;
  const coins = q.sell * n;
  const part = n === had.n ? had.paid : Math.round((had.paid * n) / had.n);
  const out = { ...stocks };
  if (n === had.n) delete out[key];
  else out[key] = { n: had.n - n, paid: had.paid - part };
  return { stocks: out, n, coins, profit: coins - part };
}

// ---------------------------------------------------------------- dividends

// The most days of dividends that wait for you: come back at least once a week.
export const DIVIDEND_DAYS = 7;

// What n shares of a company pay a day: a share of its usual price, and at
// least a coin for owning any at all, if it pays anything (0 for a wild one).
export function dividendOf(key, n) {
  const c = companyOf(key);
  const pays = c ? KINDS[c.kind].pays : 0;
  if (!pays || !Number.isInteger(n) || n < 1) return 0;
  return Math.max(1, Math.round(n * c.base * pays));
}

// What all your shares pay a day.
export const dividendsPerDay = (stocks) => Object.entries(stocks ?? {}).reduce((sum, [key, h]) => sum + dividendOf(key, h.n), 0);

// The dividends owed at market day `today`, for shares as they are now, when
// you were last paid for `last` (0: never): { coins, days }. Shares only start
// paying from the day after you were last paid, so buying just to be paid gets
// you nothing for the days before.
export function dividendsDue(stocks, last, today) {
  const days = last > 0 ? Math.min(DIVIDEND_DAYS, Math.max(0, today - last)) : 0;
  return { days, coins: days * dividendsPerDay(stocks) };
}

// ---------------------------------------------------------------- the furniture

export const isTerminal = (id) => BLOCKS[id]?.model === 'stock-terminal';
export const isTicker = (id) => BLOCKS[id]?.model === 'stock-ticker';

// The Stock Terminal beside a body standing in reach of its cell, or null.
export const terminalNear = (world, body, reach = 2.2) => cellNear(world, body, (id) => (isTerminal(id) ? {} : null), reach);
