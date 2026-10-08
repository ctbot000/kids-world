// Tower defense islands: a road of pebbles from the monsters' gate, far
// across the island, to the Star Stone by the start, with pads for towers
// beside it, on every kind and size of island; built on top of the island
// as it would be without; waves marching along the road when Start is
// pressed, towers blowing bubbles at them and bricks for every one popped;
// a monster at the Star Stone taking its hearts, and the wave tried again
// once they are gone; the road kept clear; and all of it kept when saved,
// on the list of open islands, and a game a player who builds can win.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as B from '../public/js/shared/blocks.js';
import { BUILD_REACH, LEAK, MAX_LEVEL, START_BRICKS, START_MS, STONE_BACK, STONE_HEARTS, TOWER, TOWER_COST, towerCells, waveBricks, waveOf, WAVES } from '../public/js/shared/defense.js';
import { cleanListing } from '../public/js/shared/listing.js';
import { unpackMonster } from '../public/js/shared/monsters.js';
import { PROTOCOL, Room } from '../public/js/shared/room.js';
import { generate, SIZES, THEMES } from '../public/js/shared/worldgen.js';

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

function join(room, name = 'Happy Panda') {
  const c = conn();
  room.attach(c);
  room.receive(c, { t: 'join', protocol: PROTOCOL, name, look: { animal: 'cat', fur: 'orange', shirt: 3, hat: 'cap' } });
  c.pid = c.last('welcome').you;
  return c;
}

function defenseRoom(seed = 2, size = 'small', theme = 'sunny') {
  const time = clock();
  const room = new Room({ code: '123456', theme, size, seed, defense: true, now: time.now });
  return { room, time };
}

const marchers = (room) => room.monsters.list.filter((m) => m.march);

// Steps the room for ms, a tenth of a second at a time.
function play(room, time, ms) {
  for (let t = 0; t < ms; t += 100) {
    time.t += 100;
    room.tick();
  }
}

// Stands c by a pad and builds on it.
function build(room, c, pad) {
  room.receive(c, { t: 'm', s: [pad.x + 1.5, pad.y, pad.z, 0, 0, 0] });
  room.receive(c, { t: 'defend', cmd: 'build', pad: pad.id });
}

test('a tower defense island has a road from the monsters’ gate to the Star Stone, with pads for towers beside it', () => {
  for (const size of SIZES) {
    for (const theme of THEMES) {
      for (const seed of [11, 4242]) {
        const label = `${theme.key} ${size.key} island ${seed}`;
        const { world, defense } = generate({ seed, theme: theme.key, size: size.key, defense: true });
        assert.ok(defense, label);
        const { path, pads, stone, gate } = defense;
        const spawn = world.spawn;
        // From the gate, far from the start, to just off the Star Stone, near it.
        assert.ok(Math.hypot(gate.x - spawn.x, gate.z - spawn.z) > world.W / 4, `${label}: the gate is far off`);
        assert.ok(Math.hypot(stone.x - spawn.x, stone.z - spawn.z) < 8, `${label}: the Star Stone is by the start`);
        assert.deepEqual([path[0][0] + 0.5, path[0][2] + 0.5], [gate.x, gate.z], `${label}: from the gate`);
        const [ex, , ez] = path.at(-1);
        assert.ok(Math.max(Math.abs(ex + 0.5 - stone.x), Math.abs(ez + 0.5 - stone.z)) <= 3, `${label}: to the Star Stone`);
        assert.equal(world.get(Math.floor(stone.x), stone.y, Math.floor(stone.z)), B.STAR_BLOCK, `${label}: its star blocks`);
        for (let i = 0; i < path.length; i++) {
          const [x, y, z] = path[i];
          // A step at a time, never more than a block up or down, on pebbles with room over them.
          if (i) {
            const [px, py, pz] = path[i - 1];
            assert.equal(Math.abs(x - px) + Math.abs(z - pz), 1, `${label}: step ${i}`);
            assert.ok(Math.abs(y - py) <= 1, `${label}: step ${i} up ${y - py}`);
          }
          assert.equal(world.get(x, y - 1, z), B.PEBBLES, `${label}: pebbles at ${i}`);
          for (let dy = 0; dy < 3; dy++) assert.ok(!B.SOLID[world.get(x, y + dy, z)] && world.get(x, y + dy, z) !== B.WATER, `${label}: room over ${i}`);
          assert.ok(Math.hypot(x + 0.5 - spawn.x, z + 0.5 - spawn.z) > 3, `${label}: the road keeps off the start`);
        }
        // Pads: wooden floors beside the road, not on it, each in reach of it.
        assert.ok(pads.length >= 8, `${label}: ${pads.length} pads`);
        for (const p of pads) {
          for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) assert.equal(world.get(Math.floor(p.x) + dx, p.y - 1, Math.floor(p.z) + dz), B.PLANKS, `${label}: pad ${p.id}`);
          for (let dy = 0; dy < 8; dy++) assert.equal(world.get(Math.floor(p.x), p.y + dy, Math.floor(p.z)), B.AIR, `${label}: room over pad ${p.id}`);
          const near = Math.min(...path.map(([x, , z]) => Math.hypot(x + 0.5 - p.x, z + 0.5 - p.z)));
          assert.ok(near >= 2.5 && near <= TOWER[1].range - 1, `${label}: pad ${p.id} is ${near} from the road`);
        }
      }
    }
  }
});

test('everything but the road comes out just as it would on the island without it', () => {
  for (const theme of THEMES) {
    const plain = generate({ seed: 77, theme: theme.key, size: 'small' });
    const made = generate({ seed: 77, theme: theme.key, size: 'small', defense: true });
    assert.equal(plain.defense, null);
    const w = made.world;
    const { path, pads, stone, gate } = made.defense;
    const marks = [...path.map(([x, , z]) => [x + 0.5, z + 0.5]), ...pads.map((p) => [p.x, p.z]), [stone.x, stone.z], [gate.x, gate.z]];
    let same = 0;
    for (let x = 0; x < w.W; x++) {
      for (let z = 0; z < w.D; z++) {
        if (marks.some(([mx, mz]) => Math.hypot(mx - x - 0.5, mz - z - 0.5) < 10)) continue;
        for (let y = 0; y < w.H; y++) assert.equal(w.get(x, y, z), plain.world.get(x, y, z), `${theme.key} at ${x}, ${y}, ${z}`);
        same++;
      }
    }
    assert.ok(same > w.W * w.D * 0.3, `${theme.key}: most of it (${same} columns) as it was`);
    // Adventure islands have no road.
    assert.equal(generate({ seed: 77, theme: theme.key, size: 'small', adventure: true, defense: true }).defense, null);
  }
});

test('Start sends a wave along the road, and one at the Star Stone takes its hearts; out of hearts, the wave is tried again', () => {
  const { room, time } = defenseRoom();
  const a = join(room);
  const def = room.defense;
  assert.equal(a.last('welcome').defense.pads.length, def.pads.length);
  assert.equal(def.state, 'ready');
  assert.equal(def.bricks, START_BRICKS);
  play(room, time, 5000);
  assert.equal(marchers(room).length, 0, 'nothing comes until Start');
  room.receive(a, { t: 'defend', cmd: 'start' });
  assert.equal(a.last('dwave').k, 'start');
  play(room, time, START_MS + 200);
  assert.equal(marchers(room).length, 1, 'out of the gate');
  const first = marchers(room)[0];
  assert.ok(Math.hypot(first.body.x - def.gate.x, first.body.z - def.gate.z) < 2);
  // It hops along the road, all the way, and bumps nobody on the way.
  room.receive(a, { t: 'm', s: [def.route[5].x, def.route[5].y, def.route[5].z, 0, 0, 0] });
  let leaked = 0;
  let along = 0;
  for (let t = 0; t < 120000 && !leaked; t += 100) {
    time.t += 100;
    room.tick();
    if (room.monsters.get(first.id)) along = Math.max(along, first.along);
    leaked = a.all('leak').length;
  }
  assert.equal(a.all('bump').length, 0, 'marching monsters bump nobody');
  assert.equal(leaked, 1, 'one got to the Star Stone');
  assert.equal(a.last('leak').id, first.id);
  assert.equal(a.last('leak').hearts, STONE_HEARTS - LEAK.blob);
  assert.ok(along > def.route.length - 3, `it came all the way (${along} of ${def.route.length})`);
  // With no towers, the rest get there too, and the wave is still seen
  // off, with a couple of hearts back for it...
  const wave = waveOf(1, 1);
  const finish = () => {
    for (let t = 0; t < 200000 && def.state === 'march'; t += 100) {
      time.t += 100;
      room.tick();
    }
  };
  finish();
  assert.equal(def.state, 'ready');
  assert.equal(def.wave, 2);
  assert.equal(def.hearts, STONE_HEARTS - wave.blobs * LEAK.blob + STONE_BACK);
  // ...but the next wave takes the rest: its monsters gone, the Star Stone
  // full again, and that wave to try again.
  room.receive(a, { t: 'defend', cmd: 'start' });
  finish();
  assert.equal(a.last('dwave').k, 'lost');
  assert.equal(def.state, 'ready');
  assert.equal(def.wave, 2, 'the same wave again');
  assert.equal(def.hearts, STONE_HEARTS);
  assert.equal(marchers(room).length, 0);
  assert.equal(room.monsters.list.length, 0);
});

test('a tower built by a pad blows bubbles at the monsters, and popping them brings bricks', () => {
  const { room, time } = defenseRoom();
  const a = join(room);
  const def = room.defense;
  // Far from a pad: nothing happens.
  const pad = def.pads[0];
  room.receive(a, { t: 'm', s: [pad.x + BUILD_REACH + 3, pad.y, pad.z, 0, 0, 0] });
  room.receive(a, { t: 'defend', cmd: 'build', pad: pad.id });
  assert.equal(pad.level, 0, 'too far to build');
  build(room, a, pad);
  assert.equal(pad.level, 1);
  assert.equal(def.bricks, START_BRICKS - TOWER_COST[1]);
  assert.equal(a.last('tower').pad, pad.id);
  // Its blocks are there, and everyone heard of them.
  const cells = towerCells(pad, 1);
  for (let i = 0; i < cells.length; i += 4) assert.equal(room.world.get(cells[i], cells[i + 1], cells[i + 2]), cells[i + 3]);
  assert.deepEqual(a.last('edit').cells, cells);
  // Not enough bricks for the next level: a word about it, and nothing more.
  build(room, a, pad);
  assert.equal(pad.level, 1);
  assert.match(a.last('notice').text, /bricks/);
  room.receive(a, { t: 'defend', cmd: 'start' });
  const bricks = def.bricks;
  for (let t = 0; t < 200000 && def.state === 'march'; t += 100) {
    time.t += 100;
    room.tick();
  }
  const zaps = a.all('zap').flatMap((m) => m.z);
  assert.ok(zaps.length > 0, 'it blew bubbles');
  assert.ok(zaps.every(([p]) => p === pad.id));
  const pops = a.all('pop').filter((m) => m.by === 0);
  assert.ok(pops.length > 0, 'and popped some');
  assert.equal(def.state, 'ready');
  if (def.wave === 2) {
    assert.equal(a.last('dwave').k, 'clear');
    assert.equal(def.bricks, bricks + pops.length + waveBricks(1));
  }
  assert.equal(a.last('def').b, def.bricks);
  // Bigger, a level at a time, to the top.
  def.bricks = 100;
  for (let l = 2; l <= MAX_LEVEL + 1; l++) build(room, a, pad);
  assert.equal(pad.level, MAX_LEVEL);
  assert.equal(def.bricks, 100 - TOWER_COST[2] - TOWER_COST[3]);
});

test('friends pop marching monsters too, with bricks for each', () => {
  const { room, time } = defenseRoom();
  const a = join(room);
  const def = room.defense;
  room.receive(a, { t: 'defend', cmd: 'start' });
  play(room, time, START_MS + 200);
  const m = marchers(room)[0];
  const hearts = m.hearts;
  assert.equal(hearts, waveOf(1).hearts);
  let taps = 0;
  for (let t = 0; t < 10000 && room.monsters.get(m.id); t += 100) {
    room.receive(a, { t: 'm', s: [m.body.x + 1, m.body.y, m.body.z, 0, 0, 0] });
    room.receive(a, { t: 'bop', id: m.id });
    time.t += 100;
    room.tick();
    taps++;
  }
  assert.equal(room.monsters.get(m.id), null, 'popped');
  assert.equal(a.all('mhit').filter((h) => h.id === m.id && h.march).length, hearts - 1);
  const pop = a.all('pop').find((p) => p.id === m.id);
  assert.equal(pop.by, a.pid);
  assert.equal(def.bricks, START_BRICKS + 1);
  // Landing on one takes three of its hearts at once.
  play(room, time, 2000);
  const n = marchers(room)[0];
  const before = n.hearts;
  room.receive(a, { t: 'm', s: [n.body.x, n.body.y + n.body.height, n.body.z, 0, 0, 0] });
  room.receive(a, { t: 'bop', id: n.id, on: true });
  assert.equal(n.hearts, Math.max(0, before - 3));
});

test('the road, the pads and the Star Stone cannot be built on or dug up, but the rest of the island can', () => {
  const { room } = defenseRoom();
  const a = join(room);
  const def = room.defense;
  const [x, y, z] = def.path[10];
  room.receive(a, { t: 'edit', seq: 1, cells: [x, y, z, B.TOY_BRICKS[0]] });
  assert.equal(room.world.get(x, y, z), B.AIR, 'nothing on the road');
  assert.match(a.last('notice').text, /road/);
  room.receive(a, { t: 'edit', seq: 2, kind: 'pick', cells: [x, y - 1, z, B.AIR] });
  assert.equal(room.world.get(x, y - 1, z), B.PEBBLES, 'nor dug out of it');
  const pad = def.pads[0];
  room.receive(a, { t: 'edit', seq: 3, cells: [Math.floor(pad.x), pad.y, Math.floor(pad.z), B.TOY_BRICKS[0]] });
  assert.equal(room.world.get(Math.floor(pad.x), pad.y, Math.floor(pad.z)), B.AIR, 'nor on a pad');
  // Well away from all of it, building as ever.
  const sx = Math.floor(room.world.spawn.x) - 2;
  const sz = Math.floor(room.world.spawn.z) - 2;
  let free = null;
  for (let dx = 0; dx < 20 && !free; dx++) {
    const fx = sx - dx;
    const fy = room.world.top(fx, sz) + 1;
    if (!def.protects(fx, fy, sz) && !def.path.some(([px, , pz]) => Math.abs(px - fx) <= 2 && Math.abs(pz - sz) <= 2)) free = [fx, fy, sz];
  }
  room.receive(a, { t: 'edit', seq: 4, cells: [...free, B.TOY_BRICKS[0]] });
  assert.equal(room.world.get(...free), B.TOY_BRICKS[0]);
});

test('with nobody left on the island, a wave goes home, to come again on Start', () => {
  const { room, time } = defenseRoom();
  const a = join(room);
  const b = join(room, 'Sleepy Fox');
  room.receive(a, { t: 'defend', cmd: 'start' });
  play(room, time, START_MS + 3000);
  assert.ok(marchers(room).length > 0);
  room.receive(a, { t: 'leave' });
  play(room, time, 500);
  assert.ok(marchers(room).length > 0, 'still going with a friend there');
  room.receive(b, { t: 'leave' });
  play(room, time, 500);
  assert.equal(marchers(room).length, 0);
  assert.equal(room.defense.state, 'ready');
  assert.equal(room.defense.wave, 1);
});

test('the towers, the wave and the bricks are kept when saved, and the island is on the list of open islands', () => {
  const { room, time } = defenseRoom();
  const a = join(room);
  const def = room.defense;
  def.bricks = 20;
  build(room, a, def.pads[1]);
  build(room, a, def.pads[1]);
  def.wave = 4;
  const save = JSON.parse(JSON.stringify(room.exportSave()));
  const again = new Room({ code: '654321', save, now: time.now });
  assert.equal(again.defense.wave, 4);
  assert.equal(again.defense.bricks, 20 - TOWER_COST[1] - TOWER_COST[2]);
  assert.deepEqual(
    again.defense.pads.map((p) => p.level),
    def.pads.map((p) => p.level),
  );
  assert.deepEqual(again.defense.path, def.path);
  assert.ok(again.defense.protects(def.path[3][0], def.path[3][1], def.path[3][2]));
  const listed = cleanListing(again.listing());
  assert.deepEqual(listed.defense, { wave: 4, waves: WAVES, won: false });
  // Nonsense in a save is no defense at all.
  assert.equal(new Room({ code: '111111', save: { ...save, defense: { path: 'no' } }, now: time.now }).defense, null);
  // Packed monsters marching are like any others.
  room.receive(a, { t: 'defend', cmd: 'start' });
  play(room, time, START_MS + 200);
  const row = room.monsters.pack()[0];
  assert.equal(unpackMonster(row).state, 'hop');
});

// A player who builds: spends every brick before each wave, on whatever
// adds the most bubbles along the road for what it costs (marginal, so they
// do not all go on one pad), or a careful one who keeps half back.
function playGame({ theme, size, seed, spend = 1 }) {
  const { room, time } = defenseRoom(seed, size, theme);
  const a = join(room);
  const def = room.defense;
  const covers = (p, l) => (l ? def.route.filter((r) => Math.hypot(r.x - p.x, r.z - p.z) <= TOWER[l].range).length * TOWER[l].power * (1000 / TOWER[l].every) : 0);
  let losses = 0;
  for (let rounds = 0; def.state !== 'won' && rounds < 40; rounds++) {
    let budget = Math.floor(def.bricks * spend);
    for (;;) {
      let best = null;
      for (const p of def.pads) {
        const cost = TOWER_COST[p.level + 1];
        if (p.level >= MAX_LEVEL || cost > budget) continue;
        const gain = (covers(p, p.level + 1) - covers(p, p.level)) / cost;
        if (!best || gain > best.gain) best = { p, gain, cost };
      }
      if (!best) break;
      budget -= best.cost;
      build(room, a, best.p);
    }
    const wave = def.wave;
    room.receive(a, { t: 'defend', cmd: 'start' });
    for (let t = 0; t < 600000 && def.state === 'march'; t += 100) {
      time.t += 100;
      room.tick();
    }
    if (def.state === 'ready' && def.wave === wave) losses++;
  }
  return { won: def.state === 'won', losses, wave: def.wave, a };
}

test('a player who builds towers sees off every wave; one who builds none never does', () => {
  for (const [theme, size, seed] of [
    ['sunny', 'small', 2],
    ['snowy', 'small', 3],
    ['candy', 'big', 1],
    ['flat', 'huge', 1],
  ]) {
    const label = `${theme} ${size} island ${seed}`;
    const builder = playGame({ theme, size, seed });
    assert.ok(builder.won, `${label}: won`);
    assert.equal(builder.losses, 0, `${label}: without the Star Stone ever running out`);
    const won = builder.a.last('dwave');
    assert.equal(won.k, 'clear');
    assert.equal(won.wave, WAVES);
    assert.ok(won.won && won.by.includes(builder.a.pid), `${label}: everyone there won it`);
    // Keeping bricks back costs a try or two, and still gets there in the end.
    const careful = playGame({ theme, size, seed, spend: 0.5 });
    assert.ok(careful.won, `${label}: the careful player wins too`);
    // No towers at all: out of hearts again and again, and never past
    // King Grumble's first wave.
    const idle = playGame({ theme, size, seed, spend: 0 });
    assert.ok(!idle.won && idle.losses >= 3 && idle.wave <= Math.ceil(WAVES / 2), `${label}: no towers, stuck at wave ${idle.wave} after ${idle.losses} tries`);
  }
});
