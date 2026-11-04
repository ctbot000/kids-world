// A birthday party (blocks.js PARTY_TABLE, BIRTHDAY_CAKE, PRESENT, BALLOONS,
// PARTY_BANNER, and the Birthday Party stamp, a room with all of them in it).
//
// - The cake: 🎂 Sing and everyone near hears Happy Birthday, the candles
//   burning and notes rising. When the song is over 🌬️ Blow! blows them out
//   in a burst of confetti; then 🍰 Eat has a slice, eight in a cake, and
//   before long there is a fresh one with its candles lit.
// - A present: 🎁 Open and its lid flies off, a little toy hops out to say
//   hello, and there are a few coins in it for whoever opened it. A while
//   later it is wrapped up again.
// - Balloons: 🎈 Pop (or a swing at them) pops one, and another floats up.
//
// The island keeps how each is going (Party, run by room.js) and tells
// everyone ('party'), who keep the same on their page (render/terrain.js) to
// draw it and to know what the button beside it does. None of it is saved:
// an island opened again has its cakes whole and its presents wrapped.
import { BLOCKS } from './blocks.js';
import { cellNear, keyOf } from './arcade.js';
import { TOYS } from './gashapon.js';

export const isCake = (id) => BLOCKS[id]?.model === 'birthday-cake';
export const isPresent = (id) => BLOCKS[id]?.model === 'present';
export const isBalloons = (id) => BLOCKS[id]?.model === 'balloons';
export const isBanner = (id) => BLOCKS[id]?.model === 'party-banner';

// How long the song goes (sound.js birthday), and how long after it starts
// the candles wait to be blown out before it all starts over.
export const SONG_MS = 10_500;
export const BLOW_WAIT_MS = 30_000;
export const SLICES = 8;
// A fresh cake: this long after the candles were blown out, or soon after
// its last slice.
export const CAKE_BACK_MS = 60_000;
export const FRESH_MS = 3_000;
// A present is wrapped again this long after it was opened, and another
// balloon floats up this long after one popped.
export const WRAP_MS = 3 * 60_000;
export const BALLOON_BACK_MS = 20_000;
// What can hop out of a present: the commoner capsule toys, to say hello
// (it does not go in your collection: those come from a gashapon).
export const SURPRISES = TOYS.filter((t) => !t.rare);
// The coins in a present, for whoever opened it: 1 to 3. rand: 0 to 1.
export const presentCoins = (rand = Math.random) => 1 + Math.floor(rand() * 3);

// The candles on a cake, one on each slice, in a ring (x, z from its middle,
// in a cell's units), and how high their tips are over its foot.
export const CANDLE_RING = 0.115;
export const CANDLE_TOP = 0.535;
export const candleSpot = (i) => {
  const a = ((i + 0.5) / SLICES) * Math.PI * 2;
  return [Math.sin(a) * CANDLE_RING, Math.cos(a) * CANDLE_RING];
};

// Balloons on their strings, from the middle of their cell: [x, y, z, r],
// up to two blocks high with room above them, inside the cell without.
const TALL_BALLOONS = [
  [-0.17, 1.22, 0.07, 0.2],
  [0.2, 1.44, -0.05, 0.2],
  [0, 1.74, 0.11, 0.2],
];
const SHORT_BALLOONS = [
  [-0.18, 0.46, 0.08, 0.12],
  [0.18, 0.56, -0.06, 0.12],
  [0, 0.76, 0.1, 0.12],
];
export const balloonSpots = (tall) => (tall ? TALL_BALLOONS : SHORT_BALLOONS);
export const BALLOON_COLORS = ['#ef4b5f', '#ffc93c', '#3f9be8', '#45c46e', '#ef6fb0', '#9a6be0'];
// Each cell's three colours, not all the same way round from one to the next.
export const balloonColors = (x, y, z) => {
  const n = BALLOON_COLORS.length;
  const k = (((x * 7 + y * 3 + z * 13) % n) + n) % n;
  return [BALLOON_COLORS[k], BALLOON_COLORS[(k + 2) % n], BALLOON_COLORS[(k + 4) % n]];
};

// What a birthday banner says, two flags a piece, from the left as you face
// it: seven in a row say it all, and a longer row says it again.
export const BANNER_TEXT = 'HAPPY♥BIRTHDAY♥♥';
const DIRS = [
  [1, 0],
  [0, 1],
  [-1, 0],
  [0, -1],
];
// How many pieces of banner hang to the left of the one in cell (x, y, z),
// as you face it, in a row with it: its place along the words.
export function bannerPlace(world, x, y, z) {
  const def = BLOCKS[world.get(x, y, z)];
  if (!isBanner(def?.id)) return 0;
  const [fx, fz] = DIRS[def.front];
  let n = 0;
  while (n < BANNER_TEXT.length) {
    const next = BLOCKS[world.get(x - fz * (n + 1), y, z + fx * (n + 1))];
    if (!isBanner(next?.id) || next.front !== def.front) break;
    n++;
  }
  return n;
}

// How far from a cake you can have your party when sitting at its table, and
// how far the rest of it reaches on your feet.
const SEATED_REACH = 3.4;
const REACH = 2.2;

// What of a party is beside a body, to use: the nearest cake with something
// left to do at it, wrapped present or bunch with a balloon still up. Sitting
// down, only the cake on your table. { x, y, z, kind, key } of its cell, or
// null. A cake on a table is a row above your feet.
export function partyNear(world, body, party, now, seated = false) {
  const pick = (id, x, y, z) => {
    if (isCake(id)) {
      const c = party.cake(keyOf(x, y, z), now);
      return c.phase === 'out' && c.slices === 0 ? null : { kind: 'cake' };
    }
    if (seated) return null;
    if (isPresent(id)) return party.present(keyOf(x, y, z), now) ? null : { kind: 'present' };
    if (isBalloons(id)) return party.balloonsUp(keyOf(x, y, z), now) > 0 ? { kind: 'balloons' } : null;
    return null;
  };
  return cellNear(world, body, pick, seated ? SEATED_REACH : REACH, 1, seated ? 3 : 2);
}

// How every cake, present and bunch of balloons on an island is going: the
// island's own, which answers a tap with what happened (tap), and each page's
// copy, which hears of it (hear). Times are each one's own clock, in ms.
export class Party {
  constructor() {
    // By cell key: { phase: 'song', at } or { phase: 'out', at, slices, ate }.
    this.cakes = new Map();
    // By cell key: { at, toy } of one opened.
    this.presents = new Map();
    // By cell key: when each balloon there popped, 0 for one that is up.
    this.balloons = new Map();
  }

  // How a cake is going: { phase, at, slices }, its phase 'lit' with nothing
  // going on, 'song' while it is sung, 'blow' once it has been, for its
  // candles to be blown out, and 'out' once they are, with `slices` left.
  cake(key, now) {
    const c = this.cakes.get(key);
    if (c?.phase === 'song' && now - c.at < BLOW_WAIT_MS) return { phase: now - c.at < SONG_MS ? 'song' : 'blow', at: c.at, slices: SLICES };
    if (c?.phase === 'out' && now - c.at < CAKE_BACK_MS && (c.slices > 0 || now - c.ate < FRESH_MS)) return { phase: 'out', at: c.at, slices: c.slices };
    if (c) this.cakes.delete(key);
    return { phase: 'lit', at: 0, slices: SLICES };
  }

  // A present still open: { at, toy }, or null once it is wrapped.
  present(key, now) {
    const p = this.presents.get(key);
    if (!p) return null;
    if (now - p.at < WRAP_MS) return p;
    this.presents.delete(key);
    return null;
  }

  // Whether balloon i of a bunch is up.
  balloonUp(key, i, now) {
    const t = this.balloons.get(key)?.[i];
    return !t || now - t >= BALLOON_BACK_MS;
  }

  // How many of a bunch's balloons are up.
  balloonsUp(key, now) {
    let n = 0;
    for (let i = 0; i < 3; i++) if (this.balloonUp(key, i, now)) n++;
    return n;
  }

  // Someone used what is in a cell with block `id`: what happened, for
  // everyone to hear ({ op, ... }), or null for nothing. rand: 0 to 1.
  tap(id, key, now, rand = Math.random) {
    let news = null;
    if (isCake(id)) {
      const { phase, slices } = this.cake(key, now);
      news = phase === 'lit' ? { op: 'sing' } : phase === 'out' ? (slices > 0 ? { op: 'eat', slices: slices - 1 } : null) : { op: 'blow' };
    } else if (isPresent(id)) {
      if (!this.present(key, now)) news = { op: 'open', toy: Math.floor(rand() * SURPRISES.length) };
    } else if (isBalloons(id)) {
      const i = [0, 1, 2].find((b) => this.balloonUp(key, b, now));
      if (i !== undefined) news = { op: 'pop', i };
    }
    if (news) this.hear(key, news, now);
    return news;
  }

  // What someone did, as the island told it.
  hear(key, news, now) {
    switch (news.op) {
      case 'sing':
        this.cakes.set(key, { phase: 'song', at: now });
        break;
      case 'blow':
        this.cakes.set(key, { phase: 'out', at: now, slices: SLICES, ate: 0 });
        break;
      case 'eat': {
        const c = this.cakes.get(key);
        const slices = Number.isInteger(news.slices) ? Math.min(SLICES, Math.max(0, news.slices)) : 0;
        this.cakes.set(key, { phase: 'out', at: c?.phase === 'out' ? c.at : now, slices, ate: now });
        break;
      }
      case 'open':
        this.presents.set(key, { at: now, toy: Number.isInteger(news.toy) && news.toy >= 0 ? news.toy % SURPRISES.length : 0 });
        break;
      case 'pop': {
        if (![0, 1, 2].includes(news.i)) break;
        const b = this.balloons.get(key) ?? [0, 0, 0];
        b[news.i] = now || 1;
        this.balloons.set(key, b);
        break;
      }
    }
  }
}
