// Grow Island (grow.js): an island that starts as open sea without a single
// block of land, where land is bought one block at a time, everything from
// the toy box costs its own price and goes down one at a time, and whose
// world grows round its land for as long as anyone keeps buying.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as B from '../public/js/shared/blocks.js';
import { ANIMAL_TYPES, VEHICLES } from '../public/js/shared/critters.js';
import { blockPrice, editPrice, friendPrice, isLand, LAND_PRICE_MAX, landCount, landPrice, MAX_AREA, MAX_SIDE, START, STEP } from '../public/js/shared/grow.js';
import { PROTOCOL, Room } from '../public/js/shared/room.js';
import { normalizeMeta, World } from '../public/js/shared/world.js';
import { generate, THEMES } from '../public/js/shared/worldgen.js';

function conn() {
  const c = { inbox: [] };
  c.send = (text) => c.inbox.push(JSON.parse(text));
  c.close = () => {};
  c.last = (t) => [...c.inbox].reverse().find((m) => m.t === t);
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

const buy = (room, c, x, z) => room.receive(c, { t: 'land', x, z, price: landPrice(landCount(room.world)) });
const MID = (START * STEP) / 2;
const byKey = (tab, key) => B.blocksIn(tab).find((id) => B.block(id).key === key);

test('a Grow Island starts as open sea: not one block of land, and nobody else on it', () => {
  assert.ok(THEMES.some((t) => t.key === 'grow'), 'a choice in Make an island');
  for (const size of ['small', 'huge']) {
    const { world, critters } = generate({ seed: 7, theme: 'grow', size });
    assert.equal(world.W, START * STEP, 'the same small sea, whatever the size');
    assert.equal(landCount(world), 0);
    assert.ok(world.blocks.every((id) => id === B.AIR || id === B.WATER), 'only sea, water right down');
    assert.equal(critters.length, 0, 'no animals or vehicles: they cost coins here too');
  }
});

test('land costs more as there is more of it, but never more than a purse holds', () => {
  assert.equal(landPrice(0), 1);
  assert.equal(landPrice(99), 1);
  assert.equal(landPrice(100), 2);
  for (let n = 1; n < 5000; n++) assert.ok(landPrice(n) >= landPrice(n - 1));
  assert.equal(landPrice(1e7), LAND_PRICE_MAX);
});

test('everything in the toy box has a price, the cleverer things more', () => {
  for (const c of B.CATEGORIES) for (const id of B.blocksIn(c.key)) assert.ok(blockPrice(id) >= 1, B.block(id).name);
  for (const type of [...ANIMAL_TYPES, ...VEHICLES, 'dragon']) assert.ok(friendPrice(type) >= 10, type);
  assert.equal(blockPrice(B.TOY_BRICKS[0]), 1);
  assert.ok(blockPrice(byKey('home', 'grand-piano')) > blockPrice(byKey('home', 'chair')));
  assert.ok(friendPrice('dragon') > friendPrice('pony') && friendPrice('pony') > friendPrice('bunny'));
  // A thing costs its price once, however many blocks it takes up; paint a coin a block.
  const w = new World({ W: 16, D: 16, H: 16, sea: 4 });
  const door = byKey('building', 'door-oak');
  assert.equal(editPrice(w, 'build', [1, 5, 1, door, 1, 6, 1, door]), blockPrice(door));
  assert.equal(editPrice(w, 'paint', [1, 5, 1, B.TOY_BRICKS[0], 2, 5, 1, B.TOY_BRICKS[0]]), 2);
  assert.equal(editPrice(w, 'pick', [1, 5, 1, B.AIR]), 0);
});

test('the first block of land goes anywhere, each after it beside the land there is', () => {
  const room = makeRoom();
  const a = join(room);
  buy(room, a, MID, MID);
  const w = room.world;
  const heard = a.last('land');
  assert.deepEqual([heard.x, heard.z, heard.price, heard.by], [MID, MID, 1, 1]);
  assert.equal(w.get(MID, w.sea + 1, MID), B.GRASS, 'grass one block over the sea');
  assert.equal(w.get(MID, w.sea, MID), B.DIRT);
  assert.equal(w.get(MID, 2, MID), B.STONE);
  assert.ok(isLand(w, MID, MID));
  assert.equal(w.get(MID + 1, w.sea + 1, MID), B.AIR, 'one block, not a plot');
  assert.equal(Math.floor(w.spawn.x), MID, 'everyone arrives on the land from now on');
  // Owned, far off (even corner to corner), or past the edge: no.
  for (const [x, z] of [
    [MID, MID],
    [MID + 2, MID],
    [MID + 1, MID + 1],
    [-1, MID],
  ]) {
    buy(room, a, x, z);
    assert.equal(landCount(room.world), 1, `${x},${z} is not for sale`);
  }
  buy(room, a, MID + 1, MID);
  buy(room, a, MID + 1, MID + 1);
  assert.equal(landCount(room.world), 3);
});

test('land near the edge grows the sea round it, moving everything with it', () => {
  const room = makeRoom();
  const a = join(room);
  buy(room, a, MID, MID);
  const w0 = room.world;
  // Something built on the land, and the player standing on it.
  const at = [MID, w0.sea + 2, MID];
  room.receive(a, { t: 'edit', seq: 1, kind: 'build', cells: [...at, B.PLANKS] });
  assert.equal(w0.get(...at), B.PLANKS);
  room.players.get(1).s = [MID + 0.5, w0.sea + 3, MID + 0.5, 0, 0, 0];
  a.inbox.length = 0;
  // West, until there is no more open sea that way: then the world grows.
  let x = MID;
  while (room.world === w0) buy(room, a, --x, MID);
  const w = room.world;
  const dx = w.W - w0.W;
  assert.ok(dx >= STEP, 'the world grew');
  assert.equal(w.D, w0.D, 'only the way the land went');
  const welcome = a.last('welcome');
  assert.deepEqual(welcome.shift, [dx, 0], 'everyone is welcomed to it again, told how far it moved');
  assert.equal(welcome.meta.W, w.W);
  assert.equal(w.get(at[0] + dx, at[1], at[2]), B.PLANKS, 'what was built moved east with the land');
  assert.equal(room.players.get(1).s[0], MID + 0.5 + dx, 'and so did the player');
  const heard = a.last('land');
  assert.equal(heard.x, x + dx, 'the new block, where it is now');
  assert.ok(a.inbox.indexOf(welcome) < a.inbox.indexOf(heard), 'the new world first, then the news of the land');
  assert.equal(landCount(w), MID - x + 1);
  for (let lx = x + dx; lx <= MID + dx; lx++) assert.ok(isLand(w, lx, MID), `land at ${lx}`);
  assert.ok(x + dx >= STEP, 'open sea round it again');
});

test('there is no last block of land: it goes on growing as far as anyone buys', () => {
  const room = makeRoom();
  const a = join(room);
  // A long road of land east, a thousand blocks: longer than any other
  // island is wide.
  let x = MID;
  buy(room, a, x, MID);
  for (let i = 0; i < 1000; i++) buy(room, a, ++x, MID);
  const w = room.world;
  assert.equal(landCount(w), 1001);
  assert.ok(w.W >= 1001 + 2 * STEP && w.W <= MAX_SIDE && w.W * w.D <= MAX_AREA);
});

test('blocks go down one at a time, and only on land bought', () => {
  const room = makeRoom();
  const a = join(room);
  buy(room, a, MID, MID);
  const w = room.world;
  const sea = [5, w.sea + 1, 5];
  room.receive(a, { t: 'edit', seq: 1, kind: 'build', cells: [...sea, B.PLANKS] });
  assert.equal(w.get(...sea), B.AIR, 'not on the open sea');
  assert.match(a.last('notice').text, /Buy the land/);
  const land = [MID, w.sea + 2, MID];
  room.receive(a, { t: 'edit', seq: 2, kind: 'stamp', cells: [...land, B.PLANKS] });
  assert.equal(w.get(...land), B.AIR, 'no stamps');
  assert.match(a.last('notice').text, /one block at a time/);
  room.receive(a, { t: 'edit', seq: 3, kind: 'build', cells: [...land, B.PLANKS] });
  assert.equal(w.get(...land), B.PLANKS);
});

test('a Grow Island keeps its land and its size when saved and opened again', () => {
  const room = makeRoom();
  const a = join(room);
  buy(room, a, MID, MID);
  buy(room, a, MID - 1, MID);
  const save = JSON.parse(JSON.stringify(room.exportSave()));
  const again = new Room({ code: '123456', save });
  assert.equal(again.world.theme, 'grow');
  assert.equal(again.world.W, room.world.W);
  assert.equal(landCount(again.world), 2);
  assert.ok(isLand(again.world, MID - 1, MID));
  const copy = World.decode(save.meta, save.blocks);
  assert.equal(landCount(copy), 2, 'a page sees it the same');
});

test('a Grow Island from when land came in plots keeps only the plots as land', () => {
  // Its sea had the magic floor under it too.
  const w = new World({ W: 80, D: 80, H: 64, sea: 20, theme: 'grow' });
  for (let col = 0; col < 80 * 80; col++) {
    w.blocks[col * 64] = B.MAGIC_FLOOR;
    w.blocks.fill(B.WATER, col * 64 + 1, col * 64 + 21);
  }
  for (let x = 32; x < 48; x++) for (let z = 32; z < 48; z++) for (let y = 1; y <= 21; y++) w.set(x, y, z, y === 21 ? B.GRASS : B.STONE);
  const save = { app: 'kids-world', kind: 'island', v: 11, meta: { ...w.meta(), land: ['2,2'] }, blocks: w.encode() };
  const room = new Room({ code: '123456', save });
  assert.equal(landCount(room.world), 256);
  assert.ok(isLand(room.world, 40, 40) && !isLand(room.world, 10, 10));
});

test('an island read back keeps its kind (a desert island stayed sunny)', () => {
  assert.equal(normalizeMeta({ theme: 'desert' }).theme, 'desert');
  assert.equal(normalizeMeta({ theme: 'grow', W: MAX_SIDE, D: 40 }).W, MAX_SIDE, 'a Grow Island may be wider than any other');
  assert.equal(normalizeMeta({ theme: 'grow', W: MAX_SIDE, D: 40 }).D, 32, 'whole steps a side');
  assert.equal(normalizeMeta({ theme: 'sunny', W: MAX_SIDE }).W, 128);
});
