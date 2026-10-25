// Interior design: floors, wallpaper and furniture in the Home tab of the
// toy box. Furniture turns to face whoever puts it down (a picture faces out
// from its wall), turns with a stamp, joins up with the same piece beside
// it, is drawn as boxes inside its cell, and counts for a sticker.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as B from '../public/js/shared/blocks.js';
import { furnitureBoxes, modelBoxes } from '../public/js/shared/furniture.js';
import { LightMap } from '../public/js/shared/light.js';
import { XP_FOR } from '../public/js/shared/levels.js';
import { meshChunk } from '../public/js/render/mesher.js';
import { placeTemplate, stampByKey } from '../public/js/shared/stamps.js';
import { STAT_KEYS, STICKERS } from '../public/js/shared/stickers.js';
import { teaTableNear } from '../public/js/shared/seats.js';
import { applyCells, buildEdit } from '../public/js/shared/tools.js';
import { World } from '../public/js/shared/world.js';

// Flat grass with its top at y = 5.
function meadow() {
  const w = new World({ W: 32, H: 32, D: 32, sea: 2 });
  for (let x = 0; x < 32; x++) {
    for (let z = 0; z < 32; z++) {
      w.set(x, 0, z, B.MAGIC_FLOOR);
      for (let y = 1; y <= 5; y++) w.set(x, y, z, y === 5 ? B.GRASS : B.STONE);
    }
  }
  return w;
}

const onTop = (x, z) => ({ x, y: 5, z, nx: 0, ny: 1, nz: 0, id: B.GRASS });

test('the Home tab has floors, wallpaper and one of each piece of furniture', () => {
  assert.ok(B.CATEGORIES.some((c) => c.key === 'home'));
  const home = B.blocksIn('home');
  for (const id of [B.CHAIR, B.SOFA, B.BED, B.BOOKSHELF, B.COUNTER, B.STOVE, B.FRIDGE, B.TV, B.FIREPLACE, B.PICTURE, B.TABLE, B.FLOOR_LAMP, B.POTTED_PLANT, B.TEA_TABLE, B.PARQUET, B.CHECKER_FLOOR, ...B.CARPETS, ...B.WALLPAPERS]) {
    assert.ok(home.includes(id), B.block(id).name);
  }
  // Only the first of a turned piece's four blocks is in the toy box.
  assert.ok(!home.includes(B.CHAIR + 1));
  for (const id of B.FURNITURE) {
    assert.equal(B.KIND[id], B.K_FURNITURE);
    assert.equal(B.OPAQUE[id], 0, `${B.block(id).key} lets light past`);
    assert.ok(modelBoxes(id).length > 0, `${B.block(id).key} has a model`);
    assert.equal(B.baseOf(id), B.block(id).base);
  }
  assert.equal(B.SOLID[B.SOFA], 1);
  assert.equal(B.SOLID[B.PICTURE], 0);
  assert.ok(B.block(B.FIREPLACE + 2).light > 0 && B.block(B.FLOOR_LAMP).light > 0);
});

test('furniture turns to face the builder, and a picture faces out from its wall', () => {
  const w = meadow();
  // Looking towards +z (facing 0) the chair's front faces -z, back at you.
  for (const [facing, front] of [
    [0, 3],
    [1, 2],
    [2, 1],
    [3, 0],
  ]) {
    const { cells } = buildEdit(w, onTop(10, 10), B.CHAIR, 1, [], facing);
    assert.equal(B.block(cells[3]).front, front, `facing ${facing}`);
    assert.equal(B.baseOf(cells[3]), B.CHAIR);
  }
  // A table does not turn.
  assert.equal(buildEdit(w, onTop(10, 10), B.TABLE, 1, [], 1).cells[3], B.TABLE);
  // Against the +x side of a wall, a picture faces +x, wherever you look.
  w.set(10, 6, 10, B.PLANKS);
  const side = { x: 10, y: 6, z: 10, nx: 1, ny: 0, nz: 0, id: B.PLANKS };
  const { cells } = buildEdit(w, side, B.PICTURE, 1, [], 0);
  assert.deepEqual(cells.slice(0, 3), [11, 6, 10]);
  assert.equal(B.block(cells[3]).front, 0);
});

test('a stamp turns its furniture with it', () => {
  const cells = [[0, 0, 0, B.CHAIR]];
  // The template's chair faces -z, back at the builder; so it does in the world.
  for (let facing = 0; facing < 4; facing++) {
    const [[, , , id]] = placeTemplate(cells, 0, 0, 0, facing);
    assert.equal(B.block(id).front, (3 - facing + 4) % 4, `facing ${facing}`);
  }
  // The Cozy House comes furnished.
  const house = stampByKey('house').cells.map(([, , , id]) => id);
  for (const id of [B.BED, B.TABLE, B.BOOKSHELF, B.CHAIR]) assert.ok(house.includes(id), B.block(id).name);
});

test('sofas side by side join into one long sofa, and beds one behind the other into one bed', () => {
  const w = meadow();
  const arms = (x) => furnitureBoxes(w.get(x, 6, 10), x, 6, 10, (a, b, c) => w.get(a, b, c)).filter((b) => b[4] - b[1] > 0 && b[1] === 6.42 && b[4] === 6.7).length;
  w.set(10, 6, 10, B.SOFA);
  assert.equal(arms(10), 2, 'a lone sofa has two arms');
  w.set(11, 6, 10, B.SOFA);
  assert.equal(arms(10) + arms(11), 2, 'two side by side have an arm at each end');
  // A sofa facing another way does not join.
  w.set(11, 6, 10, B.turnedTo(B.SOFA, 1));
  assert.equal(arms(10), 2);
  // Beds facing -z: the one at the back has the headboard.
  const tall = (z) => furnitureBoxes(w.get(20, 6, z), 20, 6, z, (a, b, c) => w.get(a, b, c)).some((b) => b[4] - 6 > 0.9);
  w.set(20, 6, 10, B.BED);
  w.set(20, 6, 11, B.BED);
  assert.equal(tall(10), false);
  assert.equal(tall(11), true);
  // Every box stays in its cell, however it is turned.
  for (let front = 0; front < 4; front++) {
    for (const [x0, , z0, x1, , z1] of furnitureBoxes(B.turnedTo(B.BOOKSHELF, front), 5, 6, 5, () => B.AIR)) {
      assert.ok(x0 >= 5 && x1 <= 6 && z0 >= 5 && z1 <= 6 && x0 < x1 && z0 < z1);
    }
  }
  // A bookshelf's back is against the wall behind it: +x when it faces -x.
  const back = furnitureBoxes(B.turnedTo(B.BOOKSHELF, 2), 5, 6, 5, () => B.AIR)[0];
  assert.ok(back[3] === 6 && back[0] > 5.9);
});

test('furniture is drawn as boxes, lit by its cell, and the ground under it still shows', () => {
  const w = meadow();
  const visuals = { faceLayer: new Int16Array(256 * 3), tint: new Uint8Array(256 * 3).fill(255), studTint: new Uint8Array(256 * 3).fill(200), layers: new Map([['plain', 3]]) };
  const light = () => {
    const l = new LightMap(w);
    l.computeAll();
    return l;
  };
  const before = meshChunk(w, light(), visuals, 0, 0).opaque.verts;
  w.set(4, 6, 4, B.TABLE);
  const mesh = meshChunk(w, light(), visuals, 0, 0);
  // Top and four legs, six faces of four corners each.
  assert.equal(mesh.opaque.verts - before, 5 * 6 * 4);
  // The grass under it was not hidden, nor its stud: a table is not opaque.
  assert.equal(B.OPAQUE[B.TABLE], 0);
  // A lamp lights the room round it.
  w.set(8, 6, 8, B.FLOOR_LAMP);
  assert.ok(light().lampAt(9, 6, 8) > 10);
});

test('ten pieces of furniture earn Home Sweet Home, and each one XP', () => {
  assert.ok(STAT_KEYS.includes('furnished'));
  assert.ok(XP_FOR.furnished.xp > 0);
  const earned = (n) => STICKERS.find((s) => s.key === 'home-sweet-home').test(Object.fromEntries(STAT_KEYS.map((k) => [k, k === 'furnished' ? n : 0])));
  assert.equal(earned(9), false);
  assert.equal(earned(10), true);
});

test('a build into a room stays put after the edit is applied', () => {
  const w = meadow();
  const { cells } = buildEdit(w, onTop(3, 3), B.SOFA, 1, [], 2);
  applyCells(w, cells);
  assert.equal(B.baseOf(w.get(3, 6, 3)), B.SOFA);
  assert.equal(B.block(w.get(3, 6, 3)).front, 1);
});

test('a seat beside you is found, you sit facing the way it faces, lie in bed from its foot, and stand up in front of it', async () => {
  const { seatNear, seatPose, standUpAt } = await import('../public/js/shared/seats.js');
  const w = meadow();
  // A chair facing +z, and you standing in front of it.
  w.set(10, 6, 10, B.turnedTo(B.CHAIR, 1));
  assert.deepEqual(seatNear(w, { x: 10.5, y: 6, z: 11.6 }), { x: 10, y: 6, z: 10 });
  assert.equal(seatNear(w, { x: 10.5, y: 6, z: 13.5 }), null, 'too far away');
  const sit = seatPose(w, 10, 6, 10);
  assert.equal(sit.pose, 'sit');
  assert.ok(sit.y > 6.4 && sit.y < 6.7, `on the seat: ${sit.y}`);
  // Facing +z: an avatar facing +z has yaw 0, and sits back from the front.
  assert.ok(Math.abs(sit.yaw) < 1e-9);
  assert.ok(sit.z < 10.5 && sit.z > 10.4);
  assert.deepEqual(standUpAt(w, 10, 6, 10), { x: 10.5, y: 6, z: 11.5 }, 'up in front of it');
  // With a wall in front, beside it.
  w.set(10, 6, 11, B.PLANKS);
  const up = standUpAt(w, 10, 6, 10);
  assert.equal(up.y, 6);
  assert.notDeepEqual([up.x, up.z], [10.5, 11.5]);
  // A table is not a seat.
  w.set(12, 6, 10, B.TABLE);
  assert.equal(seatPose(w, 12, 6, 10), null);
  // A bed two long facing -z: lying from the front one, whichever is picked.
  w.set(20, 6, 10, B.BED);
  w.set(20, 6, 11, B.BED);
  for (const z of [10, 11]) {
    const lie = seatPose(w, 20, 6, z);
    assert.equal(lie.pose, 'lie');
    assert.ok(lie.z > 10 && lie.z < 10.3, `feet at the foot: ${lie.z}`);
    assert.ok(Math.abs(Math.abs(lie.yaw) - Math.PI) < 1e-9, 'facing -z, head to +z');
  }
  // A bed one block long: curled up in the middle of it.
  w.set(24, 6, 10, B.turnedTo(B.BED, 0));
  const curl = seatPose(w, 24, 6, 10);
  assert.equal(curl.pose, 'curl');
  assert.deepEqual([curl.x, curl.z], [24.5, 10.5]);
  assert.ok(Math.abs(curl.yaw - Math.PI / 2) < 1e-9, 'facing +x, the way the bed faces');
});

test('sitting down earns Comfy Spot', () => {
  assert.ok(STAT_KEYS.includes('sat') && XP_FOR.sat.xp > 0);
  const sticker = STICKERS.find((s) => s.key === 'comfy');
  assert.equal(sticker.test(Object.fromEntries(STAT_KEYS.map((k) => [k, k === 'sat' ? 1 : 0]))), true);
});

test('a tea table beside your seat makes it a tea party seat, and the stamp sets one for four friends', () => {
  const w = meadow();
  // Sitting in a chair with the tea table right beside it, facing it.
  w.set(10, 6, 10, B.turnedTo(B.CHAIR, 1));
  w.set(10, 6, 9, B.TEA_TABLE);
  assert.deepEqual(teaTableNear(w, 10, 6, 10), { x: 10, y: 6, z: 9 });
  // One further off, one diagonally, one above: not the table you sit at.
  w.set(10, 6, 9, B.AIR);
  w.set(10, 6, 8, B.TEA_TABLE);
  assert.equal(teaTableNear(w, 10, 6, 10), null, 'two steps away');
  w.set(10, 6, 8, B.AIR);
  w.set(11, 6, 9, B.TEA_TABLE);
  assert.equal(teaTableNear(w, 10, 6, 10), null, 'on the diagonal');
  w.set(11, 6, 9, B.AIR);
  w.set(10, 7, 9, B.TEA_TABLE);
  assert.equal(teaTableNear(w, 10, 6, 10), null, 'a step up');
  // The tea is laid out on the cloth: something above it, on the table.
  const boxes = modelBoxes(B.TEA_TABLE);
  const cloth = boxes.find(([, y0, , , y1] ) => y0 === 0.7 && y1 === 0.78);
  assert.ok(cloth, 'the cloth is the table top');
  assert.ok(boxes.some(([, y0]) => y0 >= 0.78), 'the tea sits on the cloth');
  assert.ok(boxes.some(([, , , , y1] ) => y1 > 1), 'the teapot reaches over the top of its cell');
  // The stamp: a checked rug, one tea table, and a chair at each side of it
  // facing in.
  const party = stampByKey('tea-party');
  assert.ok(party);
  const find = (id) => party.cells.filter(([, , , c]) => c === id).length;
  assert.equal(find(B.TEA_TABLE), 1);
  assert.equal([0, 1, 2, 3].reduce((a, k) => a + find(B.CHAIR + k), 0), 4, 'a chair at each side');
  for (let facing = 0; facing < 4; facing++) {
    const cells = placeTemplate(party.cells, 20, 6, 20, facing);
    const table = cells.find(([, , , id]) => B.block(id).model === 'tea-table');
    assert.ok(table, `facing ${facing}`);
    const chairs = cells.filter(([, , , id]) => B.block(id).model === 'chair');
    assert.equal(chairs.length, 4);
    // Every chair sits right beside the table, facing it.
    for (const [x, y, z, id] of chairs) {
      const [fx, fz] = [[1, 0], [0, 1], [-1, 0], [0, -1]][B.block(id).front];
      assert.equal(
        cells.some(([cx, cy, cz, cid]) => cx === x + fx && cy === y && cz === z + fz && B.block(cid).model === 'tea-table'),
        true,
        `facing ${facing}: the chair at ${x},${z} looks at the tea table`,
      );
    }
  }
});

test('sitting down to tea with a friend earns Tea Party', () => {
  assert.ok(STAT_KEYS.includes('teas') && XP_FOR.teas.xp > 0 && XP_FOR.teas.cap > 0);
  const sticker = STICKERS.find((s) => s.key === 'tea-party');
  assert.equal(sticker.icon, '🫖');
  const stats = (n) => Object.fromEntries(STAT_KEYS.map((k) => [k, k === 'teas' ? n : 0]));
  assert.equal(sticker.test(stats(0)), false);
  assert.equal(sticker.test(stats(1)), true);
});

test('fans: an electric fan that turns and a ceiling fan to walk under that lights the room, after the potted plant, drawn as real models', async () => {
  const home = B.blocksIn('home');
  assert.equal(home[home.indexOf(B.POTTED_PLANT) + 1], B.ELECTRIC_FAN, 'right after the potted plant');
  assert.equal(home[home.indexOf(B.ELECTRIC_FAN) + 1], B.CEILING_FAN);
  assert.ok(B.block(B.ELECTRIC_FAN).turns && B.SOLID[B.ELECTRIC_FAN] === 1);
  assert.ok(!B.block(B.CEILING_FAN).turns && B.SOLID[B.CEILING_FAN] === 0, 'walked under');
  assert.ok(B.block(B.CEILING_FAN).light > 0);
  for (const id of [B.ELECTRIC_FAN, B.CEILING_FAN]) {
    for (const [x0, y0, z0, x1, y1, z1] of modelBoxes(id)) assert.ok(x0 >= 0 && z0 >= 0 && y0 >= 0 && x1 <= 1 && y1 <= 1 && z1 <= 1, 'its picture inside its cell');
  }
  // The ceiling fan hangs from the top of its cell, clear of a head below.
  assert.ok(Math.min(...modelBoxes(B.CEILING_FAN).map((b) => b[1])) >= 0.45);

  const THREE = await import('../public/vendor/three.module.js');
  const { fanMaterials, fanModel, swayAt } = await import('../public/js/render/fan-model.js');
  const size = (kind) => new THREE.Box3().setFromObject(fanModel(fanMaterials(), kind));
  const fan = size('electric-fan');
  assert.ok(fan.min.y >= 0 && fan.max.y <= 1.05 && fan.min.x >= -0.5 && fan.max.x <= 0.5 && fan.min.z >= -0.5 && fan.max.z <= 0.5, 'a fan fits its cell');
  const ceiling = size('ceiling-fan');
  assert.ok(ceiling.max.y <= 1.001 && ceiling.min.y >= 0.4, 'up under the ceiling');
  assert.ok(ceiling.max.x > 0.6, 'its blades reach out past its cell');
  // What goes round, and what sweeps from side to side.
  const electric = fanModel(fanMaterials(), 'electric-fan');
  assert.equal(electric.userData.spin.length, 1);
  assert.ok(electric.userData.sway);
  assert.ok(fanModel(fanMaterials(), 'ceiling-fan').userData.spin[0].part.children.length);
  assert.ok(!fanModel(fanMaterials(), 'ceiling-fan').userData.sway, 'a ceiling fan does not sweep');
  for (let t = 0; t < 20; t += 0.5) assert.ok(Math.abs(swayAt(t)) <= 0.7);

  // The mesher leaves their boxes out and says where they stand.
  const w = new World({ W: 16, H: 16, D: 16, sea: 1 });
  w.set(5, 3, 6, B.turnedTo(B.ELECTRIC_FAN, 2));
  w.set(8, 6, 8, B.CEILING_FAN);
  const light = new LightMap(w);
  light.computeAll();
  const visuals = { faceLayer: new Int16Array(256 * 3), tint: new Uint8Array(256 * 3).fill(255), studTint: new Uint8Array(256 * 3).fill(200) };
  const out = meshChunk(w, light, visuals, 0, 0);
  assert.deepEqual(out.reals, [[5, 3, 6, B.turnedTo(B.ELECTRIC_FAN, 2)], [8, 6, 8, B.CEILING_FAN]]);
  assert.ok(light.lampAt(8, 5, 8) > 0, 'the ceiling fan lights the room under it');
});

test('fish tanks: a fish tank with a lamp and a fish bowl after the fans, drawn as real models with fish swimming', async () => {
  const home = B.blocksIn('home');
  assert.equal(home[home.indexOf(B.CEILING_FAN) + 1], B.FISH_TANK, 'right after the ceiling fan');
  assert.equal(home[home.indexOf(B.FISH_TANK) + 1], B.FISH_BOWL);
  for (const id of [B.FISH_TANK, B.FISH_BOWL]) {
    assert.ok(B.SOLID[id] === 1 && B.block(id).real);
    for (const [x0, y0, z0, x1, y1, z1] of modelBoxes(id)) assert.ok(x0 >= 0 && z0 >= 0 && y0 >= 0 && x1 <= 1 && y1 <= 1 && z1 <= 1, 'its picture inside its cell');
  }
  assert.ok(B.block(B.FISH_TANK).light > 0, 'its lamp lights the room');

  const THREE = await import('../public/vendor/three.module.js');
  const { tankMaterials, tankModel, TANK } = await import('../public/js/render/fishtank-model.js');
  for (const kind of ['fish-tank', 'fish-bowl']) {
    const model = tankModel(tankMaterials(), kind);
    const size = new THREE.Box3().setFromObject(model);
    assert.ok(size.min.y > -1e-6 && size.max.y <= 1 && size.min.x >= -0.5 && size.max.x <= 0.5 && size.min.z >= -0.5 && size.max.z <= 0.5, `a ${kind} fits its cell`);
    // Its fish move, and stay in the water.
    const fish = model.children.filter((o) => o.userData.tail);
    assert.ok(fish.length >= 2);
    const before = fish.map((f) => f.position.clone());
    for (let t = 0; t < 30; t += 0.37) {
      model.userData.tick(t);
      model.updateMatrixWorld(true);
      for (const f of fish) {
        const b = new THREE.Box3().setFromObject(f);
        if (kind === 'fish-tank') assert.ok(b.min.y > TANK.y0 - 0.02 && b.max.y < TANK.y1 && Math.abs(b.min.x) < 0.44 && Math.abs(b.max.x) < 0.44 && Math.abs(b.min.z) < 0.27 && Math.abs(b.max.z) < 0.27, 'a fish in its tank');
        else assert.ok(b.max.y < 0.72 && b.min.y > 0.38 && Math.hypot(f.position.x, f.position.z) < 0.15, 'a goldfish in its bowl');
      }
    }
    assert.ok(fish.some((f, i) => f.position.distanceTo(before[i]) > 0.05), 'the fish swim');
  }
});

test('clocks: a cuckoo clock for the wall and a tower clock after the fish tanks, their hands telling the island time', async () => {
  const home = B.blocksIn('home');
  assert.equal(home[home.indexOf(B.FISH_BOWL) + 1], B.CUCKOO_CLOCK, 'right after the fish bowl');
  assert.equal(home[home.indexOf(B.CUCKOO_CLOCK) + 1], B.TOWER_CLOCK);
  assert.ok(B.block(B.CUCKOO_CLOCK).wall && B.SOLID[B.CUCKOO_CLOCK] === 0, 'hangs on a wall');
  assert.ok(B.SOLID[B.TOWER_CLOCK] === 1 && B.block(B.TOWER_CLOCK).light > 0, 'a lit block to build a tower with');
  for (const id of [B.CUCKOO_CLOCK, B.TOWER_CLOCK]) {
    assert.ok(B.block(id).real);
    for (const [x0, y0, z0, x1, y1, z1] of modelBoxes(id)) assert.ok(x0 >= 0 && z0 >= 0 && y0 >= 0 && x1 <= 1 && y1 <= 1 && z1 <= 1, 'its picture inside its cell');
  }

  const THREE = await import('../public/vendor/three.module.js');
  const { clockMaterials, clockModel, handsAt, cuckooAt } = await import('../public/js/render/clock-model.js');
  // Midnight and noon at twelve, six in the morning at six, 3:30 in the afternoon.
  assert.deepEqual(handsAt(0), { hour: 0, minute: 0 });
  assert.deepEqual(handsAt(0.5), { hour: 0, minute: 0 });
  assert.deepEqual(handsAt(0.25), { hour: 0.5, minute: 0 });
  const half = handsAt(15.5 / 24);
  assert.ok(Math.abs(half.hour - 3.5 / 12) < 1e-9 && Math.abs(half.minute - 0.5) < 1e-9);
  // The cuckoo comes out just after the hour, and only then.
  assert.ok(cuckooAt((12 + 1 / 60) / 24) > 0.5);
  assert.equal(cuckooAt((12 + 30 / 60) / 24), 0);
  assert.equal(cuckooAt((11 + 59 / 60) / 24), 0);

  for (const kind of ['cuckoo-clock', 'tower-clock']) {
    const model = clockModel(clockMaterials(), kind);
    const size = new THREE.Box3().setFromObject(model);
    assert.ok(size.min.y > -1e-6 && size.max.y <= 1 + 1e-6 && size.min.x >= -0.5 - 1e-6 && size.max.x <= 0.5 + 1e-6 && size.min.z >= -0.5 - 1e-6 && size.max.z <= 0.5 + 1e-6, `a ${kind} fits its cell`);
    // Its hands follow the time of day, on every face.
    assert.equal(model.userData.hands.length, kind === 'tower-clock' ? 4 : 1);
    model.userData.tick(0, 15.5 / 24);
    for (const [hour, minute] of model.userData.hands) {
      assert.ok(Math.abs(hour.rotation.z - (3.5 / 12) * Math.PI * 2) < 1e-9 && Math.abs(minute.rotation.z - Math.PI) < 1e-9);
      // Turned clockwise: at half past, the minute hand's tip points down.
      minute.updateMatrixWorld(true);
      const tip = new THREE.Box3().setFromObject(minute);
      assert.ok(tip.min.y < hour.position.y - 0.05);
    }
  }
  const cuckoo = clockModel(clockMaterials(), 'cuckoo-clock');
  const bird = cuckoo.userData.bird;
  cuckoo.userData.tick(3, (10 + 10 / 60) / 24);
  assert.equal(bird.visible, false, 'the bird stays in between the hours');
  cuckoo.userData.tick(3, (12 + 1 / 60) / 24);
  assert.ok(bird.visible && bird.position.z < 0.33, 'and pops out of its door on the hour');
});

test('a computer after the Go board, glowing, its picture inside its cell', () => {
  const home = B.blocksIn('home');
  assert.equal(home[home.indexOf(B.GO_BOARD) + 1], B.COMPUTER, 'right after the Go board');
  assert.ok(B.SOLID[B.COMPUTER] === 1 && B.block(B.COMPUTER).light > 0);
  assert.deepEqual(B.block(B.COMPUTER).faces, [257, 258, 259, 260], 'it turns, on four ids in a row');
  for (const [x0, y0, z0, x1, y1, z1] of modelBoxes(B.COMPUTER)) assert.ok(x0 >= 0 && z0 >= 0 && y0 >= 0 && x1 <= 1 && y1 <= 1 && z1 <= 1);
});

test('a pet bed after the tea table, a low basket a pet can get into', () => {
  const home = B.blocksIn('home');
  assert.ok(home.includes(B.PET_BED), 'in the toy box\'s Home tab');
  assert.ok(B.block(B.PET_BED).turns, 'it turns to face whoever puts it down');
  assert.ok(B.SOLID[B.PET_BED] === 0, 'not solid: a pet curls up in it, and you step over it');
  assert.equal(B.KIND[B.PET_BED], B.K_FURNITURE);
  const boxes = modelBoxes(B.PET_BED);
  for (const [x0, y0, z0, x1, y1, z1] of boxes) assert.ok(x0 >= 0 && z0 >= 0 && y0 >= 0 && x1 <= 1 && y1 <= 1 && z1 <= 1, 'its picture inside its cell');
  // A rim round a cushion in the middle, low enough to climb into.
  assert.ok(Math.max(...boxes.map((b) => b[4])) <= 0.5, 'a low bed');
  const cushion = boxes.find(([x0, , z0, x1, , z1]) => x0 < 0.3 && z0 < 0.3 && x1 > 0.7 && z1 > 0.7);
  assert.ok(cushion && cushion[1] < cushion[4], 'a cushion to sleep on');
  // Turned every way, its boxes stay in their cell.
  for (let front = 0; front < 4; front++) {
    for (const [x0, , z0, x1, , z1] of furnitureBoxes(B.turnedTo(B.PET_BED, front), 5, 6, 5, () => B.AIR)) {
      assert.ok(x0 >= 5 && x1 <= 6 && z0 >= 5 && z1 <= 6 && x0 < x1 && z0 < z1);
    }
  }
});
