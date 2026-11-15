// Grow Island (grow.js): an island that starts as open sea without a single
// block of land, where every plot of land and every block costs coins, and
// whose world grows round its land for as long as anyone keeps buying.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as B from '../public/js/shared/blocks.js';
import { BLOCK_PRICE, LAND_PRICE_MAX, landPrice, MARGIN, MAX_AREA, MAX_SIDE, onLand, PLOT, plotKey, START } from '../public/js/shared/grow.js';
import { PROTOCOL, Room } from '../public/js/shared/room.js';
import { normalizeMeta, World } from '../public/js/shared/world.js';
import { generate, THEMES } from '../public/js/shared/worldgen.js';

function conn() {
  const c = { inbox: [] };
  c.send = (text) => c.inbox.push(JSON.parse(text));
  c.close = () => {};
  c.last = (t) => [...c.inbox].reverse().find((m) => m.t === t);
  c.all = (t) => c.inbox.filter((m) => m.t === t);
  return c;
}

// The clock moves on a second each time anything is asked of the island,
// so nobody is ever told to slow down.
function makeRoom() {
  let t = 1_000_000;
  let seed = 1;
  const random = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  return new Room({ code: '123456', theme: 'grow', name: 'Seedling Isle', seed: 42, now: () => (t += 1000), random });
}

function join(room, name = 'Happy Panda') {
  const c = conn();
  room.attach(c);
  room.receive(c, { t: 'join', protocol: PROTOCOL, name, look: { animal: 'cat', fur: 'orange', shirt: 3, hat: 'cap' } });
  return c;
}

const buy = (room, c, px, pz) => room.receive(c, { t: 'land', px, pz, price: landPrice(room.world.land.size) });
const count = (world, test) => world.blocks.reduce((n, id) => n + (test(id) ? 1 : 0), 0);

test('a Grow Island starts as open sea: not one block of land, and nobody else on it', () => {
  assert.ok(THEMES.some((t) => t.key === 'grow'), 'a choice in Make an island');
  for (const size of ['small', 'huge']) {
    const { world, critters } = generate({ seed: 7, theme: 'grow', size });
    assert.equal(world.W, START * PLOT, 'the same small sea, whatever the size');
    assert.equal(world.land.size, 0);
    assert.equal(count(world, (id) => id !== B.AIR && id !== B.WATER && id !== B.MAGIC_FLOOR), 0, 'only sea');
    assert.equal(critters.length, 0, 'no animals or vehicles: they cost coins here too');
  }
});

test('every plot costs more than the last, but never more than a purse holds', () => {
  assert.equal(landPrice(0), 10);
  for (let n = 1; n < 2000; n++) assert.ok(landPrice(n) >= landPrice(n - 1));
  assert.equal(landPrice(1e6), LAND_PRICE_MAX);
  assert.ok(LAND_PRICE_MAX < 99999);
});

test('the first plot goes anywhere, each after it beside the land there is', () => {
  const room = makeRoom();
  const a = join(room);
  const mid = Math.floor(START / 2);
  buy(room, a, mid, mid);
  const w = room.world;
  const heard = a.last('land');
  assert.deepEqual([heard.px, heard.pz, heard.price, heard.by], [mid, mid, 10, 1]);
  const x = mid * PLOT + 3;
  const z = mid * PLOT + 9;
  assert.equal(w.get(x, w.sea + 1, z), B.GRASS, 'grass one block over the sea');
  assert.equal(w.get(x, w.sea, z), B.DIRT);
  assert.equal(w.get(x, 2, z), B.STONE);
  assert.ok(onLand(w, x, z));
  assert.equal(Math.floor(w.spawn.x / PLOT), mid, 'everyone arrives on the land from now on');
  // Owned, far off, past the edge, or at an old price: no.
  for (const [px, pz] of [
    [mid, mid],
    [mid + 2, mid],
    [-1, mid],
  ]) {
    const before = w.land.size;
    buy(room, a, px, pz);
    assert.equal(room.world.land.size, before, `${px},${pz} is not for sale`);
  }
  room.receive(a, { t: 'land', px: mid + 1, pz: mid, price: 10 });
  assert.equal(room.world.land.size, 1, 'the second plot costs more than the first');
  buy(room, a, mid + 1, mid);
  assert.equal(room.world.land.size, 2);
  assert.equal(a.last('land').price, 15);
});

test('land near the edge grows the sea round it, moving everything with it', () => {
  const room = makeRoom();
  const a = join(room);
  const mid = Math.floor(START / 2);
  buy(room, a, mid, mid);
  const w0 = room.world;
  // Something built on the first plot, and the player standing on it.
  const at = [mid * PLOT + 4, w0.sea + 2, mid * PLOT + 4];
  room.receive(a, { t: 'edit', seq: 1, kind: 'build', cells: [...at, B.PLANKS] });
  assert.equal(w0.get(...at), B.PLANKS);
  room.players.get(1).s = [at[0] + 0.5, at[1] + 1, at[2] + 0.5, 0, 0, 0];
  a.inbox.length = 0;
  // West, past the margin of sea: the world grows west and north is as it was.
  buy(room, a, mid - 1, mid);
  const w = room.world;
  assert.notEqual(w, w0);
  const dx = w.W - w0.W;
  assert.ok(dx >= PLOT, 'the world grew');
  assert.equal(w.D, w0.D, 'only the way the land went');
  const welcome = a.last('welcome');
  assert.deepEqual(welcome.shift, [dx, 0], 'everyone is welcomed to it again, told how far it moved');
  assert.equal(welcome.meta.W, w.W);
  assert.equal(w.get(at[0] + dx, at[1], at[2]), B.PLANKS, 'what was built moved east with the land');
  assert.equal(room.players.get(1).s[0], at[0] + 0.5 + dx, 'and so did the player');
  const heard = a.last('land');
  assert.equal(heard.px, mid - 1 + dx / PLOT, 'the new plot, where it is now');
  assert.deepEqual(new Set(heard.land), new Set([plotKey(mid + dx / PLOT, mid), plotKey(mid - 1 + dx / PLOT, mid)]));
  assert.ok(a.inbox.indexOf(welcome) < a.inbox.indexOf(heard), 'the new world first, then the news of the plot');
  // There is always open sea round the land.
  for (const k of w.land) {
    const [px, pz] = k.split(',').map(Number);
    assert.ok(px >= MARGIN && pz >= MARGIN && px < w.W / PLOT - MARGIN && pz < w.D / PLOT - MARGIN, `sea round ${k}`);
  }
});

test('there is no last plot: the land goes on growing as far as anyone buys', () => {
  const room = makeRoom();
  const a = join(room);
  let px = Math.floor(START / 2);
  const pz = px;
  buy(room, a, px, pz);
  // A hundred and twenty plots east, then forty west of the first one:
  // longer than any other island is wide.
  for (let i = 0; i < 120; i++) buy(room, a, ++px, pz);
  const k0 = [...room.world.land][0];
  let west = Number(k0.split(',')[0]);
  for (let i = 0; i < 40; i++) {
    buy(room, a, --west, pz);
    west = Math.min(...[...room.world.land].map((k) => Number(k.split(',')[0])));
  }
  const w = room.world;
  assert.equal(w.land.size, 161);
  assert.ok(w.W >= 161 * PLOT + 2 * MARGIN * PLOT && w.W <= MAX_SIDE && w.W * w.D <= MAX_AREA);
  // Every plot is land, all in one row.
  for (const k of w.land) {
    const [x, z] = k.split(',').map((n) => Number(n) * PLOT + 8);
    assert.equal(w.get(x, w.sea + 1, z), B.GRASS, k);
  }
});

test('blocks go down only on land bought', () => {
  const room = makeRoom();
  const a = join(room);
  buy(room, a, 2, 2);
  const w = room.world;
  const sea = [5, w.sea + 1, 5];
  room.receive(a, { t: 'edit', seq: 1, kind: 'build', cells: [...sea, B.PLANKS] });
  assert.equal(w.get(...sea), B.AIR, 'not on the open sea');
  assert.match(a.last('notice').text, /Buy the land/);
  const land = [2 * PLOT + 1, w.sea + 2, 2 * PLOT + 1];
  room.receive(a, { t: 'edit', seq: 2, kind: 'build', cells: [...land, B.PLANKS] });
  assert.equal(w.get(...land), B.PLANKS);
  assert.equal(BLOCK_PRICE, 1);
});

test('a Grow Island keeps its land and its size when saved and opened again', () => {
  const room = makeRoom();
  const a = join(room);
  buy(room, a, 2, 2);
  buy(room, a, 1, 2);
  const save = JSON.parse(JSON.stringify(room.exportSave()));
  const again = new Room({ code: '123456', save });
  assert.equal(again.world.theme, 'grow');
  assert.equal(again.world.W, room.world.W);
  assert.deepEqual(new Set(again.world.land), new Set(room.world.land));
  const copy = World.decode(save.meta, save.blocks);
  assert.deepEqual(new Set(copy.land), new Set(room.world.land), 'a page sees it the same');
});

test('an island read back keeps its kind (a desert island stayed sunny)', () => {
  assert.equal(normalizeMeta({ theme: 'desert' }).theme, 'desert');
  assert.equal(normalizeMeta({ theme: 'grow', W: MAX_SIDE, D: 40 }).W, MAX_SIDE, 'a Grow Island may be wider than any other');
  assert.equal(normalizeMeta({ theme: 'grow', W: MAX_SIDE, D: 40 }).D, 32, 'whole plots a side');
  assert.equal(normalizeMeta({ theme: 'sunny', W: MAX_SIDE }).W, 128);
  assert.deepEqual(normalizeMeta({ theme: 'grow', W: 64, D: 64, land: ['1,2', '9,9', 'x', '1,2'] }).land, ['1,2']);
});
