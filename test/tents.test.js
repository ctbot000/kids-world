// Tents: tent cloth in eight colours; the huge Circus Tent and Camping Tent
// stamps (bigger than any other stamp and each one edit, cloth over all of
// their floor, a way in at the front and walls everywhere else, room and
// light inside for everyone, trampolines in the circus ring and a sleeping
// bag each in the camping tent); what counts as being in a tent; the Camp Out
// sticker; and monsters, which never go into one or get at anyone in one.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as B from '../public/js/shared/blocks.js';
import { LightMap } from '../public/js/shared/light.js';
import { MonsterSim } from '../public/js/shared/monsters.js';
import { makeBody, stepBody } from '../public/js/shared/physics.js';
import { stampByKey, STAMPS } from '../public/js/shared/stamps.js';
import { STAT_KEYS, STICKERS } from '../public/js/shared/stickers.js';
import { underTent } from '../public/js/shared/tents.js';
import { applyCells, MAX_EDIT_CELLS, stampEdit, validCells } from '../public/js/shared/tools.js';
import { World } from '../public/js/shared/world.js';

const TENTS = ['circus-tent', 'camping-tent'];

// A flat meadow: grass at y 10 everywhere, and the start off in a corner.
function meadow(W = 72) {
  const w = new World({ W, H: 48, D: W, sea: 4, theme: 'flat', spawn: { x: 4.5, y: 11, z: 4.5 } });
  for (let x = 0; x < W; x++) for (let z = 0; z < W; z++) for (let y = 0; y <= 10; y++) w.set(x, y, z, y === 0 ? B.MAGIC_FLOOR : y === 10 ? B.GRASS : B.DIRT);
  return w;
}

// A stamp put down on the meadow by someone looking along +z, tapping the
// grass at (x, z): its front is at z, and it goes on away from them. The
// middle of the circus tent is 14 further on.
function put(w, key, x = 36, z = 10, facing = 0) {
  const e = stampEdit(w, { x, y: 10, z, nx: 0, ny: 1, nz: 0, id: w.get(x, 10, z) }, key, facing);
  applyCells(w, e.cells);
  return e;
}

const span = (cells) => {
  const extent = (k) => Math.max(...cells.map((c) => c[k])) - Math.min(...cells.map((c) => c[k])) + 1;
  return { wide: extent(0), high: extent(1), long: extent(2) };
};

// Every spot inside a tent where someone can stand: on something, with two
// cells of room above, and cloth over them.
function spotsIn(w, from, to, inside) {
  const spots = [];
  for (let x = from.x; x <= to.x; x++) {
    for (let z = from.z; z <= to.z; z++) {
      if (!inside(x, z)) continue;
      for (let y = 11; y < 20; y++) {
        if (!B.SOLID[w.get(x, y - 1, z)] || B.SOLID[w.get(x, y, z)] || B.SOLID[w.get(x, y + 1, z)]) continue;
        if (underTent(w, x + 0.5, y, z + 0.5)) spots.push({ x, y, z });
      }
    }
  }
  return spots;
}

test('tent cloth comes in eight colours, soft and with no studs, in the toy box', () => {
  assert.equal(B.CLOTHS.length, 8);
  const building = B.blocksIn('building');
  for (const id of B.CLOTHS) {
    const d = B.block(id);
    assert.ok(building.includes(id), `${d.name} is in the toy box`);
    assert.match(d.name, /^\w+ Tent Cloth$/);
    assert.ok(d.solid && d.opaque && d.cube && !d.studs, `${d.name} is a block to stand on, with no studs`);
    assert.equal(d.sound, 'cloth');
    assert.deepEqual(d.tiles, { top: 'cloth', side: 'cloth', bottom: 'cloth' });
    assert.equal(B.CLOTH[id], 1);
  }
  assert.equal(new Set(B.CLOTHS.map((id) => B.block(id).color)).size, 8, 'each a colour of its own');
  assert.equal(B.CLOTH.reduce((n, v) => n + v, 0), 8, 'and nothing else is tent cloth');
});

test('the circus tent and the camping tent are huge, bigger than any other stamp, and each goes down in one edit', () => {
  const circus = span(stampByKey('circus-tent').cells);
  const camping = span(stampByKey('camping-tent').cells);
  assert.ok(circus.wide >= 21 && circus.long >= 21 && circus.high >= 18, `circus tent ${JSON.stringify(circus)}`);
  assert.ok(camping.wide >= 15 && camping.long >= 19 && camping.high >= 9, `camping tent ${JSON.stringify(camping)}`);
  const volume = ({ wide, high, long }) => wide * high * long;
  for (const s of STAMPS) if (!TENTS.includes(s.key)) assert.ok(volume(span(s.cells)) < volume(camping), `the ${s.name} is smaller`);
  for (const key of TENTS) {
    const cells = stampByKey(key).cells;
    assert.ok(cells.length <= MAX_EDIT_CELLS, `${key}: ${cells.length} cells`);
    assert.equal(new Set(cells.map(([x, y, z]) => `${x},${y},${z}`)).size, cells.length, `${key}: each cell once`);
    // Even into a hill, where every one of its cells changes something, the
    // host takes it whole, whichever way it faces.
    const w = meadow();
    for (let x = 0; x < w.W; x++) for (let z = 0; z < w.D; z++) for (let y = 11; y < 36; y++) w.set(x, y, z, B.STONE);
    for (let f = 0; f < 4; f++) {
      const e = stampEdit(w, { x: 36, y: 10, z: 36, nx: 0, ny: 1, nz: 0, id: B.GRASS }, key, f);
      assert.equal(e.cells.length / 4, cells.length, `${key} facing ${f}: every cell`);
      assert.ok(validCells(w, e.cells), `${key} facing ${f}: one edit`);
    }
  }
});

test("all of a tent's floor is under its cloth, outside it nothing is, and a house is not a tent", () => {
  for (const key of TENTS) {
    const w = meadow();
    const e = put(w, key);
    let floor = 0;
    for (let i = 0; i < e.cells.length; i += 4) {
      const [x, y, z, id] = e.cells.slice(i, i + 4);
      // Floor with room to stand on it (not the pole's, a bench's or a wall's).
      if (y !== 10 || id === B.AIR || B.SOLID[w.get(x, 11, z)]) continue;
      floor++;
      assert.ok(underTent(w, x + 0.5, 11, z + 0.5), `${key}: the floor at ${x}, ${z} is under cloth`);
    }
    assert.ok(floor >= 100, `${key}: ${floor} cells of floor`);
    for (const [x, z] of [
      [36, 6],
      [36, 40],
      [20, 24],
      [52, 24],
    ]) {
      assert.ok(!underTent(w, x + 0.5, 11, z + 0.5), `${key}: not in it at ${x}, ${z}`);
    }
    // Up on its roof is not in it either.
    assert.ok(!underTent(w, 36.5, w.top(36, 24) + 1, 24.5), `${key}: on top`);
  }
  const w = meadow();
  put(w, 'house');
  assert.ok(!underTent(w, 36.5, 11, 13.5), 'in a house');
  // Any cloth overhead makes a tent, as high as a tent goes.
  w.set(10, 30, 10, B.CLOTHS[3]);
  assert.ok(underTent(w, 10.5, 11, 10.5));
  assert.ok(!underTent(w, 11.5, 11, 10.5));
  w.set(10, 30, 10, B.AIR);
  w.set(10, 40, 10, B.CLOTHS[3]);
  assert.ok(!underTent(w, 10.5, 11, 10.5), 'too high up to be a tent');
});

test('you walk into a tent through its way in, at the front; the circus tent has walls everywhere else', () => {
  for (const [key, door] of [
    ['circus-tent', 14],
    ['camping-tent', 12],
  ]) {
    const w = meadow();
    put(w, key);
    const b = makeBody(36.5, 11, 6.5);
    for (let i = 0; i < 180; i++) stepBody(w, b, { mz: 1 }, 1 / 60, { autoJump: true });
    assert.ok(b.z > door + 2 && Math.abs(b.y - 11) < 0.01, `${key}: walked in to ${b.x}, ${b.y}, ${b.z}`);
    assert.ok(underTent(w, b.x, b.y, b.z), `${key}: in it`);
  }
  // Coming at the circus tent from the side or the back, a wall: too high to
  // hop up, so you go round to the front.
  const w = meadow();
  put(w, 'circus-tent');
  for (const [x, z, mx, mz] of [
    [56.5, 24.5, -1, 0],
    [16.5, 24.5, 1, 0],
    [36.5, 44.5, 0, -1],
  ]) {
    const b = makeBody(x, 11, z);
    for (let i = 0; i < 300; i++) stepBody(w, b, { mx, mz }, 1 / 60, { autoJump: true });
    assert.ok(Math.hypot(b.x - 36.5, b.z - 24.5) > 10.5, `stopped at the wall, at ${b.x}, ${b.z}`);
    assert.equal(b.y, 11);
  }
});

test('there is room inside for everyone, lit by lamps at night', () => {
  for (const [key, from, to, inside, least] of [
    ['circus-tent', { x: 26, z: 14 }, { x: 46, z: 34 }, (x, z) => Math.hypot(x - 36, z - 24) < 10, 250],
    ['camping-tent', { x: 30, z: 13 }, { x: 42, z: 27 }, () => true, 120],
  ]) {
    const w = meadow();
    put(w, key);
    const light = new LightMap(w);
    light.computeAll();
    const spots = spotsIn(w, from, to, inside);
    assert.ok(spots.length >= least, `${key}: ${spots.length} spots to stand`);
    // Night comes in through the door and nowhere else; the lamps light every spot.
    const dim = spots.filter(({ x, y, z }) => Math.max(light.lampAt(x, y, z), light.lampAt(x, y + 1, z)) < 5);
    assert.deepEqual(dim, [], `${key}: lamplight everywhere`);
  }
});

test('the circus ring is a floor of trampolines round the pole, with stars round it and benches behind', () => {
  const w = meadow();
  put(w, 'circus-tent');
  // The pole goes up through the top of the roof to a star.
  let top = 11;
  while (w.get(36, top + 1, 24) === B.CANDY_CANE || w.get(36, top + 1, 24) === B.LAMP) top++;
  assert.ok(top >= 11 + 16, `the pole goes up to ${top}`);
  assert.equal(w.get(36, top + 1, 24), B.STAR_BLOCK);
  let trampolines = 0;
  let stars = 0;
  let seats = [0, 0, 0];
  for (let x = 20; x <= 52; x++) {
    for (let z = 8; z <= 40; z++) {
      const r = Math.hypot(x - 36, z - 24);
      if (w.get(x, 10, z) === B.TRAMPOLINE) {
        trampolines++;
        assert.ok(r < 4.5, 'in the ring');
      }
      if (w.get(x, 11, z) === B.STAR_BLOCK) stars++;
      for (let row = 0; row < 3; row++) if (B.TOY_BRICKS.includes(w.get(x, 11 + row, z)) && !B.SOLID[w.get(x, 12 + row, z)] && r >= 6.5) seats[row]++;
    }
  }
  assert.ok(trampolines >= 40, `${trampolines} trampolines`);
  assert.ok(stars >= 6, `${stars} stars round the ring`);
  assert.ok(seats.every((n) => n >= 20), `seats in three rows, each a step up: ${seats}`);
  // Jump in the ring and you bounce.
  const b = makeBody(36.5, 11, 21.5);
  let bounced = 0;
  for (let i = 0; i < 300; i++) if (stepBody(w, b, { jump: true }, 1 / 60, { bounce: true }).bounced) bounced++;
  assert.ok(bounced >= 3, `bounced ${bounced} times`);
});

test('the camping tent has a sleeping bag with a pillow for each of eight friends, and a porch', () => {
  const cells = stampByKey('camping-tent').cells;
  const floor = new Map(cells.filter(([, y]) => y === -1).map(([x, , z, id]) => [`${x},${z}`, id]));
  let bags = 0;
  for (const [key, id] of floor) {
    const [x, z] = key.split(',').map(Number);
    // A pillow by the wall, with the bag running in from it.
    if (id !== B.CLOTHS[7] || Math.abs(x) !== 6) continue;
    const bag = floor.get(`${x - Math.sign(x)},${z}`);
    assert.ok(B.CLOTH[bag] && bag !== B.CLOTHS[4] && bag !== B.CLOTHS[7], `a bag at ${x}, ${z}`);
    bags++;
  }
  assert.equal(bags, 16, 'eight bags, two cells wide');
  // Under the roof in front of the door: out of the rain.
  const w = meadow();
  put(w, 'camping-tent');
  assert.ok(underTent(w, 36.5, 11, 10.5) && !B.SOLID[w.get(36, 11, 10)] && !B.SOLID[w.get(36, 11, 11)]);
});

test('a night in a tent earns the Camp Out sticker', () => {
  assert.ok(STAT_KEYS.includes('campouts'));
  const sticker = STICKERS.find((s) => s.key === 'camp-out');
  const earned = (campouts) => sticker.test(Object.fromEntries(STAT_KEYS.map((k) => [k, k === 'campouts' ? campouts : 0])));
  assert.ok(earned(1) && !earned(0));
});

test('no monster ever goes into a tent, nor after anyone in one; step out and they come', () => {
  const w = meadow();
  put(w, 'circus-tent');
  const sim = new MonsterSim(9);
  sim.spawnAt = Infinity;
  // Monsters all round the tent (and its porch), at night, and you in it.
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    sim.add(w, 36.5 + Math.sin(a) * 16, 11, 24.5 + Math.cos(a) * 16);
  }
  const you = { id: 1, x: 36.5, y: 11, z: 17.5 };
  let now = 0;
  for (let i = 0; i < 2400; i++) {
    now += 50;
    assert.deepEqual(sim.step(w, 0.05, now, [you], true), [], 'nobody bumped in the tent');
    for (const m of sim.list) {
      assert.ok(!underTent(w, m.body.x, m.body.y, m.body.z), `monster ${m.id} stays out, at ${m.body.x}, ${m.body.z}`);
      assert.equal(m.target, 0, 'nobody in a tent is chased');
    }
  }
  const near = sim.list.filter((m) => Math.hypot(m.body.x - 36.5, m.body.z - 24.5) < 16).length;
  assert.ok(near >= 3, `${near} came up to the tent and waited`);
  // Out in front of it, you are fair game again.
  Object.assign(you, { z: 4.5 });
  let bumped = false;
  for (let i = 0; i < 1200 && !bumped; i++) {
    now += 50;
    bumped = sim.step(w, 0.05, now, [you], true).length > 0;
  }
  assert.ok(bumped, 'caught outside');
});

test('a monster after you gives up once you are in a tent, and none comes out on top of one', () => {
  const w = meadow();
  put(w, 'camping-tent');
  const sim = new MonsterSim(4);
  sim.spawnAt = Infinity;
  const m = sim.add(w, 36.5, 11, 1.5);
  const you = { id: 1, x: 36.5, y: 11, z: 6.5 };
  let now = 0;
  for (let i = 0; i < 10; i++) sim.step(w, 0.05, (now += 50), [you], false);
  assert.equal(m.target, 1, 'it is after you');
  Object.assign(you, { z: 16.5 });
  for (let i = 0; i < 400; i++) {
    sim.step(w, 0.05, (now += 50), [you], false);
    assert.equal(m.target, 0);
    assert.ok(!underTent(w, m.body.x, m.body.y, m.body.z));
  }
  // New ones never come out on a tent's roof, though a roof of bricks that
  // shape would have some.
  const roofs = (world) => {
    const spawner = new MonsterSim(21);
    let on = 0;
    for (let i = 0; i < 400; i++) {
      const at = spawner.findSpot(world, [{ id: 1, x: 36.5, y: 11, z: 6.5 }]);
      if (at && at.y > 11) on++;
    }
    return on;
  };
  const bricks = meadow();
  for (const [x, y, z, id] of stampEdit(bricks, { x: 36, y: 10, z: 10, nx: 0, ny: 1, nz: 0, id: B.GRASS }, 'camping-tent', 0).cells.reduce((all, v, i, a) => (i % 4 ? all : [...all, a.slice(i, i + 4)]), [])) {
    bricks.set(x, y, z, B.CLOTH[id] ? B.TOY_BRICKS[0] : id);
  }
  assert.ok(roofs(bricks) > 0, 'on a brick roof, some');
  assert.equal(roofs(w), 0, 'on a tent, none');
});
