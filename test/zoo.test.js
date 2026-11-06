// Zoo islands: the zoo in the middle (flat, its exhibits walled in too high
// to get over, windows under the water, a gate with ZOO over it, everyone
// arriving outside it), every animal in its own exhibit with room to stand,
// the zoo's own animals drawn in every state, and twenty minutes of them
// getting about without one getting out.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CritterModel } from '../public/js/render/critter-models.js';
import * as B from '../public/js/shared/blocks.js';
import { BIG, CRITTER_INFO, CRITTER_TYPES, CritterSim, maxCritters, standHeight } from '../public/js/shared/critters.js';
import { inPark } from '../public/js/shared/park.js';
import { randomIslandName } from '../public/js/shared/words.js';
import { normalizeMeta } from '../public/js/shared/world.js';
import { generate, THEMES } from '../public/js/shared/worldgen.js';
import { EXHIBITS, MOAT, WALL, ZOO_ANIMALS, ZOO_HALF, zoneAt, zooAt } from '../public/js/shared/zoo.js';

const FL = Math.floor;
const NEW = ['lion', 'tiger', 'zebra', 'hippo', 'rhino', 'panda', 'flamingo', 'monkey', 'kangaroo'];

test('a zoo island is a kind of island, saved and named as one, with animals of its own', () => {
  assert.ok(THEMES.some((t) => t.key === 'zoo' && t.icon === '🦒'));
  assert.equal(normalizeMeta({ theme: 'zoo' }).theme, 'zoo');
  for (let i = 0; i < 20; i++) assert.match(randomIslandName('zoo', Math.random), /^\S+ (Zoo|Safari|Island|Isle|Park|Gardens)$/);
  // New kinds go on the end: the wire sends the index.
  assert.deepEqual(CRITTER_TYPES.slice(CRITTER_TYPES.indexOf(NEW[0]), CRITTER_TYPES.indexOf(NEW.at(-1)) + 1), NEW);
  for (const t of ['lion', 'tiger', 'zebra', 'hippo', 'rhino', 'panda']) assert.ok(BIG.includes(t) && CRITTER_INFO[t].ride, `the ${t} is big and rideable`);
  for (const t of ['flamingo', 'monkey', 'kangaroo']) assert.ok(!CRITTER_INFO[t].big && !CRITTER_INFO[t].swims, `the ${t} is small and keeps out of deep water`);
});

test('every zoo animal can be drawn in every state', () => {
  for (const type of NEW) {
    for (const id of [0, 1, 2]) {
      const m = new CritterModel(type, id);
      for (const state of ['idle', 'walk', 'run', 'eat', 'happy', 'sleep', 'swim', 'jump']) {
        for (const moving of [false, true]) {
          m.update(0.05, state, moving, 0);
          m.group.updateMatrixWorld(true);
          m.group.traverse((o) => {
            if (o.isMesh) assert.ok(o.matrixWorld.elements.every(Number.isFinite), `${type} ${state}: every part is somewhere`);
          });
        }
      }
      m.dispose();
    }
  }
});

// Whether the cell (ox, oz) is on an exhibit's wall.
const onWall = (ox, oz) => {
  const k = zoneAt(ox, oz);
  if (!k || !EXHIBITS.some((e) => e.key === k)) return false;
  for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) if (zoneAt(ox + dx, oz + dz) !== k) return true;
  return false;
};

test('the zoo: flat, its exhibits walled in all round, windows under the water, the gate, and every animal in its own exhibit', () => {
  for (const [seed, size] of [
    [1, 'small'],
    [2, 'small'],
    [77, 'big'],
    [5, 'huge'],
  ]) {
    const where = `${seed} ${size}`;
    const { world, critters } = generate({ seed, theme: 'zoo', size });
    const zoo = zooAt(world);
    const level = world.sea + 4;
    const get = (ox, y, oz) => world.get(zoo.cx + ox, y, zoo.cz + oz);
    for (let ox = -ZOO_HALF; ox <= ZOO_HALF; ox++) {
      for (let oz = -ZOO_HALF; oz <= ZOO_HALF; oz++) {
        // Solid ground under everything: no hole down to the sea.
        assert.ok(B.SOLID[get(ox, level - MOAT, oz)] || get(ox, level - MOAT, oz) === B.WATER, `${where}: ground at ${ox},${oz}`);
        if (!onWall(ox, oz)) continue;
        const ex = EXHIBITS.find((e) => e.key === zoneAt(ox, oz));
        // An open exhibit's front: a rail, and past it its moat.
        const front = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dz]) => !zoneAt(ox + dx, oz + dz) && Math.max(Math.abs(ox + dx), Math.abs(oz + dz)) < ZOO_HALF - 1);
        if (ex.moat && front) {
          assert.equal(get(ox, level + 1, oz), B.FENCE, `${where}: the ${ex.key} rail at ${ox},${oz}`);
          continue;
        }
        for (let y = level + 1; y <= level + (ex.fence ? 2 : ex.window && front ? WALL - 1 : WALL); y++) assert.ok(B.SOLID[get(ox, y, oz)], `${where}: the ${ex.key} wall at ${ox},${y - level},${oz}`);
      }
    }
    // A window under the water at the penguins' and the hippos'.
    for (const key of ['penguin', 'hippo']) {
      let n = 0;
      for (let ox = -ZOO_HALF; ox <= ZOO_HALF; ox++) for (let oz = -ZOO_HALF; oz <= ZOO_HALF; oz++) if (zoneAt(ox, oz) === key && get(ox, level - 1, oz) === B.GLASS) n++;
      assert.ok(n >= 3, `${where}: a window under the ${key}s' water (${n})`);
    }
    // ZOO over the gate.
    assert.ok([-5, -1, 3].every((x) => get(x, level + 9, 31) === B.TOY_BRICKS[4]), `${where}: the sign over the gate`);
    // Every animal of the zoo, each in its exhibit, on dry ground with
    // nothing in the way; and first, so a full island still has them all.
    const kept = critters.slice(0, ZOO_ANIMALS.length);
    assert.deepEqual(kept.map((c) => c.type), ZOO_ANIMALS.map(([t]) => t), `${where}: the zoo's animals, first`);
    kept.forEach((c, i) => {
      const [ox, oz] = [FL(c.x) - zoo.cx, FL(c.z) - zoo.cz];
      assert.equal(zoneAt(ox, oz), ZOO_ANIMALS[i][1], `${where}: the ${c.type} in its exhibit`);
      assert.ok(!onWall(ox, oz), `${where}: the ${c.type} not on a wall`);
      assert.equal(standHeight(world, c.x, c.z, c.y), c.y, `${where}: the ${c.type} on the ground`);
      assert.notEqual(world.get(FL(c.x), c.y - 1, FL(c.z)), B.WATER, `${where}: the ${c.type} not in the water`);
      for (const dy of [0, 1, 2]) assert.ok(!B.SOLID[world.get(FL(c.x), c.y + dy, FL(c.z))], `${where}: room for the ${c.type}`);
    });
    // Room for them all on the island, and its vehicles too.
    assert.ok(critters.length <= maxCritters(world), `${where}: ${critters.length} animals and vehicles fit`);
    for (const type of ['car', 'boat']) assert.ok(critters.some((c) => c.type === type), `${where}: a ${type}`);
    // Nothing of the island's own wandering in at the start.
    for (const c of critters.slice(ZOO_ANIMALS.length)) {
      if (!CRITTER_INFO[c.type].vehicle && !CRITTER_INFO[c.type].flies) assert.ok(!inPark(zoo, c.x, c.z, 0), `${where}: a wild ${c.type} outside the zoo`);
    }
    const s = world.spawn;
    assert.ok(inPark(zoo, s.x, s.z, 0) && s.y === level + 1 && s.yaw === 0, `${where}: the start at the gate`);
    for (const dy of [0, 1]) assert.equal(world.get(FL(s.x), s.y + dy, FL(s.z)), B.AIR, `${where}: room at the start`);
  }
});

test('for twenty minutes, day and night, every zoo animal gets about and stays in its exhibit', () => {
  for (const seed of [1, 42, 7]) {
    const { world, critters } = generate({ seed, theme: 'zoo' });
    const zoo = zooAt(world);
    const level = world.sea + 4;
    const sim = new CritterSim(seed);
    sim.max = maxCritters(world);
    const kept = critters.slice(0, ZOO_ANIMALS.length).map((c, i) => ({ c: sim.add(c.type, c.x, c.y, c.z), key: ZOO_ANIMALS[i][1], moved: 0 }));
    for (let i = 0; i < 20 * 600; i++) {
      const t = i / 10;
      sim.step(world, 0.1, t * 1000, new Map(), t % 600 >= 480);
      if (i % 5) continue;
      for (const k of kept) {
        const [ox, oz] = [FL(k.c.x) - zoo.cx, FL(k.c.z) - zoo.cz];
        assert.equal(zoneAt(ox, oz), k.key, `${seed}: the ${k.c.type} got out of the ${k.key} to ${ox},${oz} after ${t} s`);
        // Down a moat (deeper than any pool), it would be stuck there.
        assert.ok(k.c.y > level - MOAT + 1.5, `${seed}: the ${k.c.type} fell into the ${k.key}'s moat at ${ox},${oz} after ${t} s`);
        k.moved += Math.hypot(k.c.x - (k.lx ?? k.c.x), k.c.z - (k.lz ?? k.c.z));
        [k.lx, k.lz] = [k.c.x, k.c.z];
      }
    }
    const still = kept.filter((k) => k.moved <= 15).map((k) => k.c.type);
    assert.ok(still.length <= kept.length * 0.25, `${seed}: most of them get about (not: ${still.join(', ')})`);
  }
});
