// The katsura tree (Cercidiphyllum): a few trunks from one foot under a
// broad deep crown, or a young one narrow and pointed; its leaves turned for
// autumn in patches; and its blocks in the toy box beside their own kind.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as B from '../public/js/shared/blocks.js';
import { LightMap } from '../public/js/shared/light.js';
import { katsuraTree, stampByKey } from '../public/js/shared/stamps.js';
import { Rng } from '../public/js/shared/rng.js';
import { autumnColour, meshChunk } from '../public/js/render/mesher.js';
import { World } from '../public/js/shared/world.js';

const span = (cells, k) => Math.max(...cells.map((c) => c[k])) - Math.min(...cells.map((c) => c[k])) + 1;

// Every piece of wood joins the foot face to face, through wood.
function joined(cells) {
  const wood = new Set(cells.filter((c) => c[3] === B.KATSURA_WOOD).map(([x, y, z]) => `${x},${y},${z}`));
  const seen = new Set(['0,0,0']);
  const todo = [[0, 0, 0]];
  while (todo.length) {
    const [x, y, z] = todo.pop();
    for (const [dx, dy, dz] of [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]]) {
      const key = `${x + dx},${y + dy},${z + dz}`;
      if (wood.has(key) && !seen.has(key)) {
        seen.add(key);
        todo.push([x + dx, y + dy, z + dz]);
      }
    }
  }
  return seen.size === wood.size;
}

test('a katsura is a few trunks from one foot under a broad deep crown, or young, narrow and pointed', () => {
  let young = 0;
  let old = 0;
  for (let seed = 1; seed <= 60; seed++) {
    const cells = katsuraTree(new Rng(seed));
    const leaves = cells.filter((c) => c[3] === B.KATSURA_LEAVES);
    const wood = cells.filter((c) => c[3] === B.KATSURA_WOOD);
    assert.equal(cells.length, wood.length + leaves.length, `${seed}: only katsura wood and leaves`);
    assert.ok(joined(cells), `${seed}: every trunk and branch grows from the foot`);
    assert.ok(Math.min(...leaves.map((c) => c[1])) >= 2, `${seed}: room to walk under the crown`);
    const wide = Math.min(span(leaves, 0), span(leaves, 2));
    const high = span(cells, 1);
    if (wide >= 7) {
      old++;
      assert.ok(wood.filter((c) => c[1] === 4).length >= 5, `${seed}: trunks and branches apart under the crown`);
      assert.ok(span(leaves, 1) >= high * 0.55, `${seed}: a deep crown`);
    } else {
      young++;
      assert.ok(Math.max(span(leaves, 0), span(leaves, 2)) < high / 1.5, `${seed}: narrow and pointed`);
      assert.ok(Math.min(...leaves.map((c) => c[1])) <= 2, `${seed}: its crown nearly to the ground`);
    }
  }
  assert.ok(young >= 8 && old >= 30, `young ${young}, grown ${old}`);
  // The stamp's old giant, all of it joined to its foot in front of you.
  const giant = stampByKey('katsura').cells.map(([x, y, z, id]) => [x, y, z - 6, id]);
  assert.ok(joined(giant));
  assert.ok(span(giant, 0) >= 12 && span(giant, 1) >= 13, 'a giant');
});

test('katsura leaves turn for autumn in patches: gold, warmer on top, greener underneath, smooth from block to block', () => {
  const w = new World({ W: 16, H: 24, D: 16, sea: 1 });
  for (let x = 2; x < 14; x++) for (let y = 4; y < 16; y++) for (let z = 2; z < 14; z++) if ((x - 8) ** 2 + (y - 10) ** 2 + (z - 8) ** 2 < 30) w.set(x, y, z, B.KATSURA_LEAVES);
  w.set(8, 18, 8, B.LEAVES);
  const light = new LightMap(w);
  light.computeAll();
  const visuals = { faceLayer: new Int16Array(256 * 3), tint: new Uint8Array(256 * 3).fill(255), studTint: new Uint8Array(256 * 3).fill(200) };
  const { opaque } = meshChunk(w, light, visuals, 0, 0);
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const at = (v) => [...opaque.pos.slice(v * 3, v * 3 + 3)];
  const colour = (v) => [...opaque.col.slice(v * 3, v * 3 + 3)].join();
  const seen = new Map();
  const colours = new Set();
  for (let q = 0; q < opaque.verts; q += 4) {
    // Corners go base, +u, +u+v, +v, and u x v points out of the face.
    const [p0, p1, p3] = [at(q), at(q + 1), at(q + 3)];
    const [u, v] = [sub(p1, p0), sub(p3, p0)];
    const up = Math.sign(u[2] * v[0] - u[0] * v[2]);
    for (let k = 0; k < 4; k++) {
      if (p0[1] > 17) {
        assert.equal(colour(q + k), '255,255,255', 'an oak is not turned');
        continue;
      }
      colours.add(colour(q + k));
      // Faces meeting at a corner, facing the same way up or down, agree.
      const key = `${at(q + k)}|${up}`;
      if (seen.has(key)) assert.equal(colour(q + k), seen.get(key), `at ${key}`);
      else seen.set(key, colour(q + k));
    }
  }
  assert.ok(colours.size > 20, `${colours.size} colours`);
  assert.ok(colours.has('255,255,255'), 'mostly gold as painted');
  const rgb = [...colours].map((c) => c.split(',').map(Number));
  assert.ok(rgb.some(([r, , b]) => r === 255 && b < 200), 'apricot to red in places');
  assert.ok(rgb.some(([r, g]) => g > r), 'a little green left in others');
  // The same spot seen on top and underneath: never greener on top.
  const green = ([r, g]) => g - r;
  let warmer = 0;
  for (let i = 0; i < 300; i++) {
    const [x, y, z] = [i % 7, (i * 3) % 11, (i * 5) % 13];
    const top = autumnColour(x, y, z, 1);
    const under = autumnColour(x, y, z, -1);
    assert.ok(green(top) <= green(under), `at ${x},${y},${z}: ${top} on top, ${under} underneath`);
    if (green(top) < green(under)) warmer++;
  }
  assert.ok(warmer > 50, `${warmer} warmer on top`);
});

test('the toy box keeps a katsura’s blocks with their own kind', () => {
  const nature = B.blocksIn('nature');
  assert.deepEqual(nature.slice(nature.indexOf(B.PINE_LEAVES), nature.indexOf(B.PINE_LEAVES) + 3), [B.PINE_LEAVES, B.KATSURA_WOOD, B.KATSURA_LEAVES]);
  const plants = B.blocksIn('plants');
  assert.equal(plants[plants.indexOf(B.PINE_SPROUT) + 1], B.KATSURA_SPROUT);
  assert.equal(plants.length, new Set(plants).size);
  for (const id of [B.KATSURA_WOOD, B.KATSURA_LEAVES]) assert.equal(B.TREE_PART[id], 1, 'fruit can hang from it, and the camera looks past it');
});
