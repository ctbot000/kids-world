// Farming: farmland (turned over by planting on grass, or put down from the
// toy box), six crops that grow a stage at a time on the host — twice as
// fast on farmland the watering can, the rain or water close by has
// watered, which dries out again after a while — and ripe ones picked into
// the basket, two at a time, some growing back. Vegetables are planted from
// the basket like fruit, sold at the shop (which sells packs of them to
// start with), and given to animals; the stickers and XP, the Vegetable
// Patch stamp, the fence and scarecrow, and how crops are drawn.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as B from '../public/js/shared/blocks.js';
import { furnitureBoxes } from '../public/js/shared/furniture.js';
import { LightMap } from '../public/js/shared/light.js';
import { progressOf, XP_FOR } from '../public/js/shared/levels.js';
import { PROTOCOL, Room } from '../public/js/shared/room.js';
import { SEED_PACK, SEED_PRICES, seedPrice, sellPrice } from '../public/js/shared/shop.js';
import { stampByKey } from '../public/js/shared/stamps.js';
import { STAT_KEYS, STICKERS } from '../public/js/shared/stickers.js';
import { buildEdit, harvestEdit, pickEdit, stampEdit, waterEdit } from '../public/js/shared/tools.js';
import { World } from '../public/js/shared/world.js';
import { GOURDS, meshChunk } from '../public/js/render/mesher.js';

const [CARROT, STRAWBERRY, , CORN, PUMPKIN] = B.CROP_STAGES;

function clock(start = 1_000_000) {
  const c = { t: start };
  c.now = () => c.t;
  c.advance = (ms) => (c.t += ms);
  return c;
}

function conn() {
  const c = { inbox: [] };
  c.send = (text) => c.inbox.push(JSON.parse(text));
  c.close = () => {};
  c.last = (t) => [...c.inbox].reverse().find((m) => m.t === t);
  c.all = (t) => c.inbox.filter((m) => m.t === t);
  return c;
}

function join(room) {
  const c = conn();
  room.attach(c);
  room.receive(c, { t: 'join', protocol: PROTOCOL, name: 'Happy Panda', look: { animal: 'bunny', fur: 'white', shirt: 3, hat: 'none' } });
  return c;
}

// A flat meadow: grass at y 10 everywhere, with the start in the middle.
function meadow(W = 48) {
  const w = new World({ W, H: 32, D: W, sea: 4, theme: 'flat', spawn: { x: W / 2 + 0.5, y: 11, z: W / 2 + 0.5 } });
  for (let x = 0; x < W; x++) for (let z = 0; z < W; z++) for (let y = 0; y <= 10; y++) w.set(x, y, z, y === 10 ? B.GRASS : B.DIRT);
  return w;
}

// A room on the meadow whose random is always a half: every crop takes its
// crop's `stage` seconds a stage on watered farmland, twice that on dry, and
// watered farmland dries out five minutes after nothing waters it. The
// weather stays as set.
function farm() {
  const time = clock();
  const room = new Room({ code: '123456', theme: 'flat', seed: 7, now: time.now, random: () => 0.5 });
  room.world = meadow();
  room.hookWorld();
  room.env.left = Infinity;
  const tick = (secs) => {
    for (let i = 0; i < secs; i++) {
      time.advance(1000);
      room.tick();
    }
  };
  return { room, time, tick, w: room.world };
}

const hitAt = (x, y, z, w) => ({ x, y, z, nx: 0, ny: 1, nz: 0, id: w.get(x, y, z) });

test('six crops, each four blocks — planted, sprouting, growing and ripe — and only a ripe one gives its vegetable', () => {
  assert.equal(B.CROPS.length, 6);
  for (const [i, crop] of B.CROPS.entries()) {
    const stages = B.CROP_STAGES[i];
    assert.equal(stages.length, 4);
    stages.forEach((id, s) => {
      assert.equal(B.KIND[id], B.K_PLANT, `${crop.key} ${s} is a plant`);
      assert.equal(B.cropOf(id), crop);
      assert.equal(B.STAGE_OF[id], s);
      assert.equal(B.block(id).collect, s === B.RIPE ? crop.key : null);
      assert.equal(B.block(id).category, null, 'never in the toy box: vegetables are planted from the basket');
    });
    assert.ok(B.isRipe(stages[3]) && !B.isRipe(stages[2]));
    assert.ok(crop.gives >= 2, `${crop.key}: a ripe one gives more than was planted`);
    // In the basket, planted as its first stage, and something animals eat.
    const c = B.COLLECTABLES.find((x) => x.key === crop.key);
    assert.equal(c.sprout, stages[0]);
    assert.equal(B.block(c.item).collect, crop.key);
    assert.equal(B.KIND[c.item], B.K_ITEM);
    assert.ok(B.isFood(crop.key));
  }
  assert.ok(B.isFood('apple') && !B.isFood('shell') && !B.isFood('diamond'));
});

test('the toy box has a Farm tab: farmland, the watering can, a scarecrow and a fence', () => {
  assert.ok(B.CATEGORIES.some((c) => c.key === 'farm'));
  assert.deepEqual(B.blocksIn('farm'), [B.FARMLAND, B.WATERING_CAN, B.SCARECROW, B.FENCE]);
  assert.equal(B.block(B.WET_FARMLAND).category, null, 'watered farmland is what watering makes');
  for (const id of [B.FARMLAND, B.WET_FARMLAND]) {
    assert.ok(B.SOLID[id] && B.TERRAIN[id], 'farmland is ground: stood on, and shaped by the hills tool');
    assert.equal(B.underOf(id), B.DIRT);
  }
  assert.ok(B.block(B.FENCE).solid && !B.block(B.FENCE).turns);
  assert.ok(B.block(B.SCARECROW).turns);
});

test('a vegetable planted on grass turns the ground over into farmland; on farmland it just goes in', () => {
  const w = meadow();
  const plan = buildEdit(w, hitAt(10, 10, 10, w), CARROT[0]);
  assert.deepEqual(plan.cells, [10, 10, 10, B.FARMLAND, 10, 11, 10, CARROT[0]]);
  w.set(12, 10, 10, B.WET_FARMLAND);
  assert.deepEqual(buildEdit(w, hitAt(12, 10, 10, w), CARROT[0]).cells, [12, 11, 10, CARROT[0]]);
  // Snow, dirt, frosting and basalt turn over too; sand, stone and bricks never do.
  for (const ground of [B.SNOW, B.DIRT, B.FROSTING, B.BASALT]) {
    w.set(14, 10, 10, ground);
    assert.equal(buildEdit(w, hitAt(14, 10, 10, w), STRAWBERRY[0]).cells[3], B.FARMLAND, B.block(ground).name);
  }
  for (const ground of [B.SAND, B.STONE, B.TOY_BRICKS[0], B.PLANKS]) {
    w.set(14, 10, 10, ground);
    assert.deepEqual(buildEdit(w, hitAt(14, 10, 10, w), STRAWBERRY[0]).cells, [], B.block(ground).name);
  }
});

test('a vegetable goes in where a flower or a tuft of grass was, but never where a crop grows already, nor in water', () => {
  const w = meadow();
  w.set(10, 11, 10, B.TALL_GRASS);
  assert.deepEqual(buildEdit(w, hitAt(10, 11, 10, w), CORN[0]).cells, [10, 10, 10, B.FARMLAND, 10, 11, 10, CORN[0]]);
  w.set(12, 10, 12, B.FARMLAND);
  w.set(12, 11, 12, CARROT[2]);
  assert.deepEqual(buildEdit(w, hitAt(12, 11, 12, w), CORN[0]).cells, [], 'a growing carrot stays');
  w.set(14, 11, 14, B.WATER);
  assert.deepEqual(buildEdit(w, { x: 14, y: 11, z: 14, nx: 0, ny: 1, nz: 0, id: B.WATER }, CORN[0]).cells, []);
});

test('a crop needs farmland under it: the farmland gone, it goes too, and a ripe one into the basket', () => {
  const w = meadow();
  w.set(10, 10, 10, B.FARMLAND);
  w.set(10, 11, 10, CARROT[1]);
  w.set(12, 10, 10, B.WET_FARMLAND);
  w.set(12, 11, 10, CARROT[3]);
  const young = pickEdit(w, hitAt(10, 10, 10, w), 1);
  assert.deepEqual(young.cells, [10, 10, 10, B.AIR, 10, 11, 10, B.AIR]);
  assert.deepEqual(young.collected, []);
  const ripe = pickEdit(w, hitAt(12, 10, 10, w), 1);
  assert.deepEqual(ripe.collected, [CARROT[3]], 'one carrot, knocked off');
  // Painted over with another block, farmland holds no crop up either.
  w.set(14, 10, 10, B.FARMLAND);
  w.set(14, 11, 10, CORN[2]);
  w.set(14, 10, 10, B.GRASS);
  assert.deepEqual(buildEdit(w, hitAt(14, 10, 10, w), B.TULIP).cells, [14, 11, 10, B.TULIP], 'its cell takes anything else');
});

test('a ripe crop is picked two at a time: some grow back from a sprout, the rest leave the farmland bare', () => {
  const w = meadow();
  for (const [i, crop] of B.CROPS.entries()) {
    const x = 4 + i * 2;
    w.set(x, 10, 10, B.FARMLAND);
    w.set(x, 11, 10, B.CROP_STAGES[i][3]);
    const plan = harvestEdit(w, hitAt(x, 11, 10, w));
    assert.deepEqual(plan.collected, Array(crop.gives).fill(B.CROP_STAGES[i][3]), `${crop.key}: ${crop.gives} of it`);
    assert.deepEqual(plan.cells, [x, 11, 10, crop.regrows ? B.CROP_STAGES[i][1] : B.AIR], crop.key);
  }
  assert.deepEqual(
    B.CROPS.filter((c) => c.regrows).map((c) => c.key),
    ['strawberry', 'tomato', 'corn'],
  );
  // Nothing comes of an unripe one.
  w.set(20, 10, 20, B.FARMLAND);
  w.set(20, 11, 20, PUMPKIN[2]);
  assert.deepEqual(harvestEdit(w, hitAt(20, 11, 20, w)), { cells: [], collected: [] });
});

test('the watering can waters farmland, from the farmland or what grows in it, a patch at a time with a big brush', () => {
  const w = meadow();
  for (let x = 8; x <= 14; x++) for (let z = 8; z <= 14; z++) w.set(x, 10, z, B.FARMLAND);
  w.set(11, 11, 11, CARROT[1]);
  w.set(12, 10, 11, B.WET_FARMLAND);
  const small = waterEdit(w, hitAt(11, 11, 11, w), 1);
  assert.deepEqual(small.cells, [11, 10, 11, B.WET_FARMLAND], 'tapped at the carrot, its farmland');
  const big = waterEdit(w, hitAt(11, 10, 11, w), 3);
  assert.equal(big.spots.length, 25, 'a five by five patch');
  assert.equal(big.cells.length / 4, 24, 'all but the one watered already');
  assert.ok(big.cells.every((id, i) => i % 4 !== 3 || id === B.WET_FARMLAND));
  // On a slope, a block up or down; never anything but farmland.
  w.set(13, 11, 13, B.FARMLAND);
  w.set(13, 10, 13, B.DIRT);
  assert.ok(waterEdit(w, hitAt(12, 10, 12, w), 2).spots.some(([x, y, z]) => x === 13 && y === 11 && z === 13));
  assert.deepEqual(waterEdit(w, hitAt(30, 10, 30, w), 3), { cells: [], collected: [], spots: [] }, 'grass is not farmland');
});

test('crops grow a stage at a time on the host, twice as fast on watered farmland, and stay ripe', () => {
  const { room, tick, w } = farm();
  const a = join(room);
  room.receive(a, { t: 'edit', seq: 1, kind: 'build', cells: [10, 10, 10, B.WET_FARMLAND, 10, 11, 10, CARROT[0], 14, 10, 10, B.FARMLAND, 14, 11, 10, CARROT[0]] });
  // A carrot's stage is 20 seconds watered, 40 dry.
  tick(19);
  assert.equal(w.get(10, 11, 10), CARROT[0]);
  tick(1);
  assert.equal(w.get(10, 11, 10), CARROT[1], 'watered: a sprout after 20 seconds');
  assert.equal(w.get(14, 11, 10), CARROT[0], 'dry: not yet');
  tick(20);
  assert.equal(w.get(10, 11, 10), CARROT[2]);
  assert.equal(w.get(14, 11, 10), CARROT[1], 'dry: a sprout after 40 seconds');
  tick(20);
  assert.equal(w.get(10, 11, 10), CARROT[3], 'ripe after three stages');
  tick(200);
  assert.equal(w.get(10, 11, 10), CARROT[3], 'and ripe it stays');
  assert.equal(w.get(14, 11, 10), CARROT[3], 'the dry one ripe in twice the time');
  const grew = a.all('edit').filter((m) => m.kind === 'crop');
  // (At 40 seconds, the watered one's second stage and the dry one's first go as one edit.)
  assert.equal(grew.length, 5);
  assert.ok(grew.every((m) => m.by === 0), 'everyone sees them grow, from the island');
});

test('watered later, a crop grows faster from then on; picked, one that grows back starts again from a sprout', () => {
  const { room, tick, w } = farm();
  const a = join(room);
  room.receive(a, { t: 'edit', seq: 1, kind: 'build', cells: [10, 10, 10, B.FARMLAND, 10, 11, 10, STRAWBERRY[0]] });
  // 25 seconds a stage watered: 30 dry seconds in (more than half way), then watered.
  tick(30);
  room.receive(a, { t: 'edit', seq: 2, kind: 'water', cells: [10, 10, 10, B.WET_FARMLAND] });
  tick(10);
  assert.equal(w.get(10, 11, 10), STRAWBERRY[1]);
  tick(50);
  assert.equal(w.get(10, 11, 10), STRAWBERRY[3]);
  room.receive(a, { t: 'edit', seq: 3, kind: 'pick', cells: [10, 11, 10, STRAWBERRY[1]] });
  tick(49);
  assert.equal(w.get(10, 11, 10), STRAWBERRY[2]);
  tick(1);
  assert.equal(w.get(10, 11, 10), STRAWBERRY[3], 'ripe again two stages later');
});

test('watered farmland dries out after a while, unless water is close by; and water close by waters dry farmland', () => {
  const { room, tick, w } = farm();
  const a = join(room);
  room.receive(a, { t: 'edit', seq: 1, kind: 'build', cells: [10, 10, 10, B.WET_FARMLAND, 20, 10, 20, B.WET_FARMLAND, 30, 10, 30, B.FARMLAND] });
  // Water two blocks from one of them, and three from the dry one.
  room.receive(a, { t: 'edit', seq: 2, kind: 'build', cells: [22, 10, 20, B.WATER, 33, 10, 30, B.WATER] });
  tick(290);
  assert.equal(w.get(10, 10, 10), B.WET_FARMLAND, 'wet for a good while');
  tick(20);
  assert.equal(w.get(10, 10, 10), B.FARMLAND, 'dry after five minutes');
  assert.equal(w.get(20, 10, 20), B.WET_FARMLAND, 'kept wet by the water two blocks off');
  assert.equal(w.get(30, 10, 30), B.FARMLAND, 'water three blocks off is too far');
  room.receive(a, { t: 'edit', seq: 3, kind: 'build', cells: [31, 10, 31, B.WATER] });
  tick(7);
  assert.equal(w.get(30, 10, 30), B.WET_FARMLAND, 'and a block of water poured beside it waters it');
  const soaked = a.all('edit').filter((m) => m.kind === 'crop');
  assert.ok(soaked.length >= 2 && soaked.every((m) => m.by === 0));
});

test('the rain waters farmland out under the open sky, and not under a roof; then it dries out again', () => {
  const { room, tick, w } = farm();
  const a = join(room);
  room.receive(a, { t: 'edit', seq: 1, kind: 'build', cells: [10, 10, 10, B.FARMLAND, 10, 11, 10, CORN[1], 20, 10, 20, B.FARMLAND, 20, 14, 20, B.PLANKS] });
  tick(10);
  assert.equal(w.get(10, 10, 10), B.FARMLAND, 'no rain, no water');
  for (const weather of ['rain', 'snow', 'sprinkles']) {
    room.receive(a, { t: 'edit', seq: 2, kind: 'build', cells: [10, 10, 10, B.FARMLAND] });
    room.env.weather = weather;
    tick(7);
    assert.equal(w.get(10, 10, 10), B.WET_FARMLAND, `${weather} waters it, crop and all`);
    assert.equal(w.get(20, 10, 20), B.FARMLAND, `${weather}: under a roof, it stays dry`);
  }
  tick(200);
  assert.equal(w.get(10, 10, 10), B.WET_FARMLAND, 'wet all the while it rains');
  room.env.weather = 'rainbow';
  tick(320);
  assert.equal(w.get(10, 10, 10), B.FARMLAND, 'dry again a while after');
});

test('the host never puts the watering can down, and takes vegetables as food for the animals', () => {
  const { room, w } = farm();
  const a = join(room);
  room.receive(a, { t: 'edit', seq: 1, kind: 'build', cells: [10, 11, 10, B.WATERING_CAN] });
  assert.equal(w.get(10, 11, 10), B.AIR);
  assert.deepEqual(a.last('ack').fix, [10, 11, 10, B.AIR]);
  const me = room.players.get(1).s;
  const bunny = room.critters.add('bunny', me[0] + 1, 11, me[2]);
  room.receive(a, { t: 'critter', op: 'feed', id: bunny.id, fruit: 'carrot' });
  assert.equal(a.last('cfx')?.fx, 'yum', 'a bunny munches a carrot');
  a.inbox.length = 0;
  room.receive(a, { t: 'critter', op: 'feed', id: bunny.id, fruit: 'diamond' });
  assert.equal(a.last('cfx'), undefined, 'but not a diamond');
});

test('crops and watered farmland are kept when the island is saved, and grow on when it is opened again', () => {
  const { room, w } = farm();
  const a = join(room);
  room.receive(a, { t: 'edit', seq: 1, kind: 'build', cells: [10, 10, 10, B.WET_FARMLAND, 10, 11, 10, PUMPKIN[2]] });
  const time = clock(5_000_000);
  const again = new Room({ save: room.exportSave(), now: time.now, random: () => 0.5 });
  again.env.left = Infinity;
  assert.equal(again.world.get(10, 11, 10), PUMPKIN[2]);
  assert.equal(again.world.get(10, 10, 10), B.WET_FARMLAND);
  // A pumpkin's stage is 45 seconds watered.
  for (let i = 0; i < 45; i++) {
    time.advance(1000);
    again.tick();
  }
  assert.equal(again.world.get(10, 11, 10), PUMPKIN[3]);
  assert.equal(w.get(10, 11, 10), PUMPKIN[2], '(the first island never ticked)');
});

test('vegetables sell at the shop, and packs of them to plant cost more than they sell for', () => {
  for (const crop of B.CROPS) {
    assert.ok(sellPrice(crop.key) >= 1, crop.key);
    assert.ok(seedPrice(crop.key) > SEED_PACK * sellPrice(crop.key), `${crop.key}: never bought and sold for a profit`);
  }
  assert.deepEqual(Object.keys(SEED_PRICES).sort(), B.CROPS.map((c) => c.key).sort());
  assert.equal(seedPrice('apple'), 0, 'only vegetables come in packs');
  assert.ok(sellPrice('pumpkin') > sellPrice('carrot'), 'a big slow one is worth more');
});

test('a pack of vegetables is bought through your profile, into the basket', async () => {
  const store = new Map();
  globalThis.localStorage = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k), key: (i) => [...store.keys()][i] ?? null, get length() { return store.size; } };
  try {
    const { Profile } = await import('../public/js/profile.js');
    const p = new Profile();
    assert.equal(p.buySeeds('carrot'), false, 'not without the coins');
    p.earn(20);
    assert.equal(p.buySeeds('apple'), false, 'apples are not sold in packs');
    assert.equal(p.buySeeds('carrot'), true);
    assert.equal(p.basket.carrot, SEED_PACK);
    assert.equal(p.data.coins, 20 - seedPrice('carrot'));
    p.addToBasket('pumpkin', 997);
    p.earn(100);
    assert.equal(p.buySeeds('pumpkin'), false, 'never more than a basket holds');
    assert.equal(new Profile().basket.carrot, SEED_PACK, 'kept on this device');
  } finally {
    delete globalThis.localStorage;
  }
});

test('farming earns XP and three stickers', () => {
  for (const key of ['sown', 'harvested', 'watered']) {
    assert.ok(STAT_KEYS.includes(key), key);
    assert.ok(XP_FOR[key]?.xp > 0, key);
  }
  const stats = Object.fromEntries(STAT_KEYS.map((k) => [k, 0]));
  const sticker = (key) => STICKERS.find((s) => s.key === key);
  assert.ok(!sticker('little-farmer').test(stats));
  assert.ok(sticker('little-farmer').test({ ...stats, harvested: 1 }));
  assert.ok(sticker('splish-splash').test({ ...stats, watered: 1 }));
  assert.ok(!sticker('bumper-crop').test({ ...stats, harvested: 99 }));
  assert.ok(sticker('bumper-crop').test({ ...stats, harvested: 100 }));
  assert.ok(progressOf({ ...stats, harvested: 10 }, {}).xp > progressOf(stats, {}).xp);
});

test('the Vegetable Patch stamp: farmland kept watered by its ditch, a fence all round with a way in, and a scarecrow facing you', () => {
  for (const facing of [0, 1, 2, 3]) {
    const { room, tick, w } = farm();
    const a = join(room);
    const hit = hitAt(24, 10, 16, w);
    const { cells } = stampEdit(w, hit, 'vegetable-patch', facing);
    room.receive(a, { t: 'edit', seq: 1, kind: 'stamp', cells });
    const count = (id) => cells.filter((v, i) => i % 4 === 3 && v === id).length;
    assert.equal(count(B.FARMLAND), 20);
    assert.equal(count(B.FENCE), 25, 'all round the 7 by 8 patch, but the way in');
    assert.equal(count(B.WATER), 4);
    assert.ok(!cells.some((v, i) => i % 4 === 3 && B.CROP_OF[v]), 'nothing grows in it yet');
    const scarecrow = cells.findIndex((v, i) => i % 4 === 3 && B.baseOf(v) === B.SCARECROW);
    assert.equal(B.block(cells[scarecrow]).front, (((3 - facing) % 4) + 4) % 4, 'turned to face whoever stamped it');
    // Its farmland is every bit of it watered by the ditch.
    tick(7);
    let wet = 0;
    for (let i = 0; i < cells.length; i += 4) if (cells[i + 3] === B.FARMLAND) wet += w.get(cells[i], cells[i + 1], cells[i + 2]) === B.WET_FARMLAND ? 1 : 0;
    assert.equal(wet, 20, `facing ${facing}`);
  }
  assert.ok(stampByKey('vegetable-patch'));
});

test('a fence joins up with the fence beside it; alone, it is just a post', () => {
  const w = meadow();
  const at = (x, y, z) => w.get(x, y, z);
  w.set(10, 11, 10, B.FENCE);
  const alone = furnitureBoxes(B.FENCE, 10, 11, 10, at);
  w.set(11, 11, 10, B.FENCE);
  w.set(10, 11, 11, B.FENCE);
  const joined = furnitureBoxes(B.FENCE, 10, 11, 10, at);
  assert.equal(joined.length, alone.length + 4, 'two rails out to each of two fences');
  assert.ok(joined.some(([x0, , , x1]) => x0 >= 10.6 && x1 === 11), 'rails reach the fence to the east');
  assert.ok(joined.some(([, , z0, , , z1]) => z0 >= 10.6 && z1 === 11), 'and to the south');
  assert.ok(!joined.some(([x0, , , x1]) => x0 === 10 && x1 <= 10.4), 'none out to the west, where there is none');
});

test('crops are drawn crossed in a # in the plants, a ripe pumpkin and watermelon as boxes, and corn taller than the rest', () => {
  const w = meadow(16);
  w.set(4, 10, 4, B.FARMLAND);
  w.set(4, 11, 4, CARROT[2]);
  const light = new LightMap(w);
  light.computeAll();
  const visuals = { faceLayer: new Int16Array(256 * 3), tint: new Uint8Array(256 * 3).fill(255), studTint: new Uint8Array(256 * 3).fill(200), layers: new Map() };
  const before = meshChunk(w, light, visuals, 0, 0);
  assert.equal(before.plants.verts, 16, 'four planes of four corners');
  const tallest = (part) => Math.max(...part.pos.filter((_, i) => i % 3 === 1));
  w.set(4, 11, 4, CORN[3]);
  light.computeAll();
  const corn = meshChunk(w, light, visuals, 0, 0);
  assert.ok(tallest(corn.plants) > 11 + 1.3, 'ripe corn stands taller than a block');
  w.set(4, 11, 4, PUMPKIN[3]);
  light.computeAll();
  const pumpkin = meshChunk(w, light, visuals, 0, 0);
  assert.equal(pumpkin.plants.verts, 16, 'its leaves');
  assert.equal(pumpkin.opaque.verts - before.opaque.verts, GOURDS.pumpkin.length * 24, 'and the pumpkin itself, six faces a box');
});
