// Zoo islands: the zoo in the middle (flat, its pens walled in too high to
// get over, everyone arriving inside the gate), every animal in its pen
// with room to stand, and twenty minutes of them getting about without one
// getting out.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as B from '../public/js/shared/blocks.js';
import { CRITTER_INFO, CritterSim, maxCritters, standHeight } from '../public/js/shared/critters.js';
import { inPark, PARK_HALF } from '../public/js/shared/park.js';
import { randomIslandName } from '../public/js/shared/words.js';
import { normalizeMeta } from '../public/js/shared/world.js';
import { generate, THEMES } from '../public/js/shared/worldgen.js';
import { inPen, PENS, penAt, WALL, ZOO_ANIMALS, zooAt } from '../public/js/shared/zoo.js';

test('a zoo island is a kind of island, saved and named as one', () => {
  assert.ok(THEMES.some((t) => t.key === 'zoo' && t.icon === '🦒'));
  assert.equal(normalizeMeta({ theme: 'zoo' }).theme, 'zoo');
  for (let i = 0; i < 20; i++) assert.match(randomIslandName('zoo', Math.random), /^\S+ (Zoo|Safari|Island|Isle|Park|Gardens)$/);
});

test('the zoo: flat, walled pens with every animal inside its own, nothing wild growing in it, and everyone arriving inside the gate', () => {
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
    for (let ox = -PARK_HALF; ox <= PARK_HALF; ox++) {
      for (let oz = -PARK_HALF; oz <= PARK_HALF; oz++) {
        const [x, z] = [zoo.cx + ox, zoo.cz + oz];
        const ground = world.get(x, level, z);
        assert.ok(B.SOLID[ground] || ground === B.WATER, `${where}: ground at ${ox},${oz}`);
        // Every pen's wall whole, as high as WALL, but for a shut door.
        const pen = penAt(ox, oz);
        if (pen && !inPen(pen, ox, oz)) {
          for (let y = level + 1; y <= level + WALL; y++) assert.ok(B.SOLID[world.get(x, y, z)], `${where}: the ${pen.key} wall at ${ox},${y - level},${oz}`);
        }
      }
    }
    // Every animal of the zoo, each in its pen, standing on dry ground with
    // nothing in the way.
    const kept = critters.slice(0, ZOO_ANIMALS.length);
    assert.deepEqual(kept.map((c) => c.type), ZOO_ANIMALS.map(([t]) => t), `${where}: the zoo's animals, first`);
    for (const c of kept) {
      const pen = penAt(Math.floor(c.x) - zoo.cx, Math.floor(c.z) - zoo.cz);
      assert.ok(pen && inPen(pen, Math.floor(c.x) - zoo.cx, Math.floor(c.z) - zoo.cz), `${where}: the ${c.type} in a pen`);
      assert.equal(standHeight(world, c.x, c.z, c.y), c.y, `${where}: the ${c.type} on the ground`);
      assert.notEqual(world.get(Math.floor(c.x), c.y - 1, Math.floor(c.z)), B.WATER, `${where}: the ${c.type} not in the water`);
      for (const dy of [0, 1]) assert.ok(!B.SOLID[world.get(Math.floor(c.x), c.y + dy, Math.floor(c.z))], `${where}: room for the ${c.type}`);
    }
    // Room for them all on the island, and its vehicles too.
    assert.ok(critters.length <= maxCritters(world), `${where}: ${critters.length} animals and vehicles fit`);
    for (const type of ['car', 'boat', 'bus', 'helicopter']) assert.ok(critters.some((c) => c.type === type), `${where}: a ${type}`);
    // Nothing of the island's own wandering in at the start.
    for (const c of critters.slice(ZOO_ANIMALS.length)) {
      if (!CRITTER_INFO[c.type].vehicle && !CRITTER_INFO[c.type].flies) assert.ok(!inPark(zoo, c.x, c.z, 0), `${where}: a wild ${c.type} outside the zoo`);
    }
    const s = world.spawn;
    assert.ok(inPark(zoo, s.x, s.z, 0) && s.y === level + 1 && s.yaw === 0, `${where}: the start inside the gate`);
    for (const dy of [0, 1]) assert.equal(world.get(Math.floor(s.x), s.y + dy, Math.floor(s.z)), B.AIR, `${where}: room at the start`);
  }
});

test('for twenty minutes, day and night, every zoo animal gets about and stays in its pen', () => {
  for (const seed of [1, 42]) {
    const { world, critters } = generate({ seed, theme: 'zoo' });
    const zoo = zooAt(world);
    const sim = new CritterSim(seed);
    const kept = critters.slice(0, ZOO_ANIMALS.length).map((c) => ({ c: sim.add(c.type, c.x, c.y, c.z), pen: penAt(Math.floor(c.x) - zoo.cx, Math.floor(c.z) - zoo.cz), moved: 0 }));
    for (let i = 0; i < 20 * 600; i++) {
      const t = i / 10;
      sim.step(world, 0.1, t * 1000, new Map(), t % 600 >= 480);
      if (i % 10) continue;
      for (const k of kept) {
        const [ox, oz] = [Math.floor(k.c.x) - zoo.cx, Math.floor(k.c.z) - zoo.cz];
        assert.ok(inPen(k.pen, ox, oz), `${seed}: the ${k.c.type} got out of the ${k.pen.key} to ${ox},${oz} after ${t} s`);
        k.moved += Math.hypot(k.c.x - (k.lx ?? k.c.x), k.c.z - (k.lz ?? k.c.z));
        [k.lx, k.lz] = [k.c.x, k.c.z];
      }
    }
    assert.ok(kept.filter((k) => k.moved > 20).length >= kept.length * 0.7, `${seed}: most of them get about`);
    // The polar bear on its own side of the glass.
    const bear = kept.find((k) => k.c.type === 'polarbear');
    assert.ok(bear.c.x - zoo.cx > 14, `${seed}: the bear on its side`);
  }
  assert.equal(PENS.filter((p) => p.door).length, 2, 'two pens to walk into');
});
