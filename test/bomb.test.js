// The mining bomb: put down as a block beside the rails, its fuse burns on
// the host and it pops into a small round hole in the natural ground only,
// with gem rocks caught in the blast dropping their jewels for the blaster.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as B from '../public/js/shared/blocks.js';
import { PROTOCOL, Room } from '../public/js/shared/room.js';
import { applyCells, blastEdit } from '../public/js/shared/tools.js';
import { World } from '../public/js/shared/world.js';

// Flat stone up to y = 5, with a ruby rock buried in it.
function rockyWorld() {
  const w = new World({ W: 24, H: 20, D: 24, sea: 2 });
  for (let x = 0; x < w.W; x++) {
    for (let z = 0; z < w.D; z++) {
      w.set(x, 0, z, B.MAGIC_FLOOR);
      for (let y = 1; y <= 5; y++) w.set(x, y, z, B.STONE);
    }
  }
  w.set(12, 2, 12, B.GEM_ROCKS[0]);
  return w;
}

function clock(start = 1_000_000) {
  const c = { t: start };
  c.now = () => c.t;
  c.advance = (ms) => (c.t += ms);
  return c;
}

function conn() {
  const c = { inbox: [], closed: false };
  c.send = (text) => c.inbox.push(JSON.parse(text));
  c.close = () => (c.closed = true);
  c.last = (t) => [...c.inbox].reverse().find((m) => m.t === t);
  return c;
}

function makeRoom(opts = {}) {
  const time = clock();
  const room = new Room({ code: '123456', theme: 'sunny', name: 'Sunny Cove', seed: 42, now: time.now, random: () => 0.5, ...opts });
  return { room, time };
}

function join(room, extra = {}) {
  const c = conn();
  room.attach(c);
  room.receive(c, { t: 'join', protocol: PROTOCOL, name: 'Happy Panda', look: { animal: 'cat', fur: 'orange', shirt: 3, hat: 'cap' }, ...extra });
  return c;
}

test('the mining bomb sits in the toy box beside the rails', () => {
  const def = B.block(B.BOMB);
  assert.equal(def.name, 'Mining Bomb');
  assert.equal(def.category, 'building');
  assert.ok(B.blocksIn('building').includes(B.BOMB), 'in the Building tab');
  assert.equal(B.blocksIn('building').indexOf(B.BOMB), B.blocksIn('building').indexOf(B.RAIL) + 1, 'right after the rails');
});

test('a blast digs a small round hole in the natural ground, and only there', () => {
  const w = rockyWorld();
  const before = [];
  for (let x = 0; x < w.W; x++) for (let z = 0; z < w.D; z++) for (let y = 1; y < w.H; y++) before.push(w.get(x, y, z));
  const plan = blastEdit(w, 12, 5, 12);
  applyCells(w, plan.cells);
  // The middle of the blast is gone, the edge of it is not.
  assert.equal(w.get(12, 5, 12), B.AIR);
  assert.equal(w.get(12, 3, 12), B.AIR);
  assert.equal(w.get(14, 5, 12), B.AIR);
  assert.equal(w.get(12, 2, 12), B.GEM_ROCKS[0], 'a gem rock below the hole stays')
  assert.equal(w.get(9, 5, 12), B.STONE, 'the edge of the hole stays');
  // Far away nothing changed at all.
  const after = [];
  for (let x = 0; x < w.W; x++) for (let z = 0; z < w.D; z++) for (let y = 1; y < w.H; y++) after.push(w.get(x, y, z));
  const changes = plan.cells.length / 4;
  let diff = 0;
  for (let i = 0; i < before.length; i++) if (before[i] !== after[i]) diff++;
  assert.equal(diff, changes, 'the blast changes only the cells of its edit');
  assert.ok(changes > 20 && changes < 80, `a small hole, not a crater (${changes} cells)`);
});

test('gem rocks caught in a blast drop their jewels, and anything anyone built stands', () => {
  const w = rockyWorld();
  // A ruby rock right beside where the bomb sits, in the ground.
  w.set(13, 4, 12, B.GEM_ROCKS[0]);
  // A toy brick, farmland, a planted flower and furniture right in the blast.
  w.set(11, 5, 11, B.TOY_BRICKS[0]);
  w.set(11, 5, 12, B.FARMLAND);
  w.set(11, 5, 13, B.TULIP);
  w.set(12, 5, 11, B.CHAIR);
  const plan = blastEdit(w, 12, 5, 12);
  applyCells(w, plan.cells);
  assert.deepEqual(plan.collected, [B.GEM_ROCKS[0]], 'the ruby rock in the blast is collected');
  assert.equal(w.get(13, 4, 12), B.AIR, 'the ruby rock itself is gone');
  assert.equal(B.block(w.get(11, 5, 11)).key, 'brick-red', 'a toy brick stands');
  assert.equal(w.get(11, 5, 12), B.FARMLAND, 'farmland stands');
  // A planted flower whose ground was dug out falls with it, as any pick does.
  assert.equal(w.get(11, 5, 13), B.AIR, 'a planted flower over the hole falls');
  assert.equal(w.get(12, 5, 11), B.CHAIR, 'furniture stands');
});

test('a placed bomb sparks, then pops with a boom everyone hears', () => {
  const { room, time } = makeRoom();
  const a = join(room);
  const w = room.world;
  const top = w.top(12, 12);
  room.edit(a, room.clients.get(a), room.players.get(1), { seq: 1, kind: 'build', cells: [12, top + 1, 12, B.BOMB] });
  assert.equal(w.get(12, top + 1, 12), B.BOMB, 'the bomb is down');
  a.inbox.length = 0;
  // The fuse: its spark fizzles for everyone, and nothing pops early.
  time.advance(500);
  room.tick();
  assert.equal(w.get(12, top + 1, 12), B.BOMB, 'still sparking');
  const fuses = a.inbox.filter((m) => m.t === 'fx' && m.kind === 'fuse');
  assert.ok(fuses.length >= 1, 'the fizzing spark is told');
  assert.equal(fuses[0].x, 12.5, 'the spark is at the bomb');
  // Then the boom.
  time.advance(2500);
  room.tick();
  assert.equal(w.get(12, top + 1, 12), B.AIR, 'the bomb has gone');
  const blast = a.last('fx');
  assert.ok(blast && blast.kind === 'blast', 'the boom is told');
  assert.equal(blast.by, 1, 'it was laid by the first player');
  assert.deepEqual(blast.gems, [], 'no jewels in plain ground');
  assert.ok(a.last('edit'), 'the hole is dug for everyone');
});

test('a bomb in gem rock pops its jewels to whoever laid it', () => {
  const { room, time } = makeRoom();
  const a = join(room);
  const w = room.world;
  // A pillar of stone with a ruby rock in it, and the bomb on top.
  for (let dx = -1; dx <= 1; dx++) {
    for (let dz = -1; dz <= 1; dz++) {
      for (let y = 1; y <= 5; y++) w.set(12 + dx, y, 12 + dz, B.STONE);
    }
  }
  w.set(12, 4, 12, B.GEM_ROCKS[0]);
  room.edit(a, room.clients.get(a), room.players.get(1), { seq: 1, kind: 'build', cells: [12, 6, 12, B.BOMB] });
  time.advance(4000);
  room.tick();
  const blast = a.last('fx');
  assert.deepEqual(blast.gems, [B.GEM_ROCKS[0]], 'the ruby rock is shaken loose');
  assert.equal(w.get(12, 4, 12), B.AIR, 'the ruby rock is dug out');
});
