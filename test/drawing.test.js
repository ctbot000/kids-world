// Drawing boards: furniture that turns, in the Home tab after the
// chalkboard, the picture laid over its white facing out the way the board
// does; found beside you; strokes (lines, fills and wiping clean) checked
// and drawn the same everywhere; pictures kept as text; and the island
// drawing each stroke on its own copy, passing it on from someone at the
// board only, telling newcomers, saving the pictures with the island and
// dropping one when its board is picked up.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as B from '../public/js/shared/blocks.js';
import { furnitureBoxes, modelBoxes } from '../public/js/shared/furniture.js';
import { addToGallery, applyStroke, blankPicture, boardNear, cleanGallery, cleanStroke, COLORS, decodePicture, encodePicture, FRAME_AT, frameCorners, frameNear, GALLERY_MAX, GALLERY_TEXT_MAX, isBlank, isBoard, isFrame, joinGalleries, MAX_POINTS, PICTURE_AT, PICTURE_H, PICTURE_W, pictureCorners, removeFromGallery } from '../public/js/shared/drawing.js';
import { PROTOCOL, Room } from '../public/js/shared/room.js';
import { World } from '../public/js/shared/world.js';
import { addProgress, KEPT_MAX, keptProfile, mergeProfiles } from '../public/js/shared/keeper.js';
import { XP_FOR } from '../public/js/shared/levels.js';
import { STAT_KEYS, STICKERS } from '../public/js/shared/stickers.js';

const at = (px, x, y) => px[y * PICTURE_W + x];

test('the drawing board is furniture that turns, in the Home tab after the chalkboard, its white board at the front', () => {
  const home = B.blocksIn('home');
  assert.equal(home[home.indexOf(B.CHALKBOARD) + 1], B.DRAWING_BOARD);
  const d = B.BLOCKS[B.DRAWING_BOARD];
  assert.equal(d.kind, 'furniture');
  assert.ok(d.solid && !d.wall);
  for (let k = 0; k < 4; k++) assert.ok(isBoard(B.DRAWING_BOARD + k));
  for (const id of [B.CHALKBOARD, B.PICTURE, B.PIANO, B.AIR]) assert.ok(!isBoard(id));
  const boxes = modelBoxes(B.DRAWING_BOARD);
  for (const [x0, y0, z0, x1, y1, z1] of boxes) {
    assert.ok(x0 >= 0 && z0 >= 0 && x1 <= 1 && z1 <= 1 && y0 >= 0 && y1 <= 1.3, 'inside its cell, a little taller');
    assert.ok(x1 > x0 && y1 > y0 && z1 > z0);
  }
  // The white the picture lies over, just behind it.
  const { x0, x1, y0, y1, z } = PICTURE_AT;
  const white = boxes.find((b) => b[6] === '#f7f5ef');
  assert.deepEqual(white.slice(0, 2).concat(white.slice(3, 5)), [x0, y0, x1, y1]);
  assert.ok(white[2] > z && white[2] - z < 0.01, 'the picture just in front of the white');
  assert.ok(Math.abs((x1 - x0) / (y1 - y0) - PICTURE_W / PICTURE_H) < 1e-9, 'the picture its own shape');
});

test('the picture faces out the way the board does, its left on the left as you face it', () => {
  for (let k = 0; k < 4; k++) {
    const id = B.DRAWING_BOARD + k;
    const [bl, br, tr, tl] = pictureCorners(id, 10, 5, 20);
    // The white box, placed in the world the way the mesher places it.
    const white = furnitureBoxes(id, 10, 5, 20, () => B.AIR).find((b) => b[6] === '#f7f5ef');
    for (const p of [bl, br, tr, tl]) {
      assert.ok(p[0] >= white[0] - 0.04 && p[0] <= white[3] + 0.04 && p[2] >= white[2] - 0.04 && p[2] <= white[5] + 0.04, `facing ${k}: on the board`);
    }
    assert.equal(bl[1], 5 + PICTURE_AT.y0);
    assert.equal(tl[1], 5 + PICTURE_AT.y1);
    // Its normal, (br - bl) × (tl - bl), points the way the board faces.
    const u = br.map((v, i) => v - bl[i]);
    const v = tl.map((w, i) => w - bl[i]);
    const n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
    // The way it faces, numbered 0 +x, 1 +z, 2 -x, 3 -z (blocks.js).
    const [fx, fz] = [[1, 0], [0, 1], [-1, 0], [0, -1]][B.BLOCKS[id].front];
    assert.ok(n[0] * fx + n[2] * fz > 0 && Math.abs(n[1]) < 1e-9, `facing ${k}`);
  }
});

test('the drawing board beside you is found, and none further away', () => {
  const w = new World({ W: 16, H: 16, D: 16, sea: 1 });
  w.set(8, 5, 8, B.turnedTo(B.DRAWING_BOARD, 3));
  const near = boardNear(w, { x: 8.5, y: 5, z: 6.8 });
  assert.deepEqual([near.x, near.y, near.z], [8, 5, 8]);
  assert.equal(boardNear(w, { x: 8.5, y: 5, z: 4.5 }), null, 'too far');
  assert.equal(boardNear(w, { x: 8.5, y: 9, z: 7 }), null, 'up above it');
});

test('the picture frame hangs on a wall beside the picture, in the Home tab, its drawing facing out the way it does', () => {
  const home = B.blocksIn('home');
  assert.equal(home[home.indexOf(B.PICTURE) + 1], B.PICTURE_FRAME);
  const d = B.BLOCKS[B.PICTURE_FRAME];
  assert.equal(d.kind, 'furniture');
  assert.ok(!d.solid && d.wall, 'hangs on a wall, like the picture');
  for (let k = 0; k < 4; k++) assert.ok(isFrame(B.PICTURE_FRAME + k));
  for (const id of [B.PICTURE, B.DRAWING_BOARD, B.WALL_TV, B.AIR]) assert.ok(!isFrame(id));
  const boxes = modelBoxes(B.PICTURE_FRAME);
  for (const [x0, y0, z0, x1, y1, z1] of boxes) {
    assert.ok(x0 >= 0 && z0 >= 0 && x1 <= 1 && z1 <= 1 && y0 >= 0 && y1 <= 1, 'inside its cell');
    assert.ok(x1 > x0 && y1 > y0 && z1 > z0);
  }
  // The white the drawing lies over, just behind it, its own shape.
  const white = boxes.find((b) => b[6] === '#f7f5ef');
  assert.deepEqual(white.slice(0, 2).concat(white.slice(3, 5)), [FRAME_AT.x0, FRAME_AT.y0, FRAME_AT.x1, FRAME_AT.y1]);
  assert.ok(white[2] > FRAME_AT.z && white[2] - FRAME_AT.z < 0.01, 'the drawing just in front of the white');
  assert.ok(Math.abs((FRAME_AT.x1 - FRAME_AT.x0) / (FRAME_AT.y1 - FRAME_AT.y0) - PICTURE_W / PICTURE_H) < 1e-9, 'the drawing its own shape');
  // And facing out, whichever way the frame was put on the wall.
  for (let k = 0; k < 4; k++) {
    const id = B.PICTURE_FRAME + k;
    const [bl, br, tr, tl] = frameCorners(id, 10, 5, 20);
    const placed = furnitureBoxes(id, 10, 5, 20, () => B.AIR).find((b) => b[6] === '#f7f5ef');
    for (const p of [bl, br, tr, tl]) {
      assert.ok(p[0] >= placed[0] - 0.04 && p[0] <= placed[3] + 0.04 && p[2] >= placed[2] - 0.04 && p[2] <= placed[5] + 0.04, `facing ${k}: on the frame`);
    }
    assert.equal(bl[1], 5 + FRAME_AT.y0);
    assert.equal(tl[1], 5 + FRAME_AT.y1);
    const u = br.map((v, i) => v - bl[i]);
    const v = tl.map((w, i) => w - bl[i]);
    const n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
    const [fx, fz] = [[1, 0], [0, 1], [-1, 0], [0, -1]][B.BLOCKS[id].front];
    assert.ok(n[0] * fx + n[2] * fz > 0 && Math.abs(n[1]) < 1e-9, `facing ${k}`);
  }
  // Found beside you, like a drawing board, and nowhere else.
  const w = new World({ W: 16, H: 16, D: 16, sea: 1 });
  w.set(8, 5, 8, B.turnedTo(B.PICTURE_FRAME, 3));
  assert.deepEqual([frameNear(w, { x: 8.5, y: 5, z: 6.8 }).x, frameNear(w, { x: 8.5, y: 5, z: 6.8 }).z], [8, 8]);
  assert.equal(frameNear(w, { x: 8.5, y: 5, z: 4.5 }), null, 'too far');
});

test('a drawing hung in a frame is seen by everyone, kept when the island is saved, and goes with the frame when it is picked up', () => {
  const { room, conn, a, b, x, y, z } = island();
  room.world.set(x, y, z, B.turnedTo(B.PICTURE_FRAME, 3));
  const text = encodePicture(picture(4, 12));
  room.receive(a, { t: 'draw', at: [x, y, z], s: { k: 'paste', px: text } });
  assert.deepEqual(room.drawings.get(room.world.index(x, y, z)).px, decodePicture(text));
  assert.equal(b.all('draw')[0].s.px, text, 'passed on to everyone');
  const c = conn();
  assert.equal(c.inbox.find((m) => m.t === 'welcome').drawings.length, 1, 'newcomers told of it');
  const again = new Room({ save: JSON.parse(JSON.stringify(room.exportSave())) });
  assert.deepEqual(again.drawings.get(again.world.index(x, y, z)).px, decodePicture(text), 'kept when saved');
  // Picked up: the frame takes its drawing with it.
  room.world.set(x, y, z, B.AIR);
  assert.equal(room.drawings.size, 0);
});

test('strokes are checked, and draw lines, fill patches and wipe clean', () => {
  for (const bad of [null, 'line', { k: 'line', c: 1, r: 1, pts: [0] }, { k: 'line', c: 1, r: 1, pts: [0, 0, PICTURE_W, 0] }, { k: 'line', c: COLORS.length, r: 1, pts: [0, 0] }, { k: 'line', c: 1, r: 9, pts: [0, 0] }, { k: 'line', c: 1, r: 1, pts: [0.5, 0] }, { k: 'line', c: 1, r: 1, pts: Array(MAX_POINTS * 2 + 2).fill(1) }, { k: 'fill', c: 1, x: -1, y: 0 }, { k: 'spray', c: 1 }]) {
    assert.equal(cleanStroke(bad), null, JSON.stringify(bad)?.slice(0, 60));
  }
  assert.deepEqual(cleanStroke({ k: 'clear', c: 'x' }), { k: 'clear' });
  const px = blankPicture();
  assert.ok(isBlank(px));
  // A thin line across, joined up between its two ends.
  applyStroke(px, cleanStroke({ k: 'line', c: 2, r: 0, pts: [2, 10, 20, 10] }));
  for (let x = 2; x <= 20; x++) assert.equal(at(px, x, 10), 2);
  assert.equal(at(px, 21, 10), 0);
  assert.equal(at(px, 10, 11), 0, 'thin');
  // A thick one is thicker, and stays inside the picture at the edge.
  applyStroke(px, cleanStroke({ k: 'line', c: 7, r: 3, pts: [0, 40, 0, 47] }));
  assert.equal(at(px, 3, 44), 7);
  assert.equal(at(px, 4, 44), 0);
  // A box, then a fill inside it, which stops at its walls.
  const box = [30, 5, 50, 5, 50, 25, 30, 25, 30, 5];
  applyStroke(px, cleanStroke({ k: 'line', c: 1, r: 0, pts: box }));
  applyStroke(px, cleanStroke({ k: 'fill', c: 4, x: 40, y: 15 }));
  assert.equal(at(px, 40, 15), 4);
  assert.equal(at(px, 31, 6), 4);
  assert.equal(at(px, 30, 15), 1, 'the wall stays');
  assert.equal(at(px, 55, 15), 0, 'nothing outside');
  applyStroke(px, { k: 'clear' });
  assert.ok(isBlank(px));
});

test('a picture is kept as short text, and only a picture is read back', () => {
  const px = blankPicture();
  assert.ok(encodePicture(px).length < 12, 'a blank board is a few characters');
  applyStroke(px, cleanStroke({ k: 'line', c: 9, r: 1, pts: [5, 5, 60, 40, 5, 40] }));
  applyStroke(px, cleanStroke({ k: 'fill', c: 6, x: 0, y: 0 }));
  const text = encodePicture(px);
  assert.ok(text.length < 1500, `${text.length} characters`);
  assert.deepEqual(decodePicture(text), px);
  // Every dot a different colour from the next: the longest there is.
  const busy = blankPicture().map((_, i) => (i + (Math.floor(i / PICTURE_W) % 2)) % COLORS.length);
  assert.deepEqual(decodePicture(encodePicture(busy)), busy);
  for (const bad of [null, 42, '', 'AAAA', encodePicture(px).slice(0, -8), 'D/8B'.repeat(4000)]) assert.equal(decodePicture(bad), null, String(bad).slice(0, 20));
});

function island() {
  const room = new Room({ code: '123456', theme: 'sunny', name: 'Sunny Cove', seed: 42 });
  const conn = () => {
    const c = { inbox: [] };
    c.send = (text) => c.inbox.push(JSON.parse(text));
    c.close = () => {};
    c.all = (t) => c.inbox.filter((m) => m.t === t);
    room.attach(c);
    room.receive(c, { t: 'join', protocol: PROTOCOL, name: 'Happy Panda', look: { animal: 'cat' } });
    return c;
  };
  const a = conn();
  const b = conn();
  const pid = a.inbox.find((m) => m.t === 'welcome').you;
  const p = room.players.get(pid);
  const [x, z] = [Math.floor(p.s[0]) + 2, Math.floor(p.s[2])];
  const y = room.world.top(x, z) + 1;
  room.world.set(x, y, z, B.DRAWING_BOARD);
  p.s = [x - 0.5, y, z + 0.5, 0, 0, 0];
  return { room, conn, a, b, pid, p, x, y, z };
}

test('the island draws a stroke from someone at the board and passes it on, and nothing else', () => {
  const { room, a, b, pid, p, x, y, z } = island();
  const line = { k: 'line', c: 2, r: 1, pts: [4, 4, 12, 4] };
  room.receive(a, { t: 'draw', at: [x, y, z], s: line });
  assert.deepEqual(b.all('draw'), [{ t: 'draw', pid, at: [x, y, z], s: line }]);
  assert.equal(a.all('draw').length, 0, 'not back to the one drawing');
  const pic = room.drawings.get(room.world.index(x, y, z)).px;
  assert.equal(at(pic, 8, 4), 2);
  for (const bad of [{ s: { k: 'line', c: 2, r: 1, pts: [99, 0] } }, { s: 'scribble' }, { at: [x, y + 1, z] }, { at: [x, y] }, { at: 'here' }]) room.receive(a, { t: 'draw', at: [x, y, z], s: line, ...bad });
  p.s = [x + 8, y, z, 0, 0, 0];
  room.receive(a, { t: 'draw', at: [x, y, z], s: line });
  assert.equal(b.all('draw').length, 1, 'no stroke that is not one, at no board, from too far away');
  // Wiped clean, it is no picture at all.
  p.s = [x - 0.5, y, z + 0.5, 0, 0, 0];
  room.receive(a, { t: 'draw', at: [x, y, z], s: { k: 'clear' } });
  assert.equal(room.drawings.size, 0);
  assert.equal(b.all('draw').length, 2);
});

test('newcomers are told of the pictures, the island keeps them when saved, and a board picked up takes its picture with it', () => {
  const { room, conn, a, x, y, z } = island();
  room.receive(a, { t: 'draw', at: [x, y, z], s: { k: 'fill', c: 5, x: 0, y: 0 } });
  const c = conn();
  const told = c.inbox.find((m) => m.t === 'welcome').drawings;
  assert.equal(told.length, 1);
  assert.deepEqual(told[0].slice(0, 3), [x, y, z]);
  assert.equal(at(decodePicture(told[0][3]), 30, 30), 5);
  const save = JSON.parse(JSON.stringify(room.exportSave()));
  const again = new Room({ save });
  assert.equal(at(again.drawings.get(again.world.index(x, y, z)).px, 63, 47), 5);
  // A picture whose board is not there any more, or that is no picture, is not loaded.
  const broken = { ...save, drawings: [...save.drawings, [x + 1, y, z, save.drawings[0][3]], [x, y, z + 1, 'nonsense'], 'oops'] };
  assert.equal(new Room({ save: broken }).drawings.size, 1);
  // Picked up, and put down again: a blank board.
  room.world.set(x, y, z, B.AIR);
  assert.equal(room.drawings.size, 0);
  assert.equal(room.exportSave().drawings, undefined, 'none saved');
});

test('strokes are counted, with the Little Artist sticker for 25, and the keeper keeps every count and sticker with room to spare', () => {
  assert.ok(STAT_KEYS.includes('strokes') && XP_FOR.strokes);
  const artist = STICKERS.find((s) => s.key === 'little-artist');
  assert.ok(artist.test({ strokes: 25 }) && !artist.test({ strokes: 24 }));
  const kept = keptProfile({ stats: Object.fromEntries(STAT_KEYS.map((k) => [k, 1])), stickers: Object.fromEntries(STICKERS.map((s) => [s.key, 1])) });
  assert.deepEqual(Object.keys(kept.stats), STAT_KEYS, 'every count');
  assert.equal(Object.keys(kept.stickers).length, STICKERS.length, 'every sticker');
  assert.ok(STICKERS.length * 2 <= KEPT_MAX && STAT_KEYS.length * 2 <= KEPT_MAX, 'room for as many again');
  // One that came after this keeper's code is kept too; a made-up profile stays small.
  assert.equal(keptProfile({ stickers: { 'a-new-one': 5 } }).stickers['a-new-one'], 5);
  const many = Object.fromEntries(Array.from({ length: 1000 }, (_, i) => [`s${'x'.repeat(i % 20)}${String.fromCharCode(97 + (i % 26))}${String.fromCharCode(97 + Math.floor(i / 26) % 26)}`, 1]));
  assert.equal(Object.keys(keptProfile({ stats: many }).stats).length, KEPT_MAX);
});

// A picture with a line of colour c across row y.
const picture = (c = 2, y = 10) => {
  const px = blankPicture();
  applyStroke(px, { k: 'line', c, r: 1, pts: [2, y, 60, y] });
  return px;
};

test('a whole picture is put up on a board from a gallery, as one stroke the island passes on', () => {
  const px = picture(5, 20);
  const text = encodePicture(px);
  assert.deepEqual(cleanStroke({ k: 'paste', px: text }), { k: 'paste', px: text });
  for (const bad of [{ k: 'paste' }, { k: 'paste', px: 'nonsense' }, { k: 'paste', px: 42 }]) assert.equal(cleanStroke(bad), null);
  const on = picture(2, 5);
  applyStroke(on, cleanStroke({ k: 'paste', px: text }));
  assert.deepEqual(on, px, 'the picture there before is gone');
  const { room, a, b, x, y, z } = island();
  room.receive(a, { t: 'draw', at: [x, y, z], s: { k: 'paste', px: text } });
  assert.deepEqual(room.drawings.get(room.world.index(x, y, z)).px, px);
  assert.equal(b.all('draw')[0].s.px, text);
});

test('a gallery keeps pictures newest first, each once, as many as fit, and only pictures', () => {
  let g = cleanGallery(null);
  assert.deepEqual(g, { items: [], changedAt: 0 });
  assert.deepEqual(addToGallery(g, { px: blankPicture() }), { why: 'blank' });
  const first = addToGallery(g, { px: picture(2), island: 'Sunny Cove', at: 1000, id: 'aaaaaaaa' });
  g = first.gallery;
  assert.deepEqual(g.items[0], { id: 'aaaaaaaa', px: encodePicture(picture(2)), at: 1000, island: 'Sunny Cove' });
  assert.equal(g.changedAt, 1000);
  assert.deepEqual(addToGallery(g, { px: picture(2) }), { why: 'same' }, 'the same picture just saved');
  g = addToGallery(g, { px: picture(3), at: 2000, id: 'bbbbbbbb' }).gallery;
  assert.deepEqual(g.items.map((it) => it.id), ['bbbbbbbb', 'aaaaaaaa'], 'newest first');
  // Full at GALLERY_MAX pictures.
  let full = g;
  for (let i = 0; full.items.length < GALLERY_MAX; i++) full = addToGallery(full, { px: picture(i % 11 + 1, i % 40 + 2), at: 3000 + i }).gallery;
  assert.equal(full.items.length, GALLERY_MAX);
  assert.deepEqual(addToGallery(full, { px: picture(9, 45) }), { why: 'full' });
  // Or full when its pictures are busy enough to fill GALLERY_TEXT_MAX.
  const busy = blankPicture().map((_, i) => (i + Math.floor(i / PICTURE_W)) % (COLORS.length - 1) + 1);
  let heavy = cleanGallery(null);
  for (let i = 0; i < GALLERY_MAX; i++) {
    const next = addToGallery(heavy, { px: busy.map((c, k) => (k === i ? 1 + (c % 5) : c)) });
    if (!next.gallery) {
      assert.equal(next.why, 'full');
      break;
    }
    heavy = next.gallery;
  }
  assert.ok(heavy.items.reduce((n, it) => n + it.px.length, 0) <= GALLERY_TEXT_MAX);
  assert.ok(heavy.items.length < GALLERY_MAX);
  // Taken down.
  const down = removeFromGallery(g, 'aaaaaaaa', 5000);
  assert.deepEqual(down.items.map((it) => it.id), ['bbbbbbbb']);
  assert.equal(down.changedAt, 5000);
  // Only pictures, each once.
  const it = g.items[0];
  const messy = cleanGallery({ items: [it, it, { ...it, id: 'X!' }, { ...it, id: 'cccccccc', px: 'nonsense' }, { ...it, id: 'dddddddd', px: encodePicture(blankPicture()) }, 'oops', { ...it, id: 'eeeeeeee', island: 42, at: -5 }], changedAt: 'soon' });
  assert.deepEqual(messy.items.map((x) => x.id), [it.id, 'eeeeeeee']);
  assert.deepEqual([messy.items[1].island, messy.items[1].at, messy.changedAt], ['', 0, 0]);
});

test('the keeper keeps a gallery with the profile: the one changed last wins on another device, and a guest’s pictures join a login’s', () => {
  const mine = addToGallery(null, { px: picture(2), at: 1000, id: 'aaaaaaaa' }).gallery;
  const theirs = addToGallery(mine, { px: picture(3), at: 2000, id: 'bbbbbbbb' }).gallery;
  assert.deepEqual(keptProfile({ gallery: theirs }).gallery, theirs);
  assert.deepEqual(keptProfile({}).gallery, { items: [], changedAt: 0 });
  assert.deepEqual(mergeProfiles({ gallery: mine }, { gallery: theirs }).gallery, theirs);
  assert.deepEqual(mergeProfiles({ gallery: theirs }, { gallery: mine }).gallery, theirs);
  // A picture taken down on one device stays down.
  const down = removeFromGallery(theirs, 'aaaaaaaa', 3000);
  assert.deepEqual(mergeProfiles({ gallery: theirs }, { gallery: down }).gallery.items.map((it) => it.id), ['bbbbbbbb']);
  // A guest's pictures added to a login's: both, newest first, once each.
  const guest = addToGallery(null, { px: picture(4), at: 1500, id: 'gggggggg' }).gallery;
  assert.deepEqual(addProgress({ gallery: theirs }, { gallery: guest }).gallery.items.map((it) => it.id), ['bbbbbbbb', 'gggggggg', 'aaaaaaaa']);
  assert.deepEqual(joinGalleries(theirs, theirs).items.length, 2);
});
