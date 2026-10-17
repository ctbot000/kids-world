// Pianos: the upright and the grand, furniture that turns, in the Home tab
// after the gashapon machine; their keys, two octaves from middle C, each
// with a letter on a keyboard; found beside you; the songs to follow; a key
// played passed on by the island to everyone else, from someone at the
// piano only; and the Piano Star sticker.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as B from '../public/js/shared/blocks.js';
import { modelBoxes } from '../public/js/shared/furniture.js';
import { HIGH, isNote, isPiano, KEYS, LOW, noteOfKey, pianoNear, SONGS } from '../public/js/shared/piano.js';
import { PROTOCOL, Room } from '../public/js/shared/room.js';
import { XP_FOR } from '../public/js/shared/levels.js';
import { STAT_KEYS, STICKERS } from '../public/js/shared/stickers.js';
import { World } from '../public/js/shared/world.js';

test('the upright and the grand piano are furniture that turns, in the Home tab after the gashapon machine, keys at the front', () => {
  const home = B.blocksIn('home');
  assert.deepEqual(home.slice(home.indexOf(B.GASHAPON) + 1, home.indexOf(B.GASHAPON) + 3), [B.PIANO, B.GRAND_PIANO]);
  for (const id of [B.PIANO, B.GRAND_PIANO]) {
    const d = B.BLOCKS[id];
    assert.equal(d.kind, 'furniture');
    assert.equal(d.category, 'home');
    assert.ok(d.solid);
    for (let k = 0; k < 4; k++) assert.ok(isPiano(id + k), `${d.key} facing ${k}`);
    const boxes = modelBoxes(id);
    for (const [x0, y0, z0, x1, y1, z1] of boxes) {
      assert.ok(x0 >= 0 && z0 >= 0 && x1 <= 1 && z1 <= 1 && y0 >= 0 && y1 <= 1.1, `${d.key}: inside its cell`);
      assert.ok(x1 > x0 && y1 > y0 && z1 > z0);
    }
    // Fifteen white keys and ten black ones, at the front (towards -z).
    const white = boxes.filter((b) => b[6] === '#f7f5ef' && b[4] - b[1] < 0.04);
    const black = boxes.filter((b) => b[6] === '#2c2f36' && b[4] - b[1] < 0.03);
    assert.equal(white.length, 15, d.key);
    assert.equal(black.length, 10, d.key);
    assert.ok(Math.max(...white.map((b) => b[5])) < 0.55, 'the keys stick out at the front');
  }
  for (const id of [B.GASHAPON, B.ARCADE_BLOB, B.CHAIR, B.AIR]) assert.ok(!isPiano(id));
});

test('two octaves of keys from middle C, white and black, each with its own letter', () => {
  assert.equal(KEYS.length, HIGH - LOW + 1);
  assert.deepEqual(KEYS.map((k) => k.n), Array.from({ length: 25 }, (_, i) => LOW + i));
  assert.equal(KEYS.filter((k) => !k.black).length, 15);
  assert.equal(KEYS.filter((k) => k.black).length, 10);
  assert.equal(new Set(KEYS.map((k) => k.key)).size, KEYS.length, 'a letter each');
  for (const k of KEYS) assert.equal(noteOfKey(k.key), k.n);
  assert.equal(noteOfKey('z'), 60, 'middle C');
  assert.equal(noteOfKey('Q'), 72, 'the high C, with Shift too');
  assert.equal(noteOfKey('i'), 84);
  assert.equal(noteOfKey('a'), null);
  for (const n of [59, 85, 60.5, '60', null]) assert.ok(!isNote(n), String(n));
});

test('the songs to follow are all on the keys', () => {
  assert.ok(SONGS.length >= 4);
  assert.equal(new Set(SONGS.map((s) => s.key)).size, SONGS.length);
  for (const s of SONGS) {
    assert.ok(s.notes.length >= 20, s.key);
    for (const n of s.notes) assert.ok(isNote(n), `${s.key}: ${n}`);
  }
  // Twinkle, Twinkle: C C G G A A G.
  assert.deepEqual(SONGS.find((s) => s.key === 'twinkle').notes.slice(0, 7), [60, 60, 67, 67, 69, 69, 67]);
});

test('the piano beside you is found, and none further away', () => {
  const w = new World({ W: 16, H: 16, D: 16, sea: 1 });
  w.set(8, 5, 8, B.turnedTo(B.GRAND_PIANO, 1));
  const near = pianoNear(w, { x: 8.5, y: 5, z: 6.8 });
  assert.deepEqual({ x: near.x, y: near.y, z: near.z, grand: near.grand }, { x: 8, y: 5, z: 8, grand: true });
  assert.equal(pianoNear(w, { x: 8.5, y: 5, z: 4.5 }), null, 'too far');
  assert.equal(pianoNear(w, { x: 8.5, y: 9, z: 7 }), null, 'up above it');
  w.set(8, 5, 8, B.PIANO);
  assert.equal(pianoNear(w, { x: 8.5, y: 5, z: 6.8 }).grand, false);
});

test('a key played at a piano is passed to everyone else, and nothing else is', () => {
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
  room.world.set(x, y, z, B.PIANO);
  p.s = [x - 0.5, y, z + 0.5];
  room.receive(a, { t: 'piano', n: 64, at: [x, y, z] });
  assert.deepEqual(b.all('piano'), [{ t: 'piano', pid, n: 64, at: [x, y, z] }]);
  assert.equal(a.all('piano').length, 0, 'not back to the one playing');
  for (const bad of [{ n: 40 }, { n: 'C' }, { n: 64.5 }, { at: [x, y + 1, z] }, { at: [x, y] }, { at: 'here' }]) room.receive(a, { t: 'piano', n: 64, at: [x, y, z], ...bad });
  p.s = [x + 8, y, z];
  room.receive(a, { t: 'piano', n: 64, at: [x, y, z] });
  assert.equal(b.all('piano').length, 1, 'no key that is not one, at no piano, from too far away');
});

test('notes and songs are counted, with the Piano Star sticker for a whole song', () => {
  for (const key of ['notes', 'tunes']) {
    assert.ok(STAT_KEYS.includes(key));
    assert.ok(XP_FOR[key], key);
  }
  const star = STICKERS.find((s) => s.key === 'piano-star');
  assert.ok(star.test({ tunes: 1 }) && !star.test({ tunes: 0 }));
  assert.ok(STICKERS.length <= 64 && STAT_KEYS.length <= 64, 'within what the keeper keeps');
});
