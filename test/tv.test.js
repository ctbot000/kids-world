// TVs: the TV, the Retro TV and the Wall TV, furniture that turns, side by
// side in the Home tab, their screens glowing at the front and lighting the
// room; found beside you (a Wall TV up on the wall too); the channels going
// round; and the Channel Surfer sticker.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as B from '../public/js/shared/blocks.js';
import { modelBoxes } from '../public/js/shared/furniture.js';
import { XP_FOR } from '../public/js/shared/levels.js';
import { STAT_KEYS, STICKERS } from '../public/js/shared/stickers.js';
import { CHANNELS, isTv, nextChannel, tvNear } from '../public/js/shared/tv.js';
import { World } from '../public/js/shared/world.js';

const TVS = [B.TV, B.RETRO_TV, B.WALL_TV];

test('the TV, the Retro TV and the Wall TV are furniture that turns, side by side in the Home tab, a glowing screen at the front', () => {
  const home = B.blocksIn('home');
  assert.deepEqual(home.slice(home.indexOf(B.TV), home.indexOf(B.TV) + 3), TVS);
  for (const id of TVS) {
    const d = B.BLOCKS[id];
    assert.equal(d.kind, 'furniture');
    assert.ok(d.light > 0, `${d.key} lights the room`);
    for (let k = 0; k < 4; k++) assert.ok(isTv(id + k), `${d.key} facing ${k}`);
    const boxes = modelBoxes(id);
    for (const [x0, y0, z0, x1, y1, z1] of boxes) {
      assert.ok(x0 >= 0 && z0 >= 0 && x1 <= 1 && z1 <= 1 && y0 >= 0 && y1 <= 1.1, `${d.key}: inside its cell`);
      assert.ok(x1 > x0 && y1 > y0 && z1 > z0);
    }
    // The screen: the biggest glowing box, upright and facing the front.
    const glow = boxes.filter((b) => b[7] === 'glow').sort((a, b) => (b[3] - b[0]) * (b[4] - b[1]) - (a[3] - a[0]) * (a[4] - a[1]));
    assert.ok(glow.length >= 3, `${d.key}: a picture on the screen`);
    const [x0, y0, , x1, y1] = glow[0];
    assert.ok((x1 - x0) * (y1 - y0) > 0.15, `${d.key}: a big screen`);
    const back = Math.max(...boxes.map((b) => b[5]));
    assert.ok(glow[0][2] < back - 0.05, `${d.key}: the screen at the front`);
  }
  assert.ok(B.SOLID[B.TV] && B.SOLID[B.RETRO_TV]);
  assert.ok(!B.SOLID[B.WALL_TV] && B.block(B.WALL_TV).wall, 'the Wall TV hangs on a wall');
  // Rabbit ears up over the Retro TV's box.
  assert.ok(Math.max(...modelBoxes(B.RETRO_TV).map((b) => b[4])) > 0.95);
  for (const id of [B.PICTURE, B.ARCADE_BLOB, B.PIANO, B.AIR]) assert.ok(!isTv(id));
});

test('the TV beside you is found, a Wall TV up on the wall too, and none further away', () => {
  const w = new World({ W: 16, H: 16, D: 16, sea: 1 });
  w.set(8, 5, 8, B.turnedTo(B.RETRO_TV, 1));
  const near = tvNear(w, { x: 8.5, y: 5, z: 6.8 });
  assert.deepEqual({ x: near.x, y: near.y, z: near.z, name: near.name }, { x: 8, y: 5, z: 8, name: 'Retro TV' });
  assert.equal(tvNear(w, { x: 8.5, y: 5, z: 4.5 }), null, 'too far');
  assert.equal(tvNear(w, { x: 8.5, y: 9, z: 7 }), null, 'up above it');
  w.set(8, 5, 8, B.AIR);
  w.set(8, 7, 9, B.WALL_TV);
  assert.equal(tvNear(w, { x: 8.5, y: 5, z: 7.8 }).name, 'Wall TV', 'on the wall over your head');
  assert.equal(tvNear(w, { x: 8.5, y: 4, z: 7.8 }), null, 'too high up from further down');
});

test('the channels go round both ways', () => {
  assert.equal(CHANNELS.length, 5);
  assert.equal(new Set(CHANNELS.map((c) => c.key)).size, CHANNELS.length);
  assert.equal(nextChannel(0, 1), 1);
  assert.equal(nextChannel(CHANNELS.length - 1, 1), 0);
  assert.equal(nextChannel(0, -1), CHANNELS.length - 1);
});

test('flipping channels is counted, with the Channel Surfer sticker for flipping through all of them', () => {
  assert.ok(STAT_KEYS.includes('channels'));
  assert.ok(XP_FOR.channels);
  const surfer = STICKERS.find((s) => s.key === 'channel-surfer');
  assert.ok(surfer.test({ channels: CHANNELS.length }) && !surfer.test({ channels: CHANNELS.length - 1 }));
});
