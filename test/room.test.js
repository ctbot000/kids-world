// The hosted island: joining and coming back, edits and their checks, the
// owner's rules, talking, animals, growing things, time, and saving.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as B from '../public/js/shared/blocks.js';
import { MAX_CRITTERS, NEEDS_WATER, unpackCritter } from '../public/js/shared/critters.js';
import { PROTOCOL, Room } from '../public/js/shared/room.js';
import { isValidName, PHRASES } from '../public/js/shared/words.js';

function clock(start = 1_000_000) {
  const c = { t: start };
  c.now = () => c.t;
  c.advance = (ms) => (c.t += ms);
  return c;
}

// A fake connection that records what it is sent.
function conn() {
  const c = { inbox: [], closed: false };
  c.send = (text) => c.inbox.push(JSON.parse(text));
  c.close = () => (c.closed = true);
  c.last = (t) => [...c.inbox].reverse().find((m) => m.t === t);
  c.all = (t) => c.inbox.filter((m) => m.t === t);
  return c;
}

function makeRoom(opts = {}) {
  const time = clock();
  let seed = 1;
  const random = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  const room = new Room({ code: '123456', theme: 'sunny', name: 'Sunny Cove', seed: 42, now: time.now, random, ...opts });
  return { room, time };
}

function join(room, extra = {}) {
  const c = conn();
  room.attach(c);
  room.receive(c, { t: 'join', protocol: PROTOCOL, name: 'Happy Panda', look: { animal: 'cat', fur: 'orange', shirt: 3, hat: 'cap' }, ...extra });
  return c;
}

test('joining sends the whole island, and everyone hears about newcomers', () => {
  const { room } = makeRoom();
  const a = join(room);
  const w = a.last('welcome');
  assert.ok(w, 'welcome arrives');
  assert.equal(w.you, 1);
  assert.equal(w.host, 1, 'the first player owns the island');
  assert.equal(w.meta.name, 'Sunny Cove');
  assert.ok(w.blocks.length > 1000);
  assert.ok(w.critters.length > 0 && w.pack.length === w.critters.length);
  const b = join(room, { name: 'Happy Panda' });
  assert.equal(b.last('welcome').you, 2);
  assert.equal(a.last('joined').player.name, 'Happy Panda 2', 'same names get a number');
  assert.equal(b.last('welcome').players.length, 2);
});

test('names that are not made from the word lists are replaced', () => {
  const { room } = makeRoom();
  const c = join(room, { name: 'Some Rude Words' });
  const name = c.last('welcome').players[0].name;
  assert.notEqual(name, 'Some Rude Words');
  assert.ok(isValidName(name), name);
  const d = join(room, { name: 'Happy Panda<script>' });
  assert.ok(isValidName(d.last('welcome').players.find((p) => p.id === 2).name));
});

test('a different protocol is turned away', () => {
  const { room } = makeRoom();
  const c = conn();
  room.attach(c);
  room.receive(c, { t: 'join', protocol: PROTOCOL + 1, name: 'Happy Panda' });
  assert.equal(c.last('error').code, 'protocol');
});

test('coming back with a token keeps who you are, and ownership', () => {
  const { room } = makeRoom();
  const a = join(room);
  const token = a.last('welcome').token;
  const b = join(room, { name: 'Brave Otter' });
  room.detach(a);
  assert.equal(b.last('left').pid, 1);
  assert.equal(b.last('host').pid, 2, 'ownership passes to someone still here');
  const again = join(room, { token });
  assert.equal(again.last('welcome').you, 1);
});

test('edits are checked, applied, echoed to everyone and acknowledged', () => {
  const { room } = makeRoom();
  const a = join(room);
  const b = join(room, { name: 'Brave Otter' });
  const w = room.world;
  const x = Math.floor(w.spawn.x) + 3;
  const z = Math.floor(w.spawn.z);
  const y = w.top(x, z) + 1;
  room.receive(a, { t: 'edit', seq: 7, kind: 'build', cells: [x, y, z, B.TOY_BRICKS[0]] });
  assert.equal(w.get(x, y, z), B.TOY_BRICKS[0]);
  assert.deepEqual(b.last('edit').cells, [x, y, z, B.TOY_BRICKS[0]]);
  assert.equal(a.last('edit').seq, 7, 'the builder gets its own edit back');
  assert.deepEqual(a.last('ack'), { t: 'ack', seq: 7, fix: [] });
  // Nonsense is refused whole.
  room.receive(a, { t: 'edit', seq: 8, kind: 'build', cells: [x, 0, z, B.STONE] });
  assert.deepEqual(a.last('ack'), { t: 'ack', seq: 8, fix: [] });
  room.receive(a, { t: 'edit', seq: 9, kind: 'build', cells: [x, y, z, 999] });
  assert.equal(w.get(x, y, z), B.TOY_BRICKS[0]);
});

test('a block cannot be built inside another player', () => {
  const { room } = makeRoom();
  const a = join(room);
  const b = join(room, { name: 'Brave Otter' });
  const w = room.world;
  const x = Math.floor(w.spawn.x) + 1;
  const z = Math.floor(w.spawn.z);
  const y = w.top(x, z) + 1;
  assert.equal(w.get(x, y, z), B.AIR);
  room.receive(b, { t: 'm', s: [x + 0.5, y, z + 0.5, 0, 0, 0] });
  room.receive(a, { t: 'edit', seq: 1, kind: 'build', cells: [x, y, z, B.STONE] });
  assert.equal(w.get(x, y, z), B.AIR);
  assert.deepEqual(a.last('ack').fix, [x, y, z, B.AIR]);
});

test('undo only changes blocks nobody has changed since', () => {
  const { room } = makeRoom();
  const a = join(room);
  const w = room.world;
  const x = Math.floor(w.spawn.x);
  const z = Math.floor(w.spawn.z) + 3;
  const y = w.top(x, z) + 1;
  room.receive(a, { t: 'edit', seq: 1, kind: 'build', cells: [x, y, z, B.PLANKS] });
  room.receive(a, { t: 'edit', seq: 2, kind: 'undo', cells: [x, y, z, B.AIR], expect: [B.STONE] });
  assert.equal(w.get(x, y, z), B.PLANKS, 'expectation not met: left alone');
  assert.deepEqual(a.last('ack').fix, [x, y, z, B.PLANKS]);
  room.receive(a, { t: 'edit', seq: 3, kind: 'undo', cells: [x, y, z, B.AIR], expect: [B.PLANKS] });
  assert.equal(w.get(x, y, z), B.AIR);
});

test('the owner can make building owner-only, lock the island and send someone home', () => {
  const { room } = makeRoom();
  const a = join(room);
  const b = join(room, { name: 'Brave Otter' });
  const btoken = b.last('welcome').token;
  room.receive(b, { t: 'host', cmd: 'settings', settings: { locked: true } });
  assert.equal(room.settings.locked, false, 'only the owner decides');
  assert.ok(b.last('notice'));
  room.receive(a, { t: 'host', cmd: 'settings', settings: { build: 'host', locked: true, day: 'night' } });
  assert.deepEqual(room.settings, { build: 'host', locked: true, day: 'night' });
  assert.deepEqual(b.last('settings').settings, room.settings);
  const w = room.world;
  const x = Math.floor(w.spawn.x) - 1;
  const z = Math.floor(w.spawn.z);
  const y = w.top(x, z) + 1;
  const before = w.get(x, y, z);
  room.receive(b, { t: 'edit', seq: 1, kind: 'build', cells: [x, y, z, B.STONE] });
  assert.equal(w.get(x, y, z), before, 'friends cannot build now');
  // Locked: newcomers wait outside, but people coming back are fine.
  const c = join(room, { name: 'Clever Fox' });
  assert.equal(c.last('error').code, 'locked');
  room.receive(a, { t: 'host', cmd: 'kick', pid: 2 });
  assert.equal(b.last('error').code, 'kicked');
  assert.ok(b.closed);
  room.receive(a, { t: 'host', cmd: 'settings', settings: { locked: false } });
  const back = join(room, { token: btoken, name: 'Brave Otter' });
  assert.notEqual(back.last('welcome')?.you, 2, 'the old token is gone');
});

test('only phrases and stickers from the lists can be said', () => {
  const { room } = makeRoom();
  const a = join(room);
  const b = join(room, { name: 'Brave Otter' });
  room.receive(a, { t: 'say', p: 0 });
  assert.equal(b.last('say').p, 0);
  assert.equal(PHRASES[b.last('say').p], 'Hi!');
  const before = b.all('say').length;
  room.receive(a, { t: 'say', p: 999 });
  room.receive(a, { t: 'say', text: 'anything at all' });
  room.receive(a, { t: 'say', e: -1 });
  assert.equal(b.all('say').length, before);
  room.receive(a, { t: 'say', e: 3 });
  assert.equal(b.last('say').e, 3);
  room.receive(a, { t: 'emote', e: 'dance' });
  assert.equal(b.last('emote').e, 'dance');
  room.receive(a, { t: 'emote', e: 'something-else' });
  assert.equal(b.all('emote').length, 1);
});

test('animals can be petted, fed, invited and said goodbye to', () => {
  const { room, time } = makeRoom();
  const a = join(room);
  const first = room.critters.list[0];
  room.receive(a, { t: 'critter', op: 'pet', id: first.id });
  assert.equal(a.last('cfx').fx, 'pet');
  room.receive(a, { t: 'critter', op: 'feed', id: first.id, fruit: 'apple' });
  assert.equal(a.last('cfx').fx, 'yum');
  assert.equal(first.follow, 1);
  room.receive(a, { t: 'critter', op: 'feed', id: first.id, fruit: 'brick' });
  assert.equal(a.all('cfx').length, 2, 'only real fruit');
  const n = room.critters.list.length;
  const s = room.world.spawn;
  room.receive(a, { t: 'critter', op: 'invite', type: 'duck', x: s.x, y: s.y, z: s.z });
  assert.equal(room.critters.list.length, n + 1);
  assert.equal(a.last('cadd').critter.type, 'duck');
  room.receive(a, { t: 'critter', op: 'bye', id: a.last('cadd').critter.id });
  assert.equal(room.critters.list.length, n);
  for (let i = 0; i < MAX_CRITTERS + 5; i++) {
    time.advance(50);
    room.receive(a, { t: 'critter', op: 'invite', type: 'bunny', x: s.x, y: s.y, z: s.z });
  }
  assert.equal(room.critters.list.length, MAX_CRITTERS);
  // Animals wander about as time passes, and everyone is told where they are.
  const before = room.critters.list.map((c) => `${c.x},${c.z}`).join('|');
  for (let i = 0; i < 100; i++) {
    time.advance(100);
    room.tick();
  }
  assert.notEqual(room.critters.list.map((c) => `${c.x},${c.z}`).join('|'), before);
  assert.ok(a.last('c').c.length === MAX_CRITTERS);
});

test('flying friends can be invited, and come in over the water rather than under it', () => {
  const { room } = makeRoom();
  const a = join(room);
  const w = room.world;
  const s = w.spawn;
  for (const type of ['bird', 'owl', 'bee', 'seagull', 'butterfly']) {
    room.receive(a, { t: 'critter', op: 'invite', type, x: s.x, y: s.y, z: s.z });
    const c = room.critters.get(a.last('cadd').critter.id);
    assert.equal(c.type, type);
    assert.equal(c.y, s.y, `a ${type} lands where it was asked to`);
    assert.equal(unpackCritter(a.last('cadd').s).type, type, 'and goes over the wire as itself');
  }
  // Out at sea, with the floor far below the water.
  let sea = null;
  for (let x = 1; x < w.W && !sea; x++) if (w.get(x, w.sea, 1) === B.WATER && w.top(x, 1) < w.sea - 1) sea = { x: x + 0.5, z: 1.5 };
  room.receive(a, { t: 'critter', op: 'invite', type: 'bird', x: sea.x, y: w.top(Math.floor(sea.x), 1) + 1, z: sea.z });
  const bird = room.critters.get(a.last('cadd').critter.id);
  assert.equal(bird.y, w.sea + 1, 'on top of the water');
});

test('sea creatures are invited at the water, and a whale only where the sea is deep', () => {
  const { room } = makeRoom();
  const a = join(room);
  const w = room.world;
  const s = w.spawn;
  // Out at sea, far from the beach.
  let sea = null;
  for (let x = 2; x < w.W && !sea; x++) if (w.get(x, w.sea, 2) === B.WATER && w.top(x, 2) < w.sea - 5) sea = { x: x + 0.5, z: 2.5 };
  for (const type of ['fish', 'dolphin', 'whale', 'octopus']) {
    room.receive(a, { t: 'critter', op: 'invite', type, x: sea.x, y: w.sea + 1, z: sea.z });
    const c = room.critters.get(a.last('cadd').critter.id);
    assert.equal(c.type, type);
    assert.equal(w.get(Math.floor(c.x), Math.floor(c.y), Math.floor(c.z)), B.WATER, `a ${type} comes in in the water`);
  }
  // Crabs and turtles walk the land too.
  room.receive(a, { t: 'critter', op: 'invite', type: 'crab', x: s.x, y: s.y, z: s.z });
  assert.equal(a.last('cadd').critter.type, 'crab');
  // On land far from the sea, there is no water for a whale.
  const added = a.all('cadd').length;
  room.receive(a, { t: 'critter', op: 'invite', type: 'whale', x: s.x, y: s.y, z: s.z });
  assert.equal(a.all('cadd').length, added, 'no whale on land');
  assert.equal(a.last('notice').text, NEEDS_WATER.whale);
});

test('an island from before the flying friends or the sea creatures gets them, once', () => {
  const { room, time } = makeRoom();
  const save = JSON.parse(JSON.stringify(room.exportSave()));
  assert.equal(save.v, 4);
  const FLYERS = ['bird', 'owl', 'bee', 'seagull'];
  const SEA = ['fish', 'dolphin', 'whale', 'turtle', 'crab', 'octopus'];
  const count = (r, types) => r.critters.list.filter((c) => types.includes(c.type)).length;
  const without = (types) => save.critters.filter((c) => !types.includes(c.type));
  const load = (s) => new Room({ code: '123456', save: JSON.parse(JSON.stringify(s)), now: time.now });
  // Saved before either came: both move in.
  const v1 = load({ ...save, v: 1, critters: without([...FLYERS, ...SEA]) });
  assert.equal(count(v1, FLYERS), 9, 'three birds, an owl, three bees and two seagulls');
  assert.equal(count(v1, SEA), 13, 'four schools of fish, two dolphins, a whale, two turtles, three crabs and an octopus');
  // Saved after the flying friends came: just the sea creatures.
  const v2 = load({ ...save, v: 2, critters: without(SEA) });
  assert.equal(count(v2, FLYERS), count(room, FLYERS));
  assert.equal(count(v2, SEA), 13);
  // Only the once.
  const again = load(v1.exportSave());
  assert.equal(count(again, FLYERS), 9);
  assert.equal(count(again, SEA), 13);
  // An island whose animals were all sent home stays that way.
  assert.equal(count(load({ ...save, critters: without([...FLYERS, ...SEA]) }), [...FLYERS, ...SEA]), 0);
});

test('a snowy island from before the penguins and seals gets them, once, and other islands none', () => {
  const POLAR = ['penguin', 'seal'];
  const count = (r) => r.critters.list.filter((c) => POLAR.includes(c.type)).length;
  for (const theme of ['snowy', 'sunny']) {
    const { room, time } = makeRoom({ theme });
    const save = JSON.parse(JSON.stringify(room.exportSave()));
    const load = (s) => new Room({ code: '123456', save: JSON.parse(JSON.stringify(s)), now: time.now });
    const old = load({ ...save, v: 3, critters: save.critters.filter((c) => !POLAR.includes(c.type)) });
    assert.equal(count(old), theme === 'snowy' ? 8 : 0, `${theme}: five penguins and three seals move in, on snowy islands`);
    assert.equal(count(load(old.exportSave())), count(old), `${theme}: only the once`);
  }
});

test('sprouts grow into trees and picked fruit grows back', () => {
  const { room, time } = makeRoom();
  const a = join(room);
  const w = room.world;
  const s = w.spawn;
  const x = Math.floor(s.x) + 2;
  const z = Math.floor(s.z) + 2;
  const y = w.top(x, z) + 1;
  room.receive(a, { t: 'edit', seq: 1, kind: 'build', cells: [x, y, z, B.FRUIT_SPROUTS[0]] });
  for (let i = 0; i < 100; i++) {
    time.advance(1000);
    room.tick();
  }
  assert.equal(w.get(x, y, z), B.WOOD, 'a tree grew');
  const grow = a.all('edit').find((m) => m.kind === 'grow');
  assert.ok(grow && grow.by === 0);
  // Pick one of its apples; it comes back after a while.
  let apple = null;
  for (let i = 0; i < grow.cells.length && !apple; i += 4) if (grow.cells[i + 3] === B.FRUIT_ITEMS[0]) apple = grow.cells.slice(i, i + 3);
  assert.ok(apple, 'the tree has apples');
  room.receive(a, { t: 'edit', seq: 2, kind: 'pick', cells: [...apple, B.AIR] });
  assert.equal(w.get(...apple), B.AIR);
  for (let i = 0; i < 220; i++) {
    time.advance(1000);
    room.tick();
  }
  assert.equal(w.get(...apple), B.FRUIT_ITEMS[0], 'the apple grew back');
});

test('the clock and the weather move on, and the owner can stop the clock', () => {
  const { room, time } = makeRoom();
  const a = join(room);
  const start = room.env.time;
  for (let i = 0; i < 50; i++) {
    time.advance(1000);
    room.tick();
  }
  assert.ok(room.env.time > start);
  assert.ok(a.last('env'));
  const seen = new Set();
  for (let i = 0; i < 4000; i++) {
    time.advance(1000);
    room.tick();
    seen.add(room.env.weather);
  }
  assert.ok(seen.has('rain') && seen.has('rainbow') && seen.has('clear'), [...seen].join());
  room.receive(a, { t: 'host', cmd: 'settings', settings: { day: 'day' } });
  time.advance(60000);
  room.tick();
  assert.equal(room.env.time, 0.42);
});

test('an island saves and loads with its blocks, animals, friends and owner', () => {
  const { room, time } = makeRoom();
  const a = join(room);
  const token = a.last('welcome').token;
  const w = room.world;
  const lx = Math.floor(w.spawn.x) - 3;
  const lz = Math.floor(w.spawn.z);
  const y = w.top(lx, lz) + 1;
  room.receive(a, { t: 'edit', seq: 1, kind: 'build', cells: [lx, y, lz, B.LAMP] });
  const save = JSON.parse(JSON.stringify(room.exportSave()));
  const copy = new Room({ code: '123456', save, now: time.now });
  assert.deepEqual(copy.world.blocks, room.world.blocks);
  assert.equal(copy.world.get(lx, y, lz), B.LAMP);
  assert.equal(copy.critters.list.length, room.critters.list.length);
  const back = join(copy, { token });
  assert.equal(back.last('welcome').you, 1);
  assert.equal(back.last('welcome').host, 1);
  // Someone else arriving first does not take the owner's place.
  const other = new Room({ code: '123456', save, now: time.now });
  const early = join(other, { name: 'Brave Otter' });
  assert.equal(early.last('welcome').host, 1, 'ownership is kept for the owner');
  assert.throws(() => new Room({ save: { app: 'something-else' } }));
});

test('a flood of messages is rate limited', () => {
  const { room } = makeRoom();
  const a = join(room);
  const b = join(room, { name: 'Brave Otter' });
  for (let i = 0; i < 1000; i++) room.receive(a, { t: 'emote', e: 'wave' });
  assert.ok(b.all('emote').length < 400, `${b.all('emote').length} emotes got through`);
});
