// The katsura tree (Cercidiphyllum), a real tree and not made of blocks:
// its model (a few trunks of bark from one foot, branching into a broad
// crown of leaf clusters, young ones narrow and pointed, the stamp's a
// giant), laid into the world by the mesher with the ground under it in
// shade; its cells (a foot and a trunk to bump into), which come away
// whole; where islands grow one; its leaves turned for autumn in patches;
// and its blocks in the toy box beside their own kind.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as B from '../public/js/shared/blocks.js';
import { LightMap } from '../public/js/shared/light.js';
import { katsuraTree, stampByKey } from '../public/js/shared/stamps.js';
import { katsuraModel } from '../public/js/render/katsura.js';
import { autumnColour, meshChunk, realTree } from '../public/js/render/mesher.js';
import { paintEdit, pickEdit } from '../public/js/shared/tools.js';
import { World } from '../public/js/shared/world.js';
import { generate } from '../public/js/shared/worldgen.js';

const visuals = { faceLayer: new Int16Array(256 * 3), tint: new Uint8Array(256 * 3).fill(255), studTint: new Uint8Array(256 * 3).fill(200) };
const spread = (cards, k) => Math.max(...cards.map((c) => c.p[k])) - Math.min(...cards.map((c) => c.p[k]));

function lit(world) {
  const light = new LightMap(world);
  light.computeAll();
  return light;
}

// A field of grass, with a katsura's cells at (x, 2, z) if asked.
function field(tree = null) {
  const w = new World({ W: 48, H: 40, D: 32, sea: 1 });
  for (let x = 0; x < 48; x++) for (let z = 0; z < 32; z++) w.set(x, 1, z, B.GRASS);
  if (tree) for (const [dx, dy, dz, id] of katsuraTree(tree.giant)) w.set(tree.x + dx, 2 + dy, tree.z + dz, id);
  return w;
}

test('a real katsura grows from its seed: a few trunks of bark from one foot, branching into a broad crown of leaf clusters', () => {
  for (let seed = 1; seed <= 12; seed++) {
    const m = katsuraModel(seed, 'mature');
    assert.deepEqual(katsuraModel(seed, 'mature'), m, 'the same tree from the same seed');
    const stems = m.limbs.filter((l) => l.level === 0);
    assert.ok(stems.length >= 3 && stems.length <= 5, `${seed}: ${stems.length} trunks`);
    for (const l of stems) assert.ok(Math.hypot(l.pts[0][0], l.pts[0][2]) < 0.2 && l.pts[0][1] < 0, `${seed}: from one foot, into the ground`);
    // Leaning apart as they climb.
    const tops = stems.map((l) => l.pts.at(-1));
    assert.ok(Math.max(...tops.flatMap((a) => tops.map((b) => Math.hypot(a[0] - b[0], a[2] - b[2])))) > 2, `${seed}: trunks apart`);
    for (const l of m.limbs) for (let i = 1; i < l.radii.length; i++) assert.ok(l.radii[i] <= l.radii[i - 1] + 1e-9 || l.pts[i][1] < 0.6, 'thinner as it goes');
    assert.ok(m.limbs.some((l) => l.level === 1) && m.limbs.some((l) => l.level === 2), 'branches and twigs');
    assert.ok(m.cards.length > 800, `${seed}: ${m.cards.length} leaf clusters`);
    assert.ok(Math.min(spread(m.cards, 0), spread(m.cards, 2)) >= 7, `${seed}: a broad crown`);
    assert.ok(Math.min(...m.cards.map((c) => c.p[1])) >= 2.5, `${seed}: room to walk under it`);
    assert.ok(m.litter.length > 40, 'leaves fallen round it');
  }
  assert.notDeepEqual(katsuraModel(1, 'mature').cards, katsuraModel(2, 'mature').cards, 'every one its own');
  for (let seed = 1; seed <= 8; seed++) {
    const young = katsuraModel(seed, 'young');
    assert.ok(young.limbs.filter((l) => l.level === 0).length <= 2, 'a young one has a trunk or two');
    assert.ok(Math.max(spread(young.cards, 0), spread(young.cards, 2)) < spread(young.cards, 1), 'narrow and tall');
    const giant = katsuraModel(seed, 'giant');
    assert.ok(Math.min(spread(giant.cards, 0), spread(giant.cards, 2)) >= 11 && Math.max(...giant.cards.map((c) => c.p[1])) > 14, 'a giant');
  }
});

test('a real katsura is a foot and a trunk to bump into, laid in by the mesher with the ground under its crown in shade', () => {
  assert.deepEqual(katsuraTree(), [[0, 0, 0, B.KATSURA_TREE], [0, 1, 0, B.TREE_CORE], [0, 2, 0, B.TREE_CORE]]);
  assert.deepEqual(katsuraTree(true)[0], [0, 0, 0, B.KATSURA_GIANT]);
  assert.deepEqual(stampByKey('katsura').cells, katsuraTree(true).map(([x, y, z, id]) => [x, y, z + 7, id]), "the stamp's giant, a few steps ahead");
  for (const id of [B.KATSURA_TREE, B.KATSURA_GIANT, B.TREE_CORE]) {
    assert.ok(B.SOLID[id] && !B.OPAQUE[id] && B.TREE_PART[id], 'solid, letting the light through, and a tree');
    assert.equal(B.block(id).category, null, 'not in the toy box');
  }
  // A giant near the edge of the first chunk: drawn whole in that chunk, its
  // crown shading the ground of the next one too.
  const bare = field();
  const w = field({ x: 13, z: 8, giant: true });
  const light = lit(w);
  const plain = meshChunk(bare, lit(bare), visuals, 0, 0);
  const mesh = meshChunk(w, light, visuals, 0, 0);
  const next = meshChunk(w, light, visuals, 1, 0);
  assert.deepEqual(mesh.trees, [[13, 2, 8]]);
  assert.equal(next.trees.length, 0);
  const { model } = realTree(13, 2, 8, B.KATSURA_GIANT);
  const leaves = model.cards.length + model.litter.length;
  assert.ok(mesh.foliage.verts >= model.cards.length * 4 && mesh.foliage.verts <= leaves * 4, 'its leaves, and its fallen leaves where there is ground');
  assert.ok(mesh.opaque.verts > plain.opaque.verts + 400, 'its bark');
  assert.equal(next.foliage.verts, 0, 'drawn once, in its own chunk');
  // The sky light on the top of the grass, under the crown and out in the open.
  const skyOn = (m, x, z) => {
    for (let v = 0; v < m.opaque.verts; v++) {
      if (m.opaque.pos[v * 3] === x && m.opaque.pos[v * 3 + 1] === 2 && m.opaque.pos[v * 3 + 2] === z) return m.opaque.lit[v * 4];
    }
    return null;
  };
  assert.ok(skyOn(mesh, 12, 8) < skyOn(mesh, 2, 8) * 0.85, 'shade right under it');
  assert.ok(skyOn(next, 17, 8) < skyOn(next, 30, 8), "and in the next chunk, under the crown's edge");
  assert.equal(skyOn(mesh, 2, 8), skyOn(plain, 2, 8), 'none out in the open');
});

test('a real tree comes away whole, whichever part of it is picked, and is never painted', () => {
  const w = field({ x: 10, z: 10 });
  for (const y of [2, 3, 4]) {
    const { cells } = pickEdit(w, { x: 10, y, z: 10, nx: 0, ny: 1, nz: 0 });
    const gone = [];
    for (let i = 0; i < cells.length; i += 4) if (cells[i + 3] === B.AIR) gone.push(cells[i + 1]);
    assert.deepEqual(gone.sort(), [2, 3, 4], `picked at ${y}`);
  }
  assert.equal(paintEdit(w, { x: 10, y: 3, z: 10, nx: 1, ny: 0, nz: 0 }, B.STONE).cells.length, 0);
});

test('islands grow a few real katsuras, each standing on its own, where oaks would be', () => {
  let feet = 0;
  for (const [seed, theme] of [[1, 'sunny'], [2, 'sunny'], [3, 'flat'], [4, 'sunny']]) {
    const { world: w } = generate({ seed, theme });
    for (let x = 0; x < w.W; x++) {
      for (let z = 0; z < w.D; z++) {
        for (let y = 1; y < w.H; y++) {
          if (w.get(x, y, z) !== B.KATSURA_TREE) continue;
          feet++;
          assert.deepEqual([w.get(x, y + 1, z), w.get(x, y + 2, z)], [B.TREE_CORE, B.TREE_CORE], 'its trunk');
          assert.ok(B.OPAQUE[w.get(x, y - 1, z)], 'on the ground');
          // Room round it for its crown: no other tree's leaves near.
          for (let dx = -4; dx <= 4; dx++) for (let dz = -4; dz <= 4; dz++) for (let dy = 0; dy < 10; dy++) assert.notEqual(w.get(x + dx, y + dy, z + dz), B.LEAVES, 'room round it');
        }
      }
    }
  }
  assert.ok(feet >= 6, `${feet} katsuras`);
  for (const theme of ['snowy', 'candy', 'volcano']) assert.ok(!generate({ seed: 1, theme }).world.blocks.includes(B.KATSURA_TREE), `none on a ${theme} island`);
});

test('katsura leaves turn for autumn in patches: gold, warmer on top, greener underneath, smooth from block to block', () => {
  const w = new World({ W: 16, H: 24, D: 16, sea: 1 });
  for (let x = 2; x < 14; x++) for (let y = 4; y < 16; y++) for (let z = 2; z < 14; z++) if ((x - 8) ** 2 + (y - 10) ** 2 + (z - 8) ** 2 < 30) w.set(x, y, z, B.KATSURA_LEAVES);
  w.set(8, 18, 8, B.LEAVES);
  const { opaque } = meshChunk(w, lit(w), visuals, 0, 0);
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

test('the toy box keeps a katsura\u2019s blocks with their own kind', () => {
  const nature = B.blocksIn('nature');
  assert.deepEqual(nature.slice(nature.indexOf(B.PINE_LEAVES), nature.indexOf(B.PINE_LEAVES) + 3), [B.PINE_LEAVES, B.KATSURA_WOOD, B.KATSURA_LEAVES]);
  const plants = B.blocksIn('plants');
  assert.equal(plants[plants.indexOf(B.PINE_SPROUT) + 1], B.KATSURA_SPROUT);
  assert.equal(plants.length, new Set(plants).size);
  for (const id of [B.KATSURA_WOOD, B.KATSURA_LEAVES]) assert.equal(B.TREE_PART[id], 1, 'fruit can hang from it, and the camera looks past it');
});
