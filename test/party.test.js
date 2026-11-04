// A birthday party: its pieces in the toy box and drawn as real models, the
// Birthday Party stamp, a cake's song, candles and slices, a present opened
// and wrapped again, balloons popped and floating up again, the banner's words
// along its row, what the island tells everyone, and the stickers for it.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as B from '../public/js/shared/blocks.js';
import { keyOf } from '../public/js/shared/arcade.js';
import { furnitureDrop, modelBoxes } from '../public/js/shared/furniture.js';
import { LightMap } from '../public/js/shared/light.js';
import { XP_FOR } from '../public/js/shared/levels.js';
import {
  BALLOON_BACK_MS,
  BANNER_TEXT,
  BLOW_WAIT_MS,
  CAKE_BACK_MS,
  FRESH_MS,
  Party,
  SLICES,
  SONG_MS,
  SURPRISES,
  WRAP_MS,
  balloonColors,
  balloonSpots,
  bannerPlace,
  partyNear,
  presentCoins,
} from '../public/js/shared/party.js';
import { PROTOCOL, Room } from '../public/js/shared/room.js';
import { seatOf } from '../public/js/shared/seats.js';
import { placeTemplate, stampByKey } from '../public/js/shared/stamps.js';
import { STAT_KEYS, STICKERS } from '../public/js/shared/stickers.js';
import { PHRASES } from '../public/js/shared/words.js';
import { World } from '../public/js/shared/world.js';
import { meshChunk } from '../public/js/render/mesher.js';

const THREE = await import('../public/vendor/three.module.js');
const { PARTY_KINDS, PRESENTS, bannerShape, bannerLetters, cakeBody, partyMaterials, partyModel } = await import('../public/js/render/party-model.js');
const PIECES = [B.PARTY_TABLE, B.BIRTHDAY_CAKE, B.PRESENT, B.BALLOONS, B.PARTY_BANNER];

// A closed shape's volume, positive when its faces wind outward.
function signedVolume(g) {
  const p = g.attributes.position;
  const idx = g.index.array;
  const [a, b, c] = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];
  let v = 0;
  for (let i = 0; i < idx.length; i += 3) {
    a.fromBufferAttribute(p, idx[i]);
    b.fromBufferAttribute(p, idx[i + 1]);
    c.fromBufferAttribute(p, idx[i + 2]);
    v += a.dot(b.clone().cross(c)) / 6;
  }
  return v;
}

test('the pieces of a party come last in the Home tab, and are drawn as real models', () => {
  const home = B.blocksIn('home');
  assert.deepEqual(home.slice(-PIECES.length), PIECES, 'after the pianos, together');
  assert.ok(home.indexOf(B.WALLPAPERS[3]) + 1 === home.indexOf(B.PARTY_WALLPAPER), 'the wallpaper after the others');
  for (const id of PIECES) {
    assert.ok(PARTY_KINDS.has(B.block(id).real), `${B.block(id).name} is a real model`);
    for (const [x0, y0, z0, x1, y1, z1] of modelBoxes(id, () => false)) assert.ok(x0 >= -0.01 && z0 >= -0.01 && y0 >= 0 && x1 <= 1.01 && y1 <= 1.01 && z1 <= 1.01, `its picture inside its cell: ${B.block(id).name}`);
  }
  assert.ok(B.block(B.PARTY_BANNER).wall && B.block(B.PARTY_BANNER).turns && !B.SOLID[B.PARTY_BANNER], 'the banner hangs on a wall');
  assert.equal(B.SOLID[B.BALLOONS], 0, 'you walk through balloons');
  assert.equal(B.SOLID[B.BIRTHDAY_CAKE], 1);
  assert.ok(B.block(B.BIRTHDAY_CAKE).light > 0, 'its candles give a little light');
  // A cake and a present stand down on a table's top, any table.
  for (const table of [B.TABLE, B.PARTY_TABLE]) {
    for (const id of [B.BIRTHDAY_CAKE, B.PRESENT, B.BALLOONS]) assert.ok(furnitureDrop(id, table) < 0, 'stands on the table');
  }
  assert.equal(furnitureDrop(B.BIRTHDAY_CAKE, B.STONE), 0);
  // The mesher leaves their boxes out and says where they stand.
  const w = new World({ W: 16, H: 16, D: 16, sea: 1 });
  PIECES.forEach((id, i) => w.set(2 + i * 2, 3, 6, id));
  const light = new LightMap(w);
  light.computeAll();
  const visuals = { faceLayer: new Int16Array(B.BLOCK_IDS * 3), tint: new Uint8Array(B.BLOCK_IDS * 3).fill(255), studTint: new Uint8Array(B.BLOCK_IDS * 3).fill(200) };
  assert.deepEqual(meshChunk(w, light, visuals, 0, 0).reals.map((r) => r[3]), PIECES);
});

test('the Birthday Party stamp is a room with a way in, a laid table, the cake, a banner, presents and balloons', () => {
  const stamp = stampByKey('birthday-party');
  assert.ok(stamp && stamp.icon === '🎂');
  for (let facing = 0; facing < 4; facing++) {
    const w = new World({ W: 64, H: 40, D: 64, sea: 1 });
    for (const [x, y, z, id] of placeTemplate(stamp.cells, 32, 20, 32, facing)) w.set(x, y, z, id);
    const find = (id) => {
      const out = [];
      for (let x = 10; x < 54; x++) for (let z = 10; z < 54; z++) for (let y = 15; y < 36; y++) if (B.baseOf(w.get(x, y, z)) === id) out.push([x, y, z]);
      return out;
    };
    const [cake] = find(B.BIRTHDAY_CAKE);
    assert.equal(find(B.BIRTHDAY_CAKE).length, 1, 'one cake');
    assert.equal(w.get(cake[0], cake[1] - 1, cake[2]), B.PARTY_TABLE, 'on the party table');
    assert.ok(furnitureDrop(B.BIRTHDAY_CAKE, w.get(cake[0], cake[1] - 1, cake[2])) < 0);
    // Whichever way it faces, the way in is three wide, on the side you stamped
    // it from, and clear from there to where you walk up to the cake.
    const { f, r } = [
      { f: [0, 1], r: [-1, 0] },
      { f: [1, 0], r: [0, 1] },
      { f: [0, -1], r: [1, 0] },
      { f: [-1, 0], r: [0, -1] },
    ][facing];
    const at = (dx, dy, dz) => w.get(32 + dx * r[0] + dz * f[0], 20 + dy, 32 + dx * r[1] + dz * f[1]);
    for (const dx of [-1, 0, 1]) for (const dy of [0, 1, 2]) assert.equal(at(dx, dy, 0), 0, `the way in is open at ${dx},${dy}`);
    for (const dz of [1, 2, 3, 4, 5, 6]) for (const dy of [0, 1]) assert.equal(at(2, dy, dz), 0, `a clear walk up the side of the table at ${dz},${dy}`);
    for (const dy of [0, 1]) assert.equal(at(1, dy, 6), 0, 'room to stand beside the cake');
    // A chair down each side of the table, facing it, but beside the cake.
    const chairs = find(B.CHAIR);
    assert.equal(chairs.length, 10, 'ten chairs');
    for (const [x, y, z] of chairs) {
      assert.ok(seatOf(w.get(x, y, z)), 'a seat');
      const { front } = B.block(w.get(x, y, z));
      const [fx, fz] = [[1, 0], [0, 1], [-1, 0], [0, -1]][front];
      assert.equal(w.get(x + fx, y, z + fz), B.PARTY_TABLE, 'it faces the table');
      assert.ok(Math.hypot(x - cake[0], z - cake[2]) >= 1.4, 'none in the way of the cake');
    }
    // The banner: seven in a row in the room saying it all, read from your left.
    const banners = find(B.PARTY_BANNER);
    assert.equal(banners.length, 14, 'seven inside and seven outside');
    const places = banners.map(([x, y, z]) => bannerPlace(w, x, y, z)).sort((a, b) => a - b);
    assert.deepEqual(places, [0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6]);
    for (const [x, y, z] of banners) {
      const { front } = B.block(w.get(x, y, z));
      const [fx, fz] = [[1, 0], [0, 1], [-1, 0], [0, -1]][front];
      assert.equal(B.OPAQUE[w.get(x - fx, y, z - fz)], 1, 'a wall behind it');
      assert.equal(w.get(x + fx, y, z + fz) === 0 || !B.SOLID[w.get(x + fx, y, z + fz)], true, 'open in front of it');
    }
    assert.ok(find(B.PRESENT).length >= 5, 'a pile of presents');
    assert.ok(find(B.BALLOONS).length >= 6, 'balloons');
    assert.ok(find(B.PIANO).length === 1, 'a piano to play the song on');
    // Daylight comes in over the party, and lamps for after dark.
    const light = new LightMap(w);
    light.computeAll();
    const [cx, cy, cz] = cake;
    assert.ok(light.skyAt(cx + r[0] * 4, cy - 1, cz + r[1] * 4) === 15, 'a skylight lets the sun in beside the table');
    assert.ok(light.skyAt(cx + r[0], cy - 1, cz + r[1]) >= 11, 'and the room is light beside the cake');
    assert.ok(light.lampAt(cx + r[0], cy - 1, cz + r[1]) >= 7, 'lamps for after dark');
  }
});

test('the song and the candles: sung, blown out, eaten slice by slice, and a fresh cake', () => {
  const party = new Party();
  const key = '1,2,3';
  let now = 1000;
  assert.equal(party.cake(key, now).phase, 'lit');
  assert.deepEqual(party.tap(B.BIRTHDAY_CAKE, key, now), { op: 'sing' });
  assert.equal(party.cake(key, now + 1).phase, 'song');
  assert.equal(party.cake(key, now + SONG_MS - 1).phase, 'song', 'all through the song');
  assert.equal(party.cake(key, now + SONG_MS).phase, 'blow', 'then time to blow them out');
  // Left too long, it all starts over: nobody blew.
  assert.equal(party.cake(key, now + BLOW_WAIT_MS).phase, 'lit');
  assert.deepEqual(party.tap(B.BIRTHDAY_CAKE, key, now + BLOW_WAIT_MS), { op: 'sing' });
  now += BLOW_WAIT_MS + SONG_MS;
  assert.deepEqual(party.tap(B.BIRTHDAY_CAKE, key, now), { op: 'blow' });
  assert.deepEqual(party.cake(key, now), { phase: 'out', at: now, slices: SLICES });
  // A slice at a time.
  for (let left = SLICES - 1; left >= 0; left--) {
    now += 100;
    assert.deepEqual(party.tap(B.BIRTHDAY_CAKE, key, now), { op: 'eat', slices: left });
    assert.equal(party.cake(key, now).slices, left);
  }
  // None left: nothing to do until a fresh one comes, soon after.
  assert.equal(party.tap(B.BIRTHDAY_CAKE, key, now + 1), null);
  assert.equal(party.cake(key, now + FRESH_MS - 1).phase, 'out');
  assert.deepEqual(party.cake(key, now + FRESH_MS), { phase: 'lit', at: 0, slices: SLICES });
  // Not all eaten, a fresh one comes all the same in a while.
  party.tap(B.BIRTHDAY_CAKE, key, now + FRESH_MS);
  const at = now + FRESH_MS + SONG_MS;
  party.tap(B.BIRTHDAY_CAKE, key, at);
  party.tap(B.BIRTHDAY_CAKE, key, at + 10);
  assert.equal(party.cake(key, at + CAKE_BACK_MS - 1).slices, SLICES - 1);
  assert.equal(party.cake(key, at + CAKE_BACK_MS).phase, 'lit');
});

test('everyone hears the same: a page following the island shows what it does', () => {
  const island = new Party();
  const page = new Party();
  const key = '4,5,6';
  const both = (id, now) => {
    const news = island.tap(id, key, now);
    if (news) page.hear(key, news, now + 5);
    return news;
  };
  both(B.BIRTHDAY_CAKE, 100);
  assert.equal(page.cake(key, 200).phase, 'song');
  both(B.BIRTHDAY_CAKE, 100 + SONG_MS);
  assert.equal(page.cake(key, 200 + SONG_MS).phase, 'out');
  both(B.BIRTHDAY_CAKE, 200 + SONG_MS);
  assert.equal(page.cake(key, 300 + SONG_MS).slices, SLICES - 1);
  // A page that came late, told only of a slice, still shows the cake cut.
  const late = new Party();
  late.hear(key, { op: 'eat', slices: 3 }, 50);
  assert.equal(late.cake(key, 60).slices, 3);
  // What a page is told is kept within reason, whoever sends it.
  late.hear('a', { op: 'eat', slices: 99 }, 50);
  assert.equal(late.cake('a', 60).slices, SLICES);
  late.hear('b', { op: 'pop', i: 7 }, 50);
  assert.equal(late.balloonsUp('b', 60), 3);
  late.hear('c', { op: 'open', toy: 'lots' }, 50);
  assert.equal(late.present('c', 60).toy, 0);
  late.hear('d', { op: 'open', toy: SURPRISES.length + 1 }, 50);
  assert.equal(late.present('d', 60).toy, 1);
});

test('a present opens for one, and is wrapped again in a while; balloons pop one at a time and float up again', () => {
  const party = new Party();
  const key = '7,8,9';
  const rand = () => 0.5;
  const news = party.tap(B.PRESENT, key, 500, rand);
  assert.deepEqual(news, { op: 'open', toy: Math.floor(0.5 * SURPRISES.length) });
  assert.ok(SURPRISES.length >= 4 && SURPRISES.every((t) => !t.rare), 'the common toys');
  assert.ok(party.present(key, 501));
  assert.equal(party.tap(B.PRESENT, key, 600), null, 'already open');
  assert.equal(party.present(key, 500 + WRAP_MS), null, 'wrapped again');
  assert.ok(party.tap(B.PRESENT, key, 500 + WRAP_MS), 'to be opened again');
  for (const r of [0, 0.5, 0.999]) {
    const coins = presentCoins(() => r);
    assert.ok(coins >= 1 && coins <= 3 && Number.isInteger(coins));
  }
  const bunch = '1,1,1';
  assert.equal(party.balloonsUp(bunch, 0), 3);
  for (const i of [0, 1, 2]) assert.deepEqual(party.tap(B.BALLOONS, bunch, 1000 + i), { op: 'pop', i });
  assert.equal(party.balloonsUp(bunch, 1003), 0);
  assert.equal(party.tap(B.BALLOONS, bunch, 1004), null, 'none left to pop');
  assert.equal(party.balloonUp(bunch, 0, 1000 + BALLOON_BACK_MS - 1), false);
  assert.equal(party.balloonUp(bunch, 0, 1000 + BALLOON_BACK_MS), true, 'up again');
  assert.equal(party.balloonsUp(bunch, 1002 + BALLOON_BACK_MS), 3);
  // Nothing happens at anything else.
  assert.equal(party.tap(B.PIANO, 'x', 1), null);
  assert.equal(party.tap(B.AIR, 'x', 1), null);
});

test('what of a party is beside you: the nearest, a cake a row up on its table, and what is left to do', () => {
  const w = new World({ W: 24, H: 24, D: 24, sea: 1 });
  const party = new Party();
  w.set(10, 5, 10, B.PARTY_TABLE);
  w.set(10, 6, 10, B.BIRTHDAY_CAKE);
  w.set(14, 5, 10, B.PRESENT);
  w.set(10, 5, 14, B.BALLOONS);
  const near = (x, z, seated = false, now = 0) => partyNear(w, { x, y: 5, z }, party, now, seated);
  assert.equal(near(11.5, 10.5).kind, 'cake', 'on the table, a row above your feet');
  assert.equal(near(13, 10.5).kind, 'present', 'nearer the present');
  assert.equal(near(10.5, 13).kind, 'balloons');
  assert.equal(near(5, 5), null, 'too far');
  assert.equal(partyNear(w, { x: 11.5, y: 9, z: 10.5 }, party, 0), null, 'up above it');
  // Sitting: only the cake, from further along the table too.
  assert.equal(near(13, 10.5, true).kind, 'cake', 'the present is not for sitting at');
  assert.equal(near(10.5, 13, true).kind, 'cake', 'three along the table');
  assert.equal(near(10.5, 14.5, true), null);
  // Nothing left to do there.
  const present = keyOf(14, 5, 10);
  party.tap(B.PRESENT, present, 1);
  assert.equal(near(14.5, 12, false, 2), null, 'an open present');
  const bunch = keyOf(10, 5, 14);
  for (let i = 0; i < 3; i++) party.tap(B.BALLOONS, bunch, 1);
  assert.equal(near(10.5, 15.8, false, 2), null, 'all popped');
  const cake = keyOf(10, 6, 10);
  party.tap(B.BIRTHDAY_CAKE, cake, 1);
  party.tap(B.BIRTHDAY_CAKE, cake, 1);
  assert.equal(near(11.5, 10.5, false, 2).kind, 'cake', 'slices to eat');
  for (let i = 0; i < SLICES; i++) party.tap(B.BIRTHDAY_CAKE, cake, 2);
  assert.equal(near(11.5, 10.5, false, 3), null, 'all eaten');
});

test('a banner reads from your left along its row, whichever way it faces, and only the same way round', () => {
  const w = new World({ W: 24, H: 24, D: 24, sea: 1 });
  // Facing -z (its base), you look towards +z: your left is +x.
  for (let x = 8; x < 12; x++) w.set(x, 5, 8, B.PARTY_BANNER);
  assert.deepEqual([11, 10, 9, 8].map((x) => bannerPlace(w, x, 5, 8)), [0, 1, 2, 3]);
  // Facing +x, you look towards -x: your left is +z.
  const faced = B.turnedTo(B.PARTY_BANNER, 0);
  for (let z = 14; z < 17; z++) w.set(8, 5, z, faced);
  assert.deepEqual([16, 15, 14].map((z) => bannerPlace(w, 8, 5, z)), [0, 1, 2]);
  // Another row, or round a corner, is its own.
  w.set(12, 5, 8, B.turnedTo(B.PARTY_BANNER, 2));
  assert.equal(bannerPlace(w, 11, 5, 8), 0);
  assert.equal(bannerPlace(w, 3, 5, 3), 0, 'no banner there');
  // Seven pieces say it all.
  assert.equal(BANNER_TEXT.slice(0, 14), 'HAPPY♥BIRTHDAY');
  for (const c of BANNER_TEXT) assert.ok(bannerLetters().includes(c), `a letter ${c}`);
  // A very long row does not run on for ever.
  for (let x = 0; x < 24; x++) w.set(x, 9, 2, B.PARTY_BANNER);
  assert.ok(bannerPlace(w, 0, 9, 2) <= BANNER_TEXT.length);
});

test('the island tells everyone what happens at a party, from up close only, and nothing for what is not there', () => {
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
  room.world.set(x, y, z, B.BIRTHDAY_CAKE);
  room.world.set(x + 1, y, z, B.PRESENT);
  room.world.set(x + 2, y, z, B.BALLOONS);
  p.s = [x - 0.5, y, z + 0.5];
  room.receive(a, { t: 'party', at: [x, y, z] });
  assert.deepEqual(b.all('party'), [{ t: 'party', pid, at: [x, y, z], op: 'sing' }]);
  assert.deepEqual(a.all('party'), b.all('party'), 'back to whoever did it too');
  room.receive(a, { t: 'party', at: [x, y, z] });
  assert.equal(b.all('party').at(-1).op, 'blow');
  room.receive(a, { t: 'party', at: [x, y, z] });
  assert.deepEqual(b.all('party').at(-1), { t: 'party', pid, at: [x, y, z], op: 'eat', slices: SLICES - 1 });
  room.receive(a, { t: 'party', at: [x + 1, y, z] });
  const open = b.all('party').at(-1);
  assert.equal(open.op, 'open');
  assert.ok(Number.isInteger(open.toy) && open.toy >= 0 && open.toy < SURPRISES.length);
  room.receive(a, { t: 'party', at: [x + 2, y, z] });
  assert.deepEqual(b.all('party').at(-1), { t: 'party', pid, at: [x + 2, y, z], op: 'pop', i: 0 });
  // Nothing for what is not there, what makes no sense or from far away.
  const told = b.all('party').length;
  room.receive(a, { t: 'party', at: [x - 2, y + 2, z] });
  room.receive(a, { t: 'party' });
  room.receive(a, { t: 'party', at: [x, y] });
  room.receive(a, { t: 'party', at: ['a', 2, 3] });
  room.receive(a, { t: 'party', at: [x + 1, y, z] });
  assert.equal(b.all('party').length, told, 'the open present stays open too');
  p.s = [x + 12, y, z];
  room.receive(a, { t: 'party', at: [x + 2, y, z] });
  assert.equal(b.all('party').length, told, 'not from far away');
  p.s = [x, y + 8, z];
  room.receive(a, { t: 'party', at: [x + 2, y, z] });
  assert.equal(b.all('party').length, told, 'not from high up');
});

test('stickers and XP for a party, within what is kept', () => {
  for (const key of ['wishes', 'slices', 'presents', 'balloons']) {
    assert.ok(STAT_KEYS.includes(key), `${key} is counted`);
    assert.ok(XP_FOR[key].xp > 0 && XP_FOR[key].cap > 0, `${key} earns XP up to a point: a cake is easy to come by`);
  }
  const has = (key, stats) => STICKERS.find((s) => s.key === key).test(stats);
  assert.ok(has('make-a-wish', { wishes: 1 }) && !has('make-a-wish', { wishes: 0 }));
  assert.ok(has('piece-of-cake', { slices: 8 }) && !has('piece-of-cake', { slices: 7 }));
  assert.ok(has('surprise', { presents: 5 }) && !has('surprise', { presents: 4 }));
  assert.ok(has('pop-pop-pop', { balloons: 20 }) && !has('pop-pop-pop', { balloons: 19 }));
  assert.equal(new Set(STICKERS.map((s) => s.key)).size, STICKERS.length, 'each key once');
  assert.ok(PHRASES.includes('Happy birthday!') && PHRASES.includes('Make a wish!'));
  // The old phrases keep their places: the index is what travels.
  assert.equal(PHRASES.indexOf('Tea time!'), PHRASES.length - 3);
});

test('the cake: inside its cell, its faces outward, a slice gone showing the sponge, its candles out with a blow', () => {
  const party = new Party();
  const materials = partyMaterials();
  const world = new World({ W: 16, H: 16, D: 16, sea: 1 });
  const cell = [5, 3, 6];
  const key = keyOf(...cell);
  const model = partyModel(materials, 'birthday-cake', cell, world, party);
  assert.equal(model.userData.together, true, 'on the renderer\'s own clock, with what the island says');
  const box = new THREE.Box3().setFromObject(model);
  assert.ok(box.min.y >= 0 && box.max.y <= 1 && box.max.x <= 0.5 && box.min.x >= -0.5 && box.max.z <= 0.5 && box.min.z >= -0.5, 'it fits its cell');
  // The faces of a slice wind outward, so none of it goes missing.
  assert.ok(signedVolume(cakeBody(1)) > 0, 'a slice winds outward');
  assert.ok(signedVolume(cakeBody(SLICES)) > 0, 'and a whole cake');
  for (let n = 2; n <= SLICES; n++) assert.ok(cakeBody(n).attributes.position.count > cakeBody(n - 1).attributes.position.count, 'more slices, more cake');

  const flames = model.children.find((m) => m.userData.flames);
  const body = model.userData.body;
  model.userData.tick(1);
  assert.ok(flames.visible && body.visible, 'lit');
  assert.equal(materials.flame.uniforms.uTime.value, 1, 'they flicker');
  party.tap(B.BIRTHDAY_CAKE, key, 1000);
  model.userData.tick(1.5);
  assert.ok(flames.visible, 'lit through the song');
  party.tap(B.BIRTHDAY_CAKE, key, 2000);
  model.userData.tick(2);
  assert.ok(!flames.visible, 'blown out');
  assert.equal(body.geometry, cakeBody(SLICES));
  party.tap(B.BIRTHDAY_CAKE, key, 2100);
  model.userData.tick(2.2);
  assert.equal(body.geometry, cakeBody(SLICES - 1), 'a slice gone');
  for (let i = 0; i < SLICES - 1; i++) party.tap(B.BIRTHDAY_CAKE, key, 2200);
  model.userData.tick(2.3);
  assert.ok(!body.visible, 'all gone');
  model.userData.tick(2.2 + FRESH_MS / 1000);
  assert.ok(body.visible && flames.visible, 'a fresh one, its candles lit');
  assert.equal(body.geometry, cakeBody(SLICES));
  // A chunk drawn again in the middle of it all shows it just the same.
  party.tap(B.BIRTHDAY_CAKE, key, 9000);
  party.tap(B.BIRTHDAY_CAKE, key, 9100);
  party.tap(B.BIRTHDAY_CAKE, key, 9200);
  const again = partyModel(materials, 'birthday-cake', cell, world, party);
  again.userData.tick(9.3);
  assert.equal(again.userData.body.geometry, cakeBody(SLICES - 1));
  assert.ok(!again.children.find((m) => m.userData.flames).visible);
});

test('a present: its own colour and size by cell, its lid flying off, a toy hopping out and it wrapped again; a pile sits one on the other', () => {
  const party = new Party();
  const materials = partyMaterials();
  const world = new World({ W: 16, H: 16, D: 16, sea: 1 });
  const seen = new Set();
  for (let x = 0; x < 8; x++) {
    const m = partyModel(materials, 'present', [x, 3, 6], world, party);
    seen.add(m.userData.variant);
    const box = new THREE.Box3().setFromObject(m);
    assert.ok(box.min.y >= -0.001 && box.max.y <= 1 && box.max.x <= 0.5 && box.min.x >= -0.5 && box.max.z <= 0.5 && box.min.z >= -0.5, `it fits its cell: ${x}`);
  }
  assert.equal(seen.size, PRESENTS.length, 'along a row, every kind');

  const cell = [5, 3, 6];
  const key = keyOf(...cell);
  const model = partyModel(materials, 'present', cell, world, party);
  const lid = model.userData.lid;
  const rest = lid.position.y;
  model.userData.tick(10);
  assert.ok(lid.visible && !model.userData.toy);
  party.tap(B.PRESENT, key, 10_000, () => 0);
  model.userData.tick(10.2);
  assert.ok(lid.visible && lid.position.y > rest, 'the lid flies up');
  assert.ok(model.userData.toy, 'out comes a toy');
  assert.ok(model.userData.toy.children.length > 0, `it is ${SURPRISES[0].name}`);
  model.userData.tick(11);
  assert.ok(!lid.visible, 'the lid has gone');
  const toy = model.userData.toy;
  assert.ok(toy.parent === model && toy.scale.x > 0.3, 'the toy is out');
  model.userData.tick(14);
  assert.equal(toy.parent, null, 'it has gone back in');
  assert.ok(!lid.visible, 'and the box stays open');
  model.userData.tick(10 + WRAP_MS / 1000);
  assert.ok(lid.visible && lid.position.y === rest, 'wrapped again');

  // On a present, it sits on the lid of the one under it, however high that is.
  world.set(5, 3, 6, B.PRESENT);
  world.set(5, 4, 6, B.PRESENT);
  const under = partyModel(materials, 'present', [5, 3, 6], world, party);
  const over = partyModel(materials, 'present', [5, 4, 6], world, party);
  over.position.y = 1;
  const h = new THREE.Box3().setFromObject(over);
  assert.ok(h.min.y > PRESENTS[under.userData.variant].h - 0.02 && h.min.y < PRESENTS[under.userData.variant].h + 0.02, 'right on top');
});

test('balloons: tall with room above them and short without, bobbing, and one popped until another floats up', () => {
  const party = new Party();
  const materials = partyMaterials();
  const world = new World({ W: 16, H: 16, D: 16, sea: 1 });
  const cell = [5, 3, 6];
  const key = keyOf(...cell);
  const model = partyModel(materials, 'balloons', cell, world, party);
  const tall = new THREE.Box3().setFromObject(model);
  assert.ok(tall.max.y > 1.5 && tall.max.y <= 2, `two blocks high with room (${tall.max.y})`);
  world.set(5, 4, 6, B.STONE);
  const low = partyModel(materials, 'balloons', cell, world, party);
  const short = new THREE.Box3().setFromObject(low);
  assert.ok(short.max.y <= 1, `inside the cell under a ceiling (${short.max.y})`);
  for (const t of [true, false]) assert.equal(balloonSpots(t).length, 3);
  assert.equal(new Set(balloonColors(...cell)).size, 3, 'three colours');
  // Each balloon's colour differs from the bunch beside it, so they are not all alike.
  assert.notDeepEqual(balloonColors(5, 3, 6), balloonColors(6, 3, 6));

  const [first] = model.userData.balloons;
  model.userData.tick(1);
  const before = first.rotation.z;
  model.userData.tick(2);
  assert.notEqual(first.rotation.z, before, 'it bobs');
  party.tap(B.BALLOONS, key, 2500);
  model.userData.tick(2.6);
  assert.ok(!first.visible && model.userData.balloons[1].visible, 'one popped');
  model.userData.tick(2.5 + BALLOON_BACK_MS / 1000);
  assert.ok(first.visible, 'another floats up');
  assert.ok(first.scale.x < 0.1, 'growing from nothing');
  model.userData.tick(3.5 + BALLOON_BACK_MS / 1000);
  assert.equal(first.scale.x, 1);
});

test('a party table joins up with the one beside it, its places laid unless something stands on it; a banner has its letters', () => {
  const materials = partyMaterials();
  const world = new World({ W: 16, H: 16, D: 16, sea: 1 });
  const party = new Party();
  world.set(5, 3, 6, B.PARTY_TABLE);
  const alone = partyModel(materials, 'party-table', [5, 3, 6], world, party);
  assert.ok(alone.userData.laid);
  const box = new THREE.Box3().setFromObject(alone);
  assert.ok(box.max.x < 0.5 && box.min.x > -0.5, 'its cloth stops short of the edge on its own');
  world.set(5, 3, 7, B.PARTY_TABLE);
  const joined = partyModel(materials, 'party-table', [5, 3, 6], world, party);
  assert.equal(new THREE.Box3().setFromObject(joined).max.z, 0.5, 'its cloth runs on');
  world.set(5, 4, 6, B.BIRTHDAY_CAKE);
  const set = partyModel(materials, 'party-table', [5, 3, 6], world, party);
  assert.equal(set.userData.laid, false, 'no place laid under the cake');
  assert.ok(set.children[0].geometry.attributes.position.count < joined.children[0].geometry.attributes.position.count);
  // The flags hang in front of the wall behind them, inside the cell's height.
  for (let place = 0; place < BANNER_TEXT.length; place++) {
    const g = bannerShape(place);
    g.computeBoundingBox();
    assert.ok(g.boundingBox.max.z <= 0.5 && g.boundingBox.min.y >= 0 && g.boundingBox.max.y <= 1, 'against its wall');
  }
  assert.notEqual(bannerShape(0), bannerShape(1), 'each its own letters');
  assert.equal(bannerShape(0), bannerShape(BANNER_TEXT.length / 2), 'round again after the words');
});
