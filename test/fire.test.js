// Lightning and the fires it starts: what burns and what it leaves, fire
// spreading and going out, the watering can, and the island's storms.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as B from '../public/js/shared/blocks.js';
import { burns, FIRE, Fires, strikeSpot } from '../public/js/shared/fire.js';
import { PROTOCOL, Room } from '../public/js/shared/room.js';
import { World } from '../public/js/shared/world.js';

function rng(seed = 7) {
  return () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
}

// A little patch of grass with a tree on it, and a plank house beside it.
function patch() {
  const w = new World({ W: 24, H: 24, D: 24, sea: 2 });
  for (let x = 0; x < 24; x++) for (let z = 0; z < 24; z++) w.set(x, 5, z, B.GRASS);
  for (let y = 6; y < 10; y++) w.set(10, y, 10, B.WOOD);
  for (let x = 8; x <= 12; x++) for (let z = 8; z <= 12; z++) for (let y = 10; y < 12; y++) if (w.get(x, y, z) === B.AIR) w.set(x, y, z, B.LEAVES);
  for (let x = 16; x <= 18; x++) for (let z = 16; z <= 18; z++) w.set(x, 6, z, B.PLANKS);
  return w;
}

test('only what grows burns, and burning leaves grass as dirt and a tree as nothing', () => {
  for (const id of [B.LEAVES, B.WOOD, B.GRASS, B.HAY, B.DAISY, B.TALL_GRASS]) assert.ok(burns(id), B.block(id).name);
  for (const id of [B.PLANKS, B.STONE, B.SAND, B.WATER, B.GLASS, B.CHAIR, B.CLOTHS[0], B.GUMDROP]) assert.ok(!burns(id), B.block(id).name);
  // A tree mostly burns right through (left alone, now and then a fire
  // dies out by itself).
  let spread = 0;
  for (const seed of [3, 11, 29, 101, 2024]) {
    const w = patch();
    const fires = new Fires(w, rng(seed));
    fires.ignite(10, 11, 10, 0);
    for (let t = 0; t < 120000 && fires.list.size; t += 250) {
      const { burnt } = fires.step(t, false);
      for (let i = 0; i < burnt.length; i += 4) {
        w.set(burnt[i], burnt[i + 1], burnt[i + 2], burnt[i + 3]);
        spread++;
      }
    }
  }
  assert.ok(spread > 40, `${spread} blocks burnt in five trees`);
  const w = patch();
  const fires = new Fires(w, rng(11));
  assert.ok(fires.ignite(10, 11, 10, 0));
  assert.ok(!fires.ignite(10, 11, 10, 0), 'alight already');
  assert.ok(!fires.ignite(17, 6, 17, 0), 'planks never catch');
  assert.ok(!fires.ignite(17, 5, 17, 0), 'nor the grass under a floor');
  let t = 0;
  const gone = [];
  while (fires.list.size && t < 120000) {
    t += 250;
    const { burnt } = fires.step(t, false);
    for (let i = 0; i < burnt.length; i += 4) {
      w.set(burnt[i], burnt[i + 1], burnt[i + 2], burnt[i + 3]);
      gone.push(burnt.slice(i, i + 4));
    }
  }
  assert.equal(fires.list.size, 0, 'it burns itself out');
  assert.equal(w.get(10, 11, 10), B.AIR, 'the leaf it started on is gone');
  assert.ok(gone.length > 3, `it spread: ${gone.length} blocks`);
  assert.ok(gone.length <= 400);
  for (const [, , , id] of gone) assert.ok(id === B.AIR || id === B.DIRT);
  for (let x = 16; x <= 18; x++) for (let z = 16; z <= 18; z++) assert.equal(w.get(x, 6, z), B.PLANKS, 'the house stands');
});

test('fire spreads more slowly in the rain, never past its limit, and the watering can puts it out', () => {
  const spreadIn = (wet) => {
    const w = patch();
    const fires = new Fires(w, rng(3));
    fires.ignite(10, 11, 10, 0);
    let most = 0;
    for (let t = 0; t <= 5000; t += 250) most = Math.max(most, fires.list.size + fires.step(t, wet).off.length * 0);
    return most;
  };
  assert.ok(spreadIn(true) <= spreadIn(false), 'slower in the rain');
  const w = new World({ W: 40, H: 12, D: 40, sea: 1 });
  for (let x = 0; x < 40; x++) for (let z = 0; z < 40; z++) for (let y = 2; y < 6; y++) w.set(x, y, z, B.LEAVES);
  const fires = new Fires(w, rng(5));
  fires.ignite(20, 5, 20, 0);
  for (let t = 0; t < 60000 && fires.list.size < FIRE.max; t += 200) fires.step(t, false);
  assert.equal(fires.list.size, FIRE.max, 'it stops at the limit');
  const before = fires.list.size;
  const [x, y, z] = fires.pack();
  const off = fires.douse(x + 0.5, y + 0.5, z + 0.5);
  assert.ok(off.length >= 1 && fires.list.size === before - off.length / 3);
  assert.ok(!fires.has(x, y, z));
  w.set(...fires.pack().slice(0, 3), B.AIR);
  assert.equal(fires.step(60001, false).off.length >= 3, true, 'a burning block taken away goes out');
});

test('lightning strikes the highest of the spots it picks', () => {
  const w = patch();
  let hitTree = 0;
  const random = rng(11);
  for (let i = 0; i < 200; i++) {
    const s = strikeSpot(w, random, 40);
    assert.ok(s.y >= 5);
    if (s.y >= 11) hitTree++;
  }
  assert.ok(hitTree > 100, `the tree, mostly: ${hitTree}`);
});

test('in a storm lightning strikes for everyone, starts fires that burn things away, and fire burns', () => {
  const time = { t: 1_000_000 };
  const room = new Room({ code: '123456', theme: 'sunny', name: 'Sunny Cove', seed: 42, now: () => time.t, random: rng(1) });
  const c = { inbox: [], send: (text) => c.inbox.push(JSON.parse(text)), close() {} };
  room.attach(c);
  room.receive(c, { t: 'join', protocol: PROTOCOL, name: 'Happy Panda', look: { animal: 'cat', fur: 'orange', shirt: 3, hat: 'cap' } });
  assert.deepEqual(c.inbox.find((m) => m.t === 'welcome').fires, []);
  room.env.weather = 'storm';
  room.env.left = 1e9;
  const all = (t) => c.inbox.filter((m) => m.t === t);
  for (let i = 0; i < 600 && !all('strike').some((m) => m.fire); i++) {
    time.t += 500;
    room.tick();
  }
  const strikes = all('strike');
  assert.ok(strikes.length >= 1);
  const lit = strikes.find((m) => m.fire);
  assert.ok(lit, 'one of them started a fire');
  assert.ok(all('fire').length === 0 || all('fire').every((m) => Array.isArray(m.on) && Array.isArray(m.off)));
  // Stand in it: it burns.
  const p = room.players.get(1);
  p.s = [lit.x + 0.5, lit.y + 1, lit.z + 0.5, 0, 0, 0];
  p.safeUntil = 0;
  room.env.weather = 'clear';
  time.t += 100;
  room.tick();
  if (room.fires.has(lit.x, lit.y, lit.z)) assert.ok(all('bump').some((m) => m.burn && m.pid === 1), 'standing in the flames hurts');
  // The watering can puts it out.
  room.receive(c, { t: 'douse', x: lit.x + 0.5, y: lit.y + 0.5, z: lit.z + 0.5 });
  assert.ok(!room.fires.has(lit.x, lit.y, lit.z));
  // Left alone, the rest burns away into an edit everyone sees.
  for (let i = 0; i < 200 && room.fires.list.size; i++) {
    time.t += 500;
    room.tick();
  }
  assert.equal(room.fires.list.size, 0);
  assert.ok(all('edit').some((m) => m.kind === 'nature') || all('fire').some((m) => m.by === 1));
});
