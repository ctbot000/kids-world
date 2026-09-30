// The mesher and the light map: faces point outward, hidden faces are
// skipped, corners are shaded, and light spreads and fades as it should.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as B from '../public/js/shared/blocks.js';
import { LightMap } from '../public/js/shared/light.js';
import { FACES, meshChunk } from '../public/js/render/mesher.js';
import { World } from '../public/js/shared/world.js';
import { generate } from '../public/js/shared/worldgen.js';

// Stand-in for the painted atlas: every face uses layer 0, no tint.
const visuals = { faceLayer: new Int16Array(256 * 3), tint: new Uint8Array(256 * 3).fill(255), studTint: new Uint8Array(256 * 3).fill(200) };

function lit(world) {
  const light = new LightMap(world);
  light.computeAll();
  return light;
}

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

function triangles(part) {
  const out = [];
  const p = (i) => [part.pos[i * 3], part.pos[i * 3 + 1], part.pos[i * 3 + 2]];
  for (let t = 0; t < part.idx.length; t += 3) out.push([p(part.idx[t]), p(part.idx[t + 1]), p(part.idx[t + 2])]);
  return out;
}

test('every face table entry winds counter-clockwise around its outward normal', () => {
  // `+ 0` folds -0 into 0, which strict equality would otherwise tell apart.
  for (const f of FACES) assert.deepEqual(cross(f.u, f.v).map((v) => v + 0), f.n);
});

test('a lone block becomes six outward faces enclosing a positive volume', () => {
  const w = new World({ W: 16, H: 16, D: 16, sea: 1 });
  w.set(5, 8, 5, B.STONE);
  const mesh = meshChunk(w, lit(w), visuals, 0, 0);
  const tris = triangles(mesh.opaque);
  assert.equal(tris.length, 12);
  const centre = [5.5, 8.5, 5.5];
  let volume = 0;
  for (const [a, b, c] of tris) {
    const n = cross(sub(b, a), sub(c, a));
    const mid = [(a[0] + b[0] + c[0]) / 3, (a[1] + b[1] + c[1]) / 3, (a[2] + b[2] + c[2]) / 3];
    assert.ok(dot(n, sub(mid, centre)) > 0, 'face normal points away from the centre');
    volume += dot(a, cross(b, c)) / 6;
  }
  assert.ok(Math.abs(volume - 1) < 1e-6, `volume ${volume}`);
  assert.equal(mesh.studs.count, 1, 'stone gets a stud on top');
});

test('faces between two blocks are hidden, and corners next to walls are shaded', () => {
  const w = new World({ W: 16, H: 16, D: 16, sea: 1 });
  w.set(5, 8, 5, B.STONE);
  w.set(6, 8, 5, B.STONE);
  let mesh = meshChunk(w, lit(w), visuals, 0, 0);
  assert.equal(mesh.opaque.idx.length / 6, 10);
  // A floor with a wall standing on it: the floor's top corners by the wall are darker.
  const f = new World({ W: 16, H: 16, D: 16, sea: 1 });
  for (let x = 0; x < 16; x++) for (let z = 0; z < 16; z++) f.set(x, 4, z, B.STONE);
  for (let z = 0; z < 16; z++) f.set(8, 5, z, B.STONE);
  mesh = meshChunk(f, lit(f), visuals, 0, 0);
  const o = mesh.opaque;
  let shadedByWall = 0;
  let open = 0;
  for (let v = 0; v < o.verts; v++) {
    const y = o.pos[v * 3 + 1];
    const x = o.pos[v * 3];
    if (y !== 5) continue;
    const ao = o.lit[v * 4 + 2];
    if (x === 8 && ao < 255) shadedByWall++;
    if (x === 3 && ao === 255) open++;
  }
  assert.ok(shadedByWall > 0, 'corners against the wall are shaded');
  assert.ok(open > 0, 'corners in the open are not');
});

test('sunlight falls, spreads under a roof and fades; lamps light the dark', () => {
  const w = new World({ W: 32, H: 24, D: 32, sea: 1 });
  for (let x = 0; x < 32; x++) for (let z = 0; z < 32; z++) w.set(x, 1, z, B.STONE);
  // A roof over part of the floor.
  for (let x = 10; x < 22; x++) for (let z = 10; z < 22; z++) w.set(x, 5, z, B.STONE);
  const light = lit(w);
  assert.equal(light.skyAt(3, 2, 3), 15, 'open ground is in full sun');
  assert.equal(light.skyAt(16, 6, 16), 15, 'on the roof too');
  const under = light.skyAt(16, 2, 16);
  assert.ok(under > 5 && under < 15, `light under the middle of the roof: ${under}`);
  assert.ok(light.skyAt(11, 2, 11) > under, 'brighter near the edge');
  // Close the roof into a box: then it is dark inside, until a lamp is lit.
  for (let x = 9; x < 23; x++) {
    for (let y = 2; y < 5; y++) {
      w.set(x, y, 9, B.STONE);
      w.set(x, y, 22, B.STONE);
      w.set(9, y, x, B.STONE);
      w.set(22, y, x, B.STONE);
    }
  }
  light.relight(0, 0, 31, 31);
  assert.equal(light.skyAt(16, 2, 16), 0);
  w.set(16, 4, 16, B.LAMP);
  const changed = light.relight(16 - 15, 16 - 15, 16 + 15, 16 + 15);
  assert.equal(light.lampAt(16, 3, 16), 14);
  assert.equal(light.lampAt(16, 2, 13), 10);
  assert.ok(changed.has('1,1'), 'the chunk with the lamp changed');
});

test('relighting a region gives the same light as lighting everything', () => {
  const { world } = generate({ seed: 77, theme: 'sunny' });
  const light = lit(world);
  const cx = 64;
  const cz = 64;
  // Build a little hut with a lamp and dig a hole, then relight just around them.
  const y = world.top(cx, cz) + 1;
  for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++) world.set(cx + dx, y + 3, cz + dz, B.PLANKS);
  world.set(cx, y + 2, cz, B.LAMP);
  world.set(cx + 5, y - 1, cz, B.AIR);
  light.relight(cx - 2 - 15, cz - 2 - 15, cx + 5 + 15, cz + 2 + 15);
  const fresh = lit(world);
  assert.deepEqual(light.sky, fresh.sky);
  assert.deepEqual(light.lamp, fresh.lamp);
});

test('water, plants, items and glass go to their own parts', () => {
  const w = new World({ W: 16, H: 16, D: 16, sea: 3 });
  for (let x = 0; x < 16; x++) for (let z = 0; z < 16; z++) w.set(x, 1, z, B.STONE);
  w.set(2, 2, 2, B.WATER);
  w.set(4, 2, 4, B.TULIP);
  w.set(6, 2, 6, B.SHELL);
  w.set(8, 2, 8, B.GLASS);
  const mesh = meshChunk(w, lit(w), visuals, 0, 0);
  assert.ok(mesh.water.idx.length > 0);
  assert.equal(mesh.plants.idx.length / 6, 2, 'a flower is two crossed pictures');
  assert.equal(mesh.items.idx.length / 6, 1, 'a shell is one picture facing you');
  assert.equal(mesh.glass.idx.length / 6, 5, 'glass on the floor shows five faces');
  // The water's top sits a little below the block top, and is marked as surface.
  let surface = 0;
  for (let v = 0; v < mesh.water.verts; v++) {
    if (Math.abs(mesh.water.pos[v * 3 + 1] - 2.875) < 1e-6) {
      assert.equal(mesh.water.lit[v * 4 + 3], 255);
      surface++;
    }
  }
  assert.ok(surface >= 4);
});

test('a whole island meshes quickly', () => {
  const { world } = generate({ seed: 3, theme: 'sunny' });
  const t0 = performance.now();
  const light = lit(world);
  const t1 = performance.now();
  let faces = 0;
  for (let cx = 0; cx < world.chunksX; cx++) for (let cz = 0; cz < world.chunksZ; cz++) faces += meshChunk(world, light, visuals, cx, cz).opaque.idx.length / 6;
  const t2 = performance.now();
  console.log(`light ${(t1 - t0).toFixed(0)} ms, mesh ${(t2 - t1).toFixed(0)} ms, ${faces} faces`);
  assert.ok(faces > 20000);
});
