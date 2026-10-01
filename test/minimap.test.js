// The little map: the ground as seen from above, kept up to date as blocks
// change, the part of the world it shows, and its directions, which must
// match the 3D view rather than mirror it.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as THREE from '../public/vendor/three.module.js';
import * as B from '../public/js/shared/blocks.js';
import { World } from '../public/js/shared/world.js';
import { facing, looking, mapFrame, MapImage } from '../public/js/minimap.js';
import { Renderer } from '../public/js/render/renderer.js';

// Stand-in for the painted atlas: a plain colour for each block used here.
const tint = new Uint8Array(256 * 3).fill(128);
const colours = { [B.GRASS]: [80, 200, 60], [B.DIRT]: [150, 110, 70], [B.SAND]: [240, 220, 160], [B.STONE]: [160, 160, 160], [B.LEAVES]: [40, 150, 50], [B.TULIP]: [255, 0, 0], [B.TOY_BRICKS[0]]: [220, 40, 40] };
for (const [id, rgb] of Object.entries(colours)) tint.set(rgb, Number(id) * 3);

// A flat meadow at y = 4, with the sea at y = 4 too.
function meadow() {
  const w = new World({ W: 8, H: 16, D: 8, sea: 4 });
  for (let x = 0; x < w.W; x++) for (let z = 0; z < w.D; z++) column(w, x, z, [B.STONE, B.STONE, B.STONE, B.STONE, B.GRASS]);
  return w;
}

// Fills a column from the bottom up, and empties the rest of it.
function column(w, x, z, ids) {
  for (let y = 0; y < w.H; y++) w.set(x, y, z, ids[y] ?? B.AIR);
}

const brightness = (rgb) => rgb[0] + rgb[1] + rgb[2];

test('the map shows the ground from above, looking past flowers and fruit', () => {
  const w = meadow();
  column(w, 2, 2, [B.STONE, B.STONE, B.STONE, B.STONE, B.GRASS, B.TULIP]);
  const bare = w.clone();
  column(w, 5, 5, [B.STONE, B.STONE, B.STONE, B.STONE, B.GRASS, B.WOOD, B.LEAVES, B.FRUIT_ITEMS[0]]);
  column(bare, 5, 5, [B.STONE, B.STONE, B.STONE, B.STONE, B.GRASS, B.WOOD, B.LEAVES]);
  const map = new MapImage(w, tint);
  const plain = new MapImage(bare, tint);
  assert.deepEqual(map.colorAt(2, 2), map.colorAt(3, 2), 'a flower is too small to see from up here');
  assert.deepEqual(map.colorAt(5, 5), plain.colorAt(5, 5), 'fruit on a tree is too: the leaves show');
  const leaves = map.colorAt(5, 5);
  assert.ok(leaves[1] > leaves[0] && leaves[1] > leaves[2], `leaves are green: ${leaves}`);
});

test('water is blue, and darker the deeper it is', () => {
  const w = meadow();
  column(w, 1, 1, [B.STONE, B.STONE, B.STONE, B.SAND, B.WATER]);
  column(w, 1, 4, [B.SAND, B.WATER, B.WATER, B.WATER, B.WATER]);
  const map = new MapImage(w, tint);
  const shallow = map.colorAt(1, 1);
  const deep = map.colorAt(1, 4);
  assert.ok(shallow[2] > shallow[0] && deep[2] > deep[0] && deep[2] > deep[1], `blue: ${shallow} and ${deep}`);
  assert.ok(brightness(deep) < brightness(shallow) - 60, `the deep end is darker: ${deep} against ${shallow}`);
});

test('hills catch the light on their north side and throw a shadow to the south', () => {
  const w = meadow();
  column(w, 3, 3, [B.STONE, B.STONE, B.STONE, B.STONE, B.DIRT, B.DIRT, B.GRASS]);
  const map = new MapImage(w, tint);
  const flat = brightness(map.colorAt(6, 6));
  assert.ok(brightness(map.colorAt(3, 3)) > flat + 20, 'the hill, higher than the ground north of it, is lit');
  assert.ok(brightness(map.colorAt(3, 4)) < flat - 20, 'the ground south of it is in its shadow');
  assert.equal(brightness(map.colorAt(3, 2)), flat, 'north of it nothing changes');
});

test('a change shows on the map once flushed, and so does the shadow it throws', () => {
  const w = meadow();
  const map = new MapImage(w, tint);
  const grass = map.colorAt(2, 2);
  const south = map.colorAt(2, 3);
  const red = B.TOY_BRICKS[0];
  w.set(2, 5, 2, red);
  map.cellsChanged([2, 5, 2, red, -1, 5, 2, red, 2, 5, 99, red]);
  assert.deepEqual(map.colorAt(2, 2), grass, 'nothing is repainted before the flush');
  assert.equal(map.flush(), true);
  const brick = map.colorAt(2, 2);
  assert.ok(brick[0] > 150 && brick[1] < 80, `the brick shows red: ${brick}`);
  assert.ok(brightness(map.colorAt(2, 3)) < brightness(south), 'and the ground south of it is shaded now');
  assert.equal(map.flush(), false, 'nothing left to repaint');
  // Taking it away puts the meadow back exactly.
  w.set(2, 5, 2, B.AIR);
  map.cellsChanged([2, 5, 2, B.AIR]);
  map.flush();
  assert.deepEqual(map.colorAt(2, 2), grass);
  assert.deepEqual(map.colorAt(2, 3), south);
});

test('the map shows the whole island when it fits, and follows you around a bigger one', () => {
  assert.deepEqual(mapFrame({ W: 128, D: 128 }, { x: 3, z: 120 }, 160), { x0: 0, z0: 0, size: 128 });
  // A long thin island sits in the middle, with sea above and below.
  assert.deepEqual(mapFrame({ W: 64, D: 32 }, { x: 10, z: 10 }, 160), { x0: 0, z0: -16, size: 64 });
  // Too big to show at once: the window keeps you in the middle, and stops at the edges.
  assert.deepEqual(mapFrame({ W: 512, D: 512 }, { x: 300, z: 250 }, 160), { x0: 220, z0: 170, size: 160 });
  assert.deepEqual(mapFrame({ W: 512, D: 512 }, { x: 10, z: 500 }, 160), { x0: 0, z0: 352, size: 160 });
});

// Map pixels are world (x, z) with y pointing down the screen. Checked at
// angles away from the axes, where a mirrored convention would show.
test('the map is the 3D view seen from above, not its mirror', () => {
  const close = (a, b, what) => assert.ok(Math.abs(a.x - b.x) < 1e-6 && Math.abs(a.z - b.z) < 1e-6, `${what}: ${JSON.stringify(a)} against ${JSON.stringify(b)}`);
  const flat = (v) => {
    const len = Math.hypot(v.x, v.z);
    return { x: v.x / len, z: v.z / len };
  };
  for (const yaw of [0.4, 1.1, 2.0, 2.9, 4.0, 5.3]) {
    // Avatars and animals are turned with rotation.y; their faces are on their +Z side.
    const body = new THREE.Object3D();
    body.rotation.y = yaw;
    close(flat(new THREE.Vector3(0, 0, 1).applyQuaternion(body.quaternion)), facing(yaw), `facing at ${yaw}`);
    // The real camera code, without WebGL.
    const fake = { view: { yaw, pitch: 0.45, dist: 8, target: new THREE.Vector3(), smooth: new THREE.Vector3(), ready: false }, camera: new THREE.PerspectiveCamera(58, 1.6, 0.1, 100), world: null };
    Renderer.prototype.updateCamera.call(fake, 1 / 60, { x: 40, y: 20, z: 40 }, false);
    fake.camera.updateMatrixWorld();
    const look = looking(yaw);
    close(flat(fake.camera.getWorldDirection(new THREE.Vector3())), look, `looking at ${yaw}`);
    // What is on the right of the screen is on the right of the view on the map:
    // turning the look a quarter clockwise on a y-down page gives (-z, x).
    close(flat(new THREE.Vector3(1, 0, 0).applyQuaternion(fake.camera.quaternion)), { x: -look.z, z: look.x }, `screen right at ${yaw}`);
  }
});
