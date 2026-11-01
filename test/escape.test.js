// Escape islands: the escape house in the middle (walled all round in
// blocks nobody digs through, its doors locked, its clues in the walls and
// the answers read back from them, everyone arriving outside it), each room
// solved by its puzzle by the island for everyone, and the house locking up
// again with new puzzles once everyone has left it.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as B from '../public/js/shared/blocks.js';
import { buildHouse, clues, DOORS, doorOpen, ENTRANCE, escapeHouse, HOUSE, houseUsed, inHouse, puzzleAt, puzzleNear, RESET_MS, ROOM_X, ROOM_Z, roomAt, useEscape } from '../public/js/shared/escape.js';
import { Rng } from '../public/js/shared/rng.js';
import { PROTOCOL, Room } from '../public/js/shared/room.js';
import { STAT_KEYS, STICKERS } from '../public/js/shared/stickers.js';
import { randomIslandName } from '../public/js/shared/words.js';
import { normalizeMeta } from '../public/js/shared/world.js';
import { generate, THEMES } from '../public/js/shared/worldgen.js';

// Every puzzle piece in the house: [x, y, z] of each.
function pieces(world, house) {
  const out = [];
  for (let x = house.cx + HOUSE.x0; x <= house.cx + HOUSE.x1; x++) {
    for (let z = house.cz + HOUSE.z0; z <= house.cz + HOUSE.z1; z++) {
      for (let y = house.level; y <= house.level + HOUSE.roof; y++) if (puzzleAt(world, x, y, z)) out.push([x, y, z]);
    }
  }
  return out;
}

test('an escape island is a kind of island, saved and named as one, with a sticker for escaping', () => {
  assert.ok(THEMES.some((t) => t.key === 'escape' && t.icon === '🔐'));
  assert.equal(normalizeMeta({ theme: 'escape' }).theme, 'escape');
  for (let i = 0; i < 20; i++) assert.match(randomIslandName('escape', Math.random), /^\S+ (Manor|House|Island|Isle|Mansion|Hall)$/);
  assert.ok(STAT_KEYS.includes('escapes'));
  assert.ok(STICKERS.find((s) => s.key === 'escape-artist').test({ escapes: 3 }));
  // Nothing of the house is in the toy box, or can be put down or picked up.
  for (const id of [B.ESCAPE_WALL, B.ESCAPE_FLOOR, B.LOCKED_DOOR, B.CRATE, ...B.ESCAPE_BUTTONS, ...B.STAR_TILES, B.DIALS[2] + 9]) {
    assert.equal(B.BLOCKS[id].islandOnly, true);
    assert.equal(B.BLOCKS[id].category, false);
  }
});

test('the house: walled all round, the doors locked, the clues in the walls, everyone arriving outside', () => {
  for (const [seed, size] of [
    [1, 'small'],
    [7, 'big'],
    [12, 'huge'],
  ]) {
    const { world } = generate({ seed, theme: 'escape', size });
    const house = escapeHouse(world);
    const { cx, cz, level } = house;
    // Nobody gets in or out but by the way in and the doors: every cell of
    // the floor, the roof and the walls round it is the house's own.
    const open = new Set([`${ENTRANCE[0]},1`, `${ENTRANCE[0]},2`]);
    for (let ox = HOUSE.x0; ox <= HOUSE.x1; ox++) {
      for (let oz = HOUSE.z0; oz <= HOUSE.z1; oz++) {
        for (const y of [0, HOUSE.roof]) assert.ok(B.BLOCKS[world.get(cx + ox, level + y, cz + oz)].islandOnly, `${size}: floor and roof at ${ox},${oz}`);
        const edge = ox === HOUSE.x0 || ox === HOUSE.x1 || oz === HOUSE.z0 || oz === HOUSE.z1;
        if (!edge) continue;
        for (let y = 1; y < HOUSE.roof; y++) {
          if (oz === HOUSE.z1 && open.has(`${ox},${y}`)) assert.equal(world.get(cx + ox, level + y, cz + oz), B.AIR);
          else assert.ok(B.BLOCKS[world.get(cx + ox, level + y, cz + oz)].islandOnly, `${size}: wall at ${ox},${y},${oz}`);
        }
      }
    }
    // Round that, an outer wall with nothing of the puzzles to be seen from
    // outside, open only at the way in and the way out.
    for (let ox = HOUSE.x0 - 1; ox <= HOUSE.x1 + 1; ox++) {
      for (let oz = HOUSE.z0 - 1; oz <= HOUSE.z1 + 1; oz++) {
        if (ox >= HOUSE.x0 && ox <= HOUSE.x1 && oz >= HOUSE.z0 && oz <= HOUSE.z1) continue;
        for (let y = 0; y <= HOUSE.roof; y++) {
          const id = world.get(cx + ox, level + y, cz + oz);
          const door = oz === HOUSE.z1 + 1 && (ox === ENTRANCE[0] || ox === DOORS[2][0]) && (y === 1 || y === 2);
          if (door) assert.equal(id, B.AIR);
          else assert.ok([B.ESCAPE_WALL, B.ESCAPE_TRIM, B.EXIT_SIGN].includes(id), `${size}: outer wall at ${ox},${y},${oz}`);
        }
      }
    }
    for (const n of [1, 2, 3]) {
      assert.equal(doorOpen(world, house, n), false);
      const [ox, oz] = DOORS[n - 1];
      assert.equal(world.get(cx + ox, level + 2, cz + oz), B.LOCKED_DOOR_TOP);
    }
    assert.equal(houseUsed(world, house), false);
    // Rooms where they should be, and the way in walkable from outside.
    ROOM_X.forEach((rx, i) => assert.equal(roomAt(house, cx + rx + 0.5, level + 1, cz + ROOM_Z + 0.5), i + 1));
    assert.equal(roomAt(house, cx + 0.5, level + 1, cz + 5.5), 0);
    const s = world.spawn;
    assert.ok(!inHouse(house, s.x, s.y, s.z), 'arriving outside');
    assert.equal(world.get(Math.floor(s.x), s.y, Math.floor(s.z)), B.AIR);
    // The clues: four colours in some order, one X on the map, one to five
    // stars of each dial's colour; and the pieces: 4 buttons, 9 crates, 3 dials.
    const c = clues(world, house);
    assert.deepEqual([...c.order].sort(), [0, 1, 2, 3]);
    assert.ok(c.crate && c.crate.every((v) => v >= 0 && v <= 2));
    for (const n of c.counts) assert.ok(n >= 1 && n <= 5);
    const kinds = pieces(world, house).map(([x, y, z]) => puzzleAt(world, x, y, z).kind);
    assert.deepEqual([kinds.filter((k) => k === 'button').length, kinds.filter((k) => k === 'crate').length, kinds.filter((k) => k === 'dial').length], [4, 9, 3]);
  }
  assert.equal(escapeHouse({ theme: 'zoo' }), null);
});

test('new puzzles each time the house is built again', () => {
  const { world } = generate({ seed: 3, theme: 'escape' });
  const house = escapeHouse(world);
  const seen = new Set();
  for (let i = 0; i < 12; i++) {
    buildHouse(world, house, new Rng(100 + i));
    seen.add(JSON.stringify(clues(world, house)));
  }
  assert.ok(seen.size >= 10, `${seen.size} different houses of 12`);
});

test('a puzzle piece is found by facing it, standing at it in the house', () => {
  const { world } = generate({ seed: 3, theme: 'escape' });
  const house = escapeHouse(world);
  const { cx, cz, level } = house;
  // In room 2, between two crates: the one you face.
  const body = { x: cx + 1 + 0.5, y: level + 1, z: cz - 6 + 0.5 };
  assert.deepEqual([puzzleNear(world, house, body, Math.PI / 2)?.x, puzzleNear(world, house, body, -Math.PI / 2)?.x], [cx + 2, cx]);
  assert.equal(puzzleNear(world, house, { x: cx + 0.5, y: level + 1, z: cz + 6.5 }, Math.PI), null, 'outside the house');
  // Nothing more to do at an open crate.
  world.set(cx + 2, level + 1, cz - 6, B.CRATE_OPEN);
  const next = puzzleNear(world, house, body, Math.PI / 2);
  assert.ok(next && next.open === false && next.z !== cz - 6, 'a shut crate beside it instead');
});

// ---------------------------------------------------------------- the island

function conn() {
  const c = { inbox: [] };
  c.send = (text) => c.inbox.push(JSON.parse(text));
  c.close = () => {};
  c.last = (t) => [...c.inbox].reverse().find((m) => m.t === t);
  c.all = (t) => c.inbox.filter((m) => m.t === t);
  return c;
}

function join(room, name) {
  const c = conn();
  room.attach(c);
  room.receive(c, { t: 'join', protocol: PROTOCOL, name, look: { animal: 'cat', fur: 'orange', shirt: 3, hat: 'cap' } });
  c.pid = c.last('welcome').you;
  return c;
}

test('solving the house together: buttons, the crate with the key, the dials, and out — then it locks up again', () => {
  const time = { t: 1_000_000 };
  const room = new Room({ code: '123456', theme: 'escape', seed: 4, now: () => time.t });
  const house = escapeHouse(room.world);
  const { cx, cz, level } = house;
  const w = room.world;
  const ann = join(room, 'Ann');
  const bo = join(room, 'Bo');
  const answers = clues(w, house);
  const all = pieces(w, house);
  const of = (kind) => all.filter(([x, y, z]) => puzzleAt(w, x, y, z).kind === kind);
  // Ann steps up to a piece (just in front of it, in its room) and uses it.
  const use = (who, [x, y, z]) => {
    const inward = z === cz + HOUSE.z0 ? 1.5 : 0;
    room.receive(who, { t: 'm', s: [x + 0.5, level + 1, z + 0.5 + inward, 0, 0, 0] });
    room.receive(who, { t: 'escape', at: [x, y, z] });
    return who.last('escfx');
  };
  const tick = (ms) => {
    for (let t = 0; t < ms; t += 250) {
      time.t += 250;
      room.tick();
    }
  };

  // Nobody digs through the wall to get out.
  room.receive(ann, { t: 'm', s: [cx - 13.5, level + 1, cz - 2.5, 0, 0, 0] });
  room.receive(ann, { t: 'edit', seq: 1, kind: 'build', cells: [cx + HOUSE.x0, level + 1, cz - 2, B.AIR] });
  assert.equal(w.get(cx + HOUSE.x0, level + 1, cz - 2), B.ESCAPE_WALL);

  // Room 1: a wrong button and they all go dark; the right order opens the door.
  const buttons = of('button');
  const button = (c) => buttons.find(([x, y, z]) => puzzleAt(w, x, y, z).color === c);
  assert.equal(use(ann, button(answers.order[0])).f, 'press');
  assert.equal(use(bo, button(answers.order[2])).f, 'wrong');
  assert.ok(buttons.every(([x, y, z]) => !puzzleAt(w, x, y, z).lit), 'all dark again');
  // From across the island, nothing.
  const before = ann.all('escfx').length;
  room.receive(ann, { t: 'm', s: [cx + 0.5, level + 1, cz + 20.5, 0, 0, 0] });
  room.receive(ann, { t: 'escape', at: button(answers.order[0]) });
  assert.equal(ann.all('escfx').length, before);
  for (const [k, c] of answers.order.entries()) assert.equal(use(k % 2 ? bo : ann, button(c)).f, k < 3 ? 'press' : 'open');
  assert.ok(doorOpen(w, house, 1) && !doorOpen(w, house, 2));
  const heard = ann.all('escfx').length;
  use(ann, button(answers.order[0]));
  assert.equal(ann.all('escfx').length, heard, 'a lit button does nothing more');

  // Room 2: an empty crate, then the one under the X.
  const crates = of('crate');
  const [mc, mr] = answers.crate;
  const right = [cx - 2 + 2 * mc, level + 1, cz - 8 + 2 * mr];
  const wrong = crates.find((p) => p.join() !== right.join());
  room.receive(ann, { t: 'm', s: [wrong[0] + 1.5, level + 1, wrong[2] + 0.5, 0, 0, 0] });
  room.receive(ann, { t: 'escape', at: wrong });
  assert.equal(ann.last('escfx').f, 'empty');
  assert.equal(w.get(...wrong), B.CRATE_OPEN);
  room.receive(bo, { t: 'm', s: [right[0] + 1.5, level + 1, right[2] + 0.5, 0, 0, 0] });
  room.receive(bo, { t: 'escape', at: right });
  assert.deepEqual([ann.last('escfx').f, ann.last('escfx').key], ['open', true]);
  assert.ok(doorOpen(w, house, 2));

  // Room 3: each dial turned round to its count; the last turn opens the way out.
  tick(65_000);
  const dials = of('dial').sort((a, b) => a[0] - b[0]);
  let fx;
  dials.forEach((d, i) => {
    for (let k = 0; k < answers.counts[i]; k++) fx = use(ann, d);
  });
  assert.deepEqual([fx.f, fx.out], ['open', true]);
  assert.ok(fx.ms >= 65_000 && fx.ms < 70_000, `${fx.ms} ms since the first button`);
  assert.equal(bo.last('escfx').out, true, 'everyone hears');
  assert.ok(doorOpen(w, house, 3));
  // One more turn does nothing: the room is solved.
  assert.equal(useEscape(w, house, ...dials[0]), null);

  // Not locked up again while anyone is in the house…
  tick(RESET_MS + 5000);
  assert.ok(houseUsed(w, house));
  // …but once everyone has left, after a while it is, with new puzzles.
  for (const who of [ann, bo]) room.receive(who, { t: 'm', s: [cx + 0.5, level + 1, cz + 10.5, 0, 0, 0] });
  tick(RESET_MS - 2000);
  assert.ok(houseUsed(w, house));
  tick(4000);
  assert.equal(houseUsed(w, house), false);
  assert.equal(ann.last('escfx').f, 'reset');
  assert.ok(ann.all('edit').some((m) => m.by === 0 && m.cells.length > 12), 'the house built again for everyone');
  for (const n of [1, 2, 3]) assert.equal(doorOpen(w, house, n), false);
});
