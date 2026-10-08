// The island's song: an MP3 the owner picks, passed on in pieces to everyone
// on the island and to whoever comes later, never kept in a save.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { PROTOCOL, Room } from '../public/js/shared/room.js';
import { cleanPiece, SONG_MAX_BYTES, SONG_MAX_PIECES, SONG_PIECE, songName, SongPieces, songPieces } from '../public/js/shared/song.js';

function conn() {
  const c = { inbox: [] };
  c.send = (text) => c.inbox.push(JSON.parse(text));
  c.close = () => {};
  c.all = (t) => c.inbox.filter((m) => m.t === t);
  return c;
}

function join(room, name) {
  const c = conn();
  room.attach(c);
  room.receive(c, { t: 'join', protocol: PROTOCOL, name, look: { animal: 'cat', fur: 'orange', shirt: 3, hat: 'cap' } });
  return c;
}

const makeRoom = () => new Room({ code: '123456', theme: 'sunny', name: 'Sunny Cove', seed: 42 });

// A song of `bytes` made-up bytes, as base64 in pieces.
function fakeSong(bytes) {
  return songPieces(Buffer.alloc(bytes, 7).toString('base64'));
}

function sendSong(room, c, song, name = 'Happy Song.mp3') {
  song.pieces.forEach((data, i) => room.receive(c, { t: 'host', cmd: 'song', id: song.id, name, i, n: song.n, data }));
}

const whole = (pieces) =>
  pieces
    .slice()
    .sort((a, b) => a.i - b.i)
    .map((p) => p.data)
    .join('');

test('a song is named after its file, tidied', () => {
  assert.equal(songName('Happy_Song.mp3'), 'Happy Song');
  assert.equal(songName('  꼬마 노래.MP3 '), '꼬마 노래');
  assert.equal(songName('\u202eevil\u0007.mp3'), 'evil');
  assert.equal(songName(''), 'A song');
  assert.equal(songName(null), 'A song');
  assert.equal([...songName('🎵'.repeat(100))].length, 60);
});

test('a song goes in pieces that each fit a message, and comes back whole in any order', () => {
  const bytes = Buffer.from(Array.from({ length: 700_000 }, (_, i) => (i * 31) & 0xff));
  const base64 = bytes.toString('base64');
  const song = songPieces(base64);
  assert.equal(song.n, Math.ceil(base64.length / SONG_PIECE));
  assert.ok(song.pieces.every((p) => p.length <= SONG_PIECE));
  const got = new SongPieces();
  const order = [...song.pieces.keys()].reverse();
  let out = null;
  for (const i of order) out = got.add(cleanPiece({ id: song.id, name: 'x', i, n: song.n, data: song.pieces[i] })) ?? out;
  assert.deepEqual(Buffer.from(out, 'base64'), bytes);
  // The biggest song there may be fits the most pieces there may be.
  assert.ok(fakeSong(SONG_MAX_BYTES).n <= SONG_MAX_PIECES);
});

test('a piece that is not one is turned away', () => {
  const ok = { id: 'abc', name: 'x', i: 0, n: 1, data: 'AAAA' };
  assert.ok(cleanPiece(ok));
  for (const bad of [
    { ...ok, id: 'ABC!' },
    { ...ok, id: '' },
    { ...ok, n: 0 },
    { ...ok, n: SONG_MAX_PIECES + 1 },
    { ...ok, i: 1 },
    { ...ok, i: -1 },
    { ...ok, data: '' },
    { ...ok, data: 'not base64!' },
    { ...ok, data: 'A'.repeat(SONG_PIECE + 4) },
    // Only the last piece is short.
    { ...ok, n: 2, data: 'AAAA' },
    null,
  ]) {
    assert.equal(cleanPiece(bad), null, JSON.stringify(bad)?.slice(0, 80));
  }
});

test("the owner's song reaches everyone here, and everyone who comes later", () => {
  const room = makeRoom();
  const owner = join(room, 'Owner');
  const friend = join(room, 'Friend');
  const song = fakeSong(600_000);
  sendSong(room, owner, song);
  assert.equal(owner.all('song').length, 0, 'the owner already has it');
  const heard = friend.all('song');
  assert.equal(heard.length, song.n);
  assert.ok(heard.every((m) => m.id === song.id && m.name === 'Happy Song'));
  assert.equal(whole(heard), song.pieces.join(''));

  const late = join(room, 'Late');
  const welcome = late.all('welcome')[0];
  assert.deepEqual(welcome.song, { id: song.id, name: 'Happy Song' });
  assert.ok(late.inbox.indexOf(welcome) < late.inbox.findIndex((m) => m.t === 'song'), 'the pieces come after the welcome');
  assert.equal(whole(late.all('song')), song.pieces.join(''));
  // A piece sent twice is passed on once.
  room.receive(owner, { t: 'host', cmd: 'song', id: song.id, name: 'x', i: 0, n: song.n, data: song.pieces[0] });
  assert.equal(friend.all('song').length, song.n);
});

test('only the owner picks the song, and can go back to the island music', () => {
  const room = makeRoom();
  const owner = join(room, 'Owner');
  const friend = join(room, 'Friend');
  sendSong(room, friend, fakeSong(1000));
  assert.equal(owner.all('song').length, 0);
  assert.equal(room.song, null);
  assert.ok(friend.all('notice').length > 0);

  sendSong(room, owner, fakeSong(1000));
  assert.ok(room.song);
  room.receive(friend, { t: 'host', cmd: 'song', off: true });
  assert.ok(room.song, 'a friend cannot stop it');
  room.receive(owner, { t: 'host', cmd: 'song', off: true });
  assert.equal(room.song, null);
  assert.deepEqual(friend.all('song').at(-1), { t: 'song', off: true });
  assert.equal(join(room, 'Late').all('welcome')[0].song, null);
});

test('a new song takes the place of the old one', () => {
  const room = makeRoom();
  const owner = join(room, 'Owner');
  sendSong(room, owner, fakeSong(400_000), 'One.mp3');
  const two = fakeSong(1000);
  sendSong(room, owner, two, 'Two.mp3');
  const late = join(room, 'Late');
  assert.deepEqual(
    late.all('song').map((m) => m.id),
    [two.id],
  );
  assert.equal(late.all('song')[0].name, 'Two');
});

test('a song only half sent when the owner changes goes, and a whole one stays', () => {
  const room = makeRoom();
  const owner = join(room, 'Owner');
  const friend = join(room, 'Friend');
  const song = fakeSong(600_000);
  room.receive(owner, { t: 'host', cmd: 'song', id: song.id, name: 'x', i: 0, n: song.n, data: song.pieces[0] });
  room.receive(owner, { t: 'host', cmd: 'handover', pid: 2 });
  assert.equal(room.song, null);
  assert.deepEqual(friend.all('song').at(-1), { t: 'song', off: true });

  sendSong(room, friend, song);
  room.receive(friend, { t: 'host', cmd: 'handover', pid: 1 });
  assert.equal(room.song?.id, song.id);
});

test('the song is never in a save', () => {
  const room = makeRoom();
  const owner = join(room, 'Owner');
  sendSong(room, owner, fakeSong(1000));
  const save = room.exportSave();
  assert.ok(!JSON.stringify(save).includes('song'));
  const again = new Room({ save });
  assert.equal(again.song, null);
});
