// The volcano island: one theme of worldgen.js with a crater of lava in its
// mountain, lakes of lava at its foot and a sea of lava round it — never a
// drop of water or ice, which would only boil away — and the one dragon,
// asleep on the volcano, wild and nobody's to send away (dragon.test.js).
// Lava is swum in as water is, only slower (physics.js); monsters, like
// everyone, keep out of it (monsters.js), and it burns hard (room.js), which
// melts ice put upon it into water, and boils the water away.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as B from '../public/js/shared/blocks.js';
import { ANIMAL_TYPES, CRITTER_INFO, CritterSim } from '../public/js/shared/critters.js';
import { LAVA_BUMPS, BUMP_HP, maxHp, MonsterSim, MONSTER_KINDS } from '../public/js/shared/monsters.js';
import { makeBody, stepBody } from '../public/js/shared/physics.js';
import { PROTOCOL, Room } from '../public/js/shared/room.js';
import { generate, THEMES } from '../public/js/shared/worldgen.js';
import { naturalGround, RUMBLE_MS, SPLASH_COOL_MS, SPLASH_HOT_MS } from '../public/js/shared/volcano.js';
import { CHAPTERS } from '../public/js/shared/isle-story.js';
import { World } from '../public/js/shared/world.js';

const SEEDS = [1, 7, 42, 777, 12345, 999999];

function countBlocks(world, id) {
  let n = 0;
  for (const cell of world.blocks) if (cell === id) n++;
  return n;
}
test('a volcano island can be made, with lava and basalt and never water or ice', () => {
  assert.ok(THEMES.some((t) => t.key === 'volcano'));
  for (const seed of SEEDS) {
    const { world } = generate({ seed, theme: 'volcano' });
    assert.ok(countBlocks(world, B.LAVA) > 500, 'a sea, a crater and lakes of lava');
    assert.ok(countBlocks(world, B.BASALT) > 1000, 'volcano rock');
    assert.equal(countBlocks(world, B.WATER), 0, 'no water');
    assert.equal(countBlocks(world, B.ICE), 0, 'no ice');
  }
});

test('a volcano island rises out of a sea of lava, and its mountain holds a crater of it', () => {
  for (const seed of SEEDS) {
    const { world } = generate({ seed, theme: 'volcano' });
    // Lava at the sea line, away from the island.
    let shore = false;
    for (let x = 0; x < world.W && !shore; x += 7) {
      if (world.get(x, world.sea, 3) === B.LAVA || world.get(x, world.sea, world.D - 4) === B.LAVA) shore = true;
    }
    assert.ok(shore, 'the sea round it is lava');
    // Lava high up the mountain, in the crater.
    let crater = false;
    for (let x = 0; x < world.W && !crater; x++) {
      for (let z = 0; z < world.D && !crater; z++) {
        for (let y = world.sea + 12; y < world.H; y++) {
          if (world.get(x, y, z) === B.LAVA) {
            crater = true;
            break;
          }
        }
      }
    }
    assert.ok(crater, 'lava in the crater');
  }
});

test('everyone arrives on solid ground, with never lava right beside the start', () => {
  for (const seed of SEEDS) {
    const { world } = generate({ seed, theme: 'volcano' });
    const { x, y, z } = world.spawn;
    assert.ok(B.SOLID[world.get(Math.floor(x), Math.floor(y) - 1, Math.floor(z))], 'stands on something solid');
    let near = false;
    for (let dx = -3; dx <= 3; dx++) {
      for (let dz = -3; dz <= 3; dz++) {
        for (let dy = -2; dy <= 2; dy++) {
          if (world.get(Math.floor(x) + dx, Math.floor(y) + dy, Math.floor(z) + dz) === B.LAVA) near = true;
        }
      }
    }
    assert.ok(!near, 'no lava within three blocks');
  }
});

test('every volcano island has exactly one dragon, asleep near the crater; no other island has any', () => {
  for (const seed of SEEDS) {
    const made = generate({ seed, theme: 'volcano' });
    const dragons = made.critters.filter((c) => c.type === 'dragon');
    assert.equal(dragons.length, 1, 'the one dragon');
    const d = dragons[0];
    assert.ok(d.y > made.world.sea + 4, 'up on the volcano');
    // Nothing else that swims or lives in the sea: the sea is lava.
    for (const c of made.critters) assert.ok(!CRITTER_INFO[c.type].sea, `${c.type} does not live in lava`);
  }
  for (const theme of ['sunny', 'snowy', 'candy']) {
    const { critters } = generate({ seed: 5, theme });
    assert.equal(critters.filter((c) => c.type === 'dragon').length, 0, `${theme} has no dragon`);
  }
});

test('the dragon is wild: not among the animals anyone may invite (only those who tamed it, dragon.test.js)', () => {
  assert.ok(CRITTER_INFO.dragon.wild, 'wild');
  assert.ok(!ANIMAL_TYPES.includes('dragon'), 'not among the animals to invite');
});

test('lava is swum in, as water is, and slower — and you can climb back out', () => {
  // A lava pool three deep in a stone bowl, with ground beside it.
  const w = new World({ W: 16, H: 16, D: 16, sea: 1 });
  for (let x = 0; x < 16; x++) for (let z = 0; z < 16; z++) for (let y = 0; y <= 5; y++) w.set(x, y, z, B.STONE);
  for (let x = 5; x <= 9; x++) for (let z = 5; z <= 9; z++) {
    w.set(x, 5, z, B.AIR);
    w.set(x, 4, z, B.AIR);
    w.set(x, 3, z, B.AIR);
    w.set(x, 2, z, B.LAVA);
    w.set(x, 3, z, B.LAVA);
    w.set(x, 4, z, B.LAVA);
  }
  const b = makeBody(7.5, 2, 7.5);
  for (let i = 0; i < 60; i++) stepBody(w, b, { mx: 0, mz: 0 }, 1 / 30, {});
  assert.ok(b.inLava, 'in the lava');
  assert.ok(b.y > 3, `floats at the surface of it, not on the bottom (y ${b.y.toFixed(2)})`);
  // Jump kicks you up out of it, and you can climb onto the bank.
  const out = makeBody(7.5, 4.5, 7.5);
  let escaped = false;
  for (let i = 0; i < 240 && !escaped; i++) {
    stepBody(w, out, { mx: 0, mz: 1, jump: true }, 1 / 30, {});
    if (!out.inLava && out.z > 10) escaped = true;
  }
  assert.ok(escaped, `climbs out onto the bank (z ${out.z.toFixed(2)})`);
});

test('monsters keep out of the lava, and one that falls in is gone', () => {
  const w = new World({ W: 32, H: 16, D: 32, sea: 1 });
  for (let x = 0; x < 32; x++) for (let z = 0; z < 32; z++) for (let y = 0; y <= 5; y++) w.set(x, y, z, y === 5 ? B.GRASS : B.STONE);
  for (let x = 10; x <= 20; x++) for (let z = 10; z <= 20; z++) {
    w.set(x, 5, z, B.AIR);
    w.set(x, 4, z, B.LAVA);
  }
  const sim = new MonsterSim(3);
  const m = sim.add(MONSTER_KINDS.indexOf('blob'), 15.5, 4, 15.5);
  assert.ok(m, 'a monster in the lava');
  for (let i = 0; i < 50; i++) sim.step(w, 0.1, i * 100, [], false, { roam: true, havens: [], camps: null });
  assert.ok(!sim.get(m.id), 'gone');
});

test('the mesher draws lava in a part of its own, like water', async () => {
  const { meshChunk } = await import('../public/js/render/mesher.js');
  const visuals = { faceLayer: new Int16Array(256 * 3), tint: new Uint8Array(256 * 3).fill(255), studTint: new Uint8Array(256 * 3).fill(200) };
  const w = new World({ W: 16, H: 16, D: 16, sea: 1, theme: 'volcano' });
  w.set(8, 5, 8, B.LAVA);
  const mesh = meshChunk(w, { skyAt: () => 15, lampAt: () => 0 }, visuals, 0, 0);
  assert.ok(mesh.lava.idx.length >= 12, 'faces of lava');
  assert.equal(mesh.water.idx.length, 0, 'and none of them counted as water');
});

// -------------------------------------------------------------- the host's half

function clock(start = 1_000_000) {
  const c = { t: start };
  c.now = () => c.t;
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

function join(room, name = 'Brave Dragon') {
  const c = conn();
  room.attach(c);
  room.receive(c, { t: 'join', protocol: PROTOCOL, name, look: { animal: 'cat', fur: 'orange', shirt: 3, hat: 'cap' } });
  return c;
}

// A little volcano island that is quick to make and easy to know: basalt at
// y 10, a pool of lava (11-12) in the middle of it, and everyone arriving
// safely to one side.
function volcanoRoom() {
  const time = clock();
  const room = new Room({ code: '123456', theme: 'volcano', seed: 7, now: time.now, settings: {} });
  const w = new World({ W: 48, H: 32, D: 48, sea: 4, theme: 'volcano', spawn: { x: 10.5, y: 11, z: 24.5 } });
  for (let x = 0; x < 48; x++) {
    for (let z = 0; z < 48; z++) {
      w.set(x, 0, z, B.MAGIC_FLOOR);
      for (let y = 1; y <= 10; y++) w.set(x, y, z, y === 10 ? B.BASALT : B.STONE);
    }
  }
  for (let x = 20; x <= 27; x++) for (let z = 20; z <= 27; z++) {
    w.set(x, 11, z, B.LAVA);
    w.set(x, 12, z, B.LAVA);
  }
  room.world = w;
  room.critters.list.length = 0;
  room.hookWorld();
  return { room, time };
}

// Stands at (x, y, z) while the ticks go by, as a page sends where it is.
function standFor(room, time, c, [x, y, z], ms) {
  for (let t = 0; t < ms; t += 100) {
    time.t += 100;
    room.receive(c, { t: 'm', s: [x, y, z, 0, 0, 0] });
    room.tick();
  }
}

test('standing in lava burns much more than a bump, again and again while you stay in it', () => {
  const { room, time } = volcanoRoom();
  const a = join(room);
  const full = a.last('welcome').hp;
  assert.equal(full, maxHp(1));
  standFor(room, time, a, [23.5, 11.5, 23.5], 100);
  const burns = a.all('bump').filter((m) => m.lava);
  assert.equal(burns.length, 1, 'one hit for one safe moment');
  assert.equal(burns[0].hp, full - LAVA_BUMPS * BUMP_HP, 'much more than a monster bump');
  assert.equal(burns[0].lava, true);
  // Staying in: another, after the safe moment. Out of it: no more.
  standFor(room, time, a, [23.5, 11.5, 23.5], 2000);
  assert.ok(a.all('bump').filter((m) => m.lava).length >= 2, 'it keeps burning');
  const burnsNow = a.all('bump').filter((m) => m.lava).length;
  standFor(room, time, a, [10.5, 11, 24.5], 3000);
  assert.equal(a.all('bump').filter((m) => m.lava).length, burnsNow, 'out of the lava, it stops');
  // HP comes back by itself, on an island with no monsters at all.
  const low = a.last('hp')?.hp ?? burns.at(-1).hp;
  standFor(room, time, a, [10.5, 11, 24.5], 20000);
  assert.ok((a.last('hp')?.hp ?? low) > low, 'HP comes back with no monsters about');
});

test('lava takes you all the way home when there is nothing left, and never on another island', () => {
  const { room, time } = volcanoRoom();
  const a = join(room);
  for (let gone = 0; gone < 4; gone++) {
    standFor(room, time, a, [23.5, 11.5, 23.5], 2000);
  }
  const home = a.all('bump').filter((m) => m.lava).find((m) => m.home);
  assert.ok(home, 'sent home out of HP');
  assert.equal(home.hp, home.max, 'with all of it again');
  // The same standing in lava on a sunny island burns nobody.
  const time2 = clock();
  const sunny = new Room({ code: '654321', theme: 'sunny', seed: 7, now: time2.now, settings: {} });
  const w = sunny.world;
  const sx = Math.floor(w.spawn.x);
  const sz = Math.floor(w.spawn.z);
  for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) {
    w.set(sx + dx, Math.floor(w.spawn.y) - 1, sz + dz, B.LAVA);
    w.set(sx + dx, Math.floor(w.spawn.y), sz + dz, B.LAVA);
  }
  const b = join(sunny);
  const at = [w.spawn.x, w.spawn.y - 0.5, w.spawn.z];
  for (let t = 0; t < 3000; t += 100) {
    time2.t += 100;
    sunny.receive(b, { t: 'm', s: at });
    sunny.tick();
  }
  assert.equal(b.all('bump').length, 0, 'lava put on another island burns nobody');
});

test('water put on a volcano island boils away, and ice melts into water that boils away in turn', () => {
  const { room, time } = volcanoRoom();
  const a = join(room);
  room.receive(a, { t: 'edit', kind: 'build', seq: 1, cells: [14, 11, 24, B.WATER, 15, 11, 24, B.ICE] });
  assert.equal(room.world.get(14, 11, 24), B.WATER);
  assert.equal(room.world.get(15, 11, 24), B.ICE);
  // Before its time: nothing happens.
  standFor(room, time, a, [10.5, 11, 24.5], 4000);
  assert.equal(room.world.get(14, 11, 24), B.WATER, 'not just yet');
  assert.equal(room.world.get(15, 11, 24), B.ICE);
  // Ice melts to water first, water boils to nothing, everyone told.
  standFor(room, time, a, [10.5, 11, 24.5], 8000);
  assert.equal(room.world.get(15, 11, 24), B.WATER, 'ice melts');
  const steam = a.all('edit').filter((m) => m.kind === 'nature').map((m) => m.cells);
  assert.ok(steam.some((cells) => cells.includes(B.WATER)), 'the melting was sent to everyone');
  standFor(room, time, a, [10.5, 11, 24.5], 14000);
  assert.equal(room.world.get(14, 11, 24), B.AIR, 'water boils away');
  assert.equal(room.world.get(15, 11, 24), B.AIR, 'the melt did too');
  // What somebody built where the water was: the melt leaves it alone.
  room.receive(a, { t: 'edit', kind: 'build', seq: 2, cells: [16, 11, 24, B.WATER] });
  standFor(room, time, a, [10.5, 11, 24.5], 6000);
  room.receive(a, { t: 'edit', kind: 'build', seq: 3, cells: [16, 11, 24, B.PLANKS] });
  standFor(room, time, a, [10.5, 11, 24.5], 12000);
  assert.equal(room.world.get(16, 11, 24), B.PLANKS, 'built over before it boiled');
});

test('water stays put on any other island', () => {
  const time = clock();
  const room = new Room({ code: '123456', theme: 'sunny', seed: 7, now: time.now, settings: {} });
  const a = join(room);
  const x = Math.floor(room.world.spawn.x) + 2;
  const z = Math.floor(room.world.spawn.z);
  const y = room.world.top(x, z) + 1;
  room.receive(a, { t: 'edit', kind: 'build', seq: 1, cells: [x, y, z, B.WATER, x, y + 1, z, B.ICE] });
  standFor(room, time, a, [room.world.spawn.x, room.world.spawn.y, room.world.spawn.z], 30000);
  assert.equal(room.world.get(x, y, z), B.WATER, 'no boiling there');
  assert.equal(room.world.get(x, y + 1, z), B.ICE, 'no melting either');
});

// --------------------------------------------------------- the eruptions

// Steps the room on for ms, in the host's own moment (a tick every 100),
// watching what it tells everyone.
function runFor(room, time, ms) {
  for (let t = 0; t < ms; t += 100) {
    time.t += 100;
    room.tick();
  }
}

// The first eruption comes of its own accord, sooner or later: this runs
// the clock on until one starts (or gives up), and says when it did.
function erupts(room, time, limit = 400000) {
  for (let t = 0; t < limit; t += 100) {
    time.t += 100;
    room.tick();
    if (room.volcano.going) return time.t;
  }
  return null;
}

test('the crater erupts of its own accord every few minutes: a rumble, then the blow, then bombs out of it', () => {
  const { room, time } = volcanoRoom();
  const a = join(room);
  // Nothing for a good while first: nobody steps onto the island to be met
  // with an eruption already at them.
  runFor(room, time, 60000);
  assert.equal(a.all('vfx').length, 0, 'quiet at first');
  assert.ok(!room.volcano.going);
  const at = erupts(room, time);
  assert.ok(at, 'erupts before too long');
  assert.ok(at >= 100000, `not before a couple of minutes (${at})`);
  const started = a.all('vfx').find((m) => m.kind === 'start');
  assert.ok(started, 'everyone told it is starting');
  assert.deepEqual(started.at, [room.volcano.crater.x, room.volcano.crater.y, room.volcano.crater.z], 'from the crater');
  // The rumble rises first, and only then does it blow.
  runFor(room, time, RUMBLE_MS + 100);
  const kinds = a.all('vfx').map((m) => m.kind);
  assert.ok(kinds.indexOf('blow') > kinds.indexOf('start'), 'the rumble before the blow');
  // Then the bombs come out, each on its way to somewhere natural.
  runFor(room, time, 4000);
  const bombs = a.all('vfx').filter((m) => m.kind === 'bomb');
  assert.ok(bombs.length > 0, 'lava bombs out of the crater');
  for (const b of bombs) {
    assert.equal(b.t, 'vfx');
    const [fx, fy, fz] = b.to;
    assert.ok(naturalGround(room.world, Math.floor(fx), Math.floor(fy) - 1, Math.floor(fz)), 'each lands on natural ground');
  }
});

test('each bomb bursts where it lands, and its splash cools away within the minute', () => {
  const { room, time } = volcanoRoom();
  const a = join(room);
  erupts(room, time);
  runFor(room, time, 4000 + 20000);
  const splashes = a.all('vfx').filter((m) => m.kind === 'splash');
  assert.ok(splashes.length > 0, 'bombs burst where they land');
  assert.ok(splashes.every((m) => m.keep === SPLASH_COOL_MS), 'each splash lasts as long as it cools');
  // While the show is on, the splashes are there; once they have cooled,
  // everyone is told, and none is left.
  assert.ok(room.volcano.splashes.size > 0, 'splashes lying about');
  runFor(room, time, SPLASH_COOL_MS + 1000);
  assert.equal(room.volcano.splashes.size, 0, 'all cooled away');
  const cooled = a.all('vfx').filter((m) => m.kind === 'cool');
  assert.equal(cooled.length, splashes.length, 'each cooling told to everyone');
  // Nothing at all is in the world: no trace of any of it.
  let changed = 0;
  for (let x = 0; x < room.world.W; x++) for (let z = 0; z < room.world.D; z++) {
    if (room.world.get(x, 11, z) !== B.LAVA) changed++;
  }
  assert.equal(changed, 48 * 48 - 64, 'the world as it was made');
});

test('a room opened again shows no trace of an eruption, and other islands never erupt', () => {
  const { room, time } = volcanoRoom();
  const a = join(room);
  erupts(room, time);
  runFor(room, time, 30000);
  // What a latecomer is told as they come in: nothing, unless one is going
  // right now — and even then, no splash of it is handed over.
  const again = join(room, 'Late Dragon');
  const told = again.last('welcome').volcano;
  assert.ok(!told || told.phase !== 'rumble' || Array.isArray(told.at), 'at most the show going now');
  // An island of another theme never erupts at all, however long it waits.
  const time2 = clock();
  const sunny = new Room({ code: '654321', theme: 'sunny', seed: 7, now: time2.now, settings: {} });
  const b = join(sunny);
  for (let t = 0; t < 400000; t += 100) {
    time2.t += 100;
    sunny.tick();
  }
  assert.equal(b.all('vfx').length, 0, 'no eruptions on a sunny island');
  assert.ok(!sunny.volcano.going);
});

test('no bomb bursts on anything built, planted or furnished, and no splash sits under a build', () => {
  const w = new World({ W: 16, H: 16, D: 16, sea: 1, theme: 'volcano' });
  for (let x = 0; x < 16; x++) for (let z = 0; z < 16; z++) w.set(x, 5, z, B.BASALT);
  // Natural ground takes a bomb; what somebody built, planted or furnished
  // does not, and nor does ground with anything of anybody's over it.
  assert.ok(naturalGround(w, 3, 5, 3), 'bare basalt');
  for (const id of [B.PLANKS, B.BRICK, B.GLASS, B.TULIP, B.OAK_SPROUT, B.POTTED_PLANT, B.WATERING_CAN]) {
    w.set(5, 5, 5, id);
    assert.equal(naturalGround(w, 5, 5, 5), false, `${B.block(id).name} is not ground to burst on`);
    w.set(5, 5, 5, B.BASALT);
  }
  w.set(7, 6, 7, B.PLANKS);
  assert.equal(naturalGround(w, 7, 5, 7), false, 'something built over it');
  w.set(7, 6, 7, B.AIR);
  assert.ok(naturalGround(w, 7, 5, 7), 'clear again');
  // And the crater itself, where the lava sits: ground of its own.
  w.set(9, 5, 9, B.LAVA);
  assert.ok(naturalGround(w, 9, 5, 9), 'lava is ground of its own');
});

test('standing in a splash while it is hot burns like lava, halved by Knight Armor and stopped by a Fire Suit', () => {
  const { room, time } = volcanoRoom();
  const bare = join(room, 'Bare');
  const knight = join(room, 'Knight');
  room.receive(knight, { t: 'look', look: { animal: 'cat', fur: 'orange', shirt: 3, hat: 'cap', outfit: 'armor' } });
  const suit = join(room, 'Suit');
  room.receive(suit, { t: 'look', look: { animal: 'cat', fur: 'orange', shirt: 3, hat: 'cap', outfit: 'firesuit' } });
  // A splash straight away, on the basalt away from the lava.
  const where = [30.5, 11, 30.5];
  const s = room.volcano.splashAt(...where, time.t);
  assert.ok(s, 'a splash down on the basalt');
  for (const [c, spot] of [[bare, where], [knight, where], [suit, where]]) {
    room.receive(c, { t: 'm', s: [...spot, 0, 0, 0] });
  }
  room.tick();
  const burn = (c, pid) => c.all('bump').filter((m) => m.lava && m.pid === pid).pop();
  const ids = new Map([...room.players.values()].map((p) => [p.name, p.id]));
  assert.equal(burn(bare, ids.get('Bare')).hp, burn(bare, ids.get('Bare')).max - LAVA_BUMPS * BUMP_HP, 'the full burn for bare skin');
  assert.equal(burn(knight, ids.get('Knight')).hp, burn(knight, ids.get('Knight')).max - (LAVA_BUMPS / 2) * BUMP_HP, 'half of it in Knight Armor');
  assert.equal(burn(suit, ids.get('Suit')), undefined, 'nothing at all in a Fire Suit');
  // Once it has cooled, standing there does nothing.
  time.t += SPLASH_HOT_MS + 100;
  const pid = ids.get('Bare');
  const before = bare.all('bump').filter((m) => m.lava && m.pid === pid).length;
  for (let t = 0; t < 2000; t += 100) {
    time.t += 100;
    room.receive(bare, { t: 'm', s: [...where, 0, 0, 0] });
    room.tick();
  }
  assert.equal(bare.all('bump').filter((m) => m.lava && m.pid === pid).length, before, 'a cooled splash burns nobody');
});

test('riding anything you are up out of a splash, and Adventure Isle\'s volcano never erupts', () => {
  const { room, time } = volcanoRoom();
  const rider = join(room, 'Rider');
  const pid = [...room.players.values()].find((p) => p.name === 'Rider').id;
  const where = [30.5, 11, 30.5];
  assert.ok(room.volcano.splashAt(...where, time.t), 'a splash down on the basalt');
  const pony = room.critters.add('pony', ...where);
  room.critters.ride(pony.id, pid);
  room.receive(rider, { t: 'm', s: [...where, 0, 6, 0] });
  room.tick();
  assert.equal(rider.all('bump').filter((m) => m.lava && m.pid === pid).length, 0, 'no burn up on a pony');
  // The isle's Ember Mountain is a volcano too, but its stage is the story's.
  const stage = CHAPTERS.findIndex((c) => c.theme === 'volcano') + 1;
  assert.ok(stage > 0);
  const isle = new Room({ code: '515151', adventure: true, shared: true, stage, seed: 9, now: time.now });
  assert.equal(isle.world.theme, 'volcano');
  assert.equal(isle.volcano, null, 'no eruptions on the isle');
  // A splash burns only those on it, as far as its glow reaches (game.js
  // stepVolcanoFx draws it about a block round), not anyone beside it.
  const v = volcanoRoom().room.volcano;
  const sp = v.splashAt(30.5, 11, 30.5, 0);
  assert.ok(v.burning(sp.x + 0.5, 11, sp.z + 0.5, 1), 'on it');
  assert.ok(v.burning(sp.x + 1.3, 11, sp.z + 0.5, 1), 'at its edge');
  assert.ok(!v.burning(sp.x + 2, 11, sp.z + 0.5, 1), 'beside it, a step and a half off its middle');
  for (let t = 0; t < 400; t++) {
    time.t += 1000;
    isle.tick();
  }
});

test('ten cozy houses stamped on a volcano island earn the Pompeii sticker, and the count travels with a login', async () => {
  const { STAT_KEYS, STICKERS } = await import('../public/js/shared/stickers.js');
  const sticker = STICKERS.find((s) => s.key === 'pompeii');
  assert.ok(sticker, 'the sticker is there');
  assert.equal(sticker.icon, '🌋');
  assert.ok(sticker.name && sticker.text, 'says what it is');
  assert.ok(STAT_KEYS.includes('volcanohouses'), 'the count the game keeps');
  assert.equal(sticker.goal, 10, 'shows how far there is to go');
  // Only the tenth house does it, as any other island's houses do not.
  const stats = (n) => Object.fromEntries(STAT_KEYS.map((k) => [k, k === 'volcanohouses' ? n : 0]));
  assert.equal(sticker.test(stats(9)), false);
  assert.equal(sticker.test(stats(10)), true);
  // Counting it on a profile earns the sticker, which the keeper keeps.
  const store = new Map();
  globalThis.localStorage = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k), key: (i) => [...store.keys()][i] ?? null, get length() { return store.size; } };
  try {
    const { Profile } = await import('../public/js/profile.js');
    const p = new Profile();
    const earned = [];
    p.addEventListener('sticker', (e) => earned.push(e.detail.key));
    for (let i = 0; i < 9; i++) p.count('volcanohouses');
    assert.deepEqual(earned, [], 'nine houses are not enough');
    p.count('volcanohouses');
    assert.deepEqual(earned, ['pompeii'], 'the tenth earns it');
    assert.equal(p.data.stats.volcanohouses, 10);
    const { keptProfile } = await import('../public/js/shared/keeper.js');
    const kept = keptProfile(p.data);
    assert.equal(kept.stats.volcanohouses, 10, 'the count comes along');
    assert.ok(kept.stickers.pompeii, 'and so does the sticker');
  } finally {
    delete globalThis.localStorage;
  }
});
