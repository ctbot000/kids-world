// The hosted island: joining and coming back, edits and their checks, the
// owner's rules, talking, animals, growing things, time, and saving.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as B from '../public/js/shared/blocks.js';
import { BIG, CRITTER_INFO, MAX_CRITTERS, NEEDS_WATER, needsRoom, riderAt, unpackCritter } from '../public/js/shared/critters.js';
import { PROTOCOL, Room } from '../public/js/shared/room.js';
import { isMadeUpName, PHRASES } from '../public/js/shared/words.js';

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

test('a name is taken as typed, tidied, but an empty, invisible or endless one is replaced', () => {
  // Each on an island of its own: an island holds only so many players.
  const named = (name) => {
    const c = join(makeRoom().room, { name });
    return c.last('welcome').players.find((p) => p.id === c.last('welcome').you).name;
  };
  assert.equal(named('Some Rude Words'), 'Some Rude Words');
  assert.equal(named('  민지   Kim '), '민지 Kim');
  assert.equal(named('Agent 7'), 'Agent 7', 'a number of its own stays');
  assert.equal(named('<b>Bold</b>'), '<b>Bold</b>', 'shown as text, never as markup');
  for (const name of ['', '   ', 'in\u200bvisible', 'x'.repeat(33), 42]) assert.ok(isMadeUpName(named(name)), JSON.stringify(name));
});

test("an island's name is taken as typed, tidied, but one with nothing to see or too long is rolled", () => {
  const [zwj, zwsp, rlo] = [0x200d, 0x200b, 0x202e].map((c) => String.fromCharCode(c));
  const family = String.fromCodePoint(0x1f468, 0x200d, 0x1f469, 0x200d, 0x1f467);
  const named = (name) => makeRoom({ name }).room.world.name;
  assert.equal(named('민지네 섬'), '민지네 섬');
  assert.equal(named('  The   Best\nIsland 🏝️ '), 'The Best Island 🏝️');
  assert.equal(named(`Our ${family} home`), `Our ${family} home`, 'emoji keep their joiners');
  assert.equal(named(`in${zwsp}visible ${rlo}island`), 'invisible island', 'nothing invisible is kept');
  assert.equal(named('<b>Bold</b>'), '<b>Bold</b>', 'shown as text, never as markup');
  assert.equal(named('x'.repeat(32)), 'x'.repeat(32));
  for (const name of ['', '   ', zwsp, zwj + zwj, 'x'.repeat(33), 42]) assert.match(named(name), /^[A-Z][a-z]+ [A-Z][a-z]+$/, JSON.stringify(name));
  const save = makeRoom({ name: '민지네 섬' }).room.exportSave();
  const opened = (name) => new Room({ save: { ...save, meta: { ...save.meta, name } } }).world.name;
  assert.equal(opened('민지네 섬'), '민지네 섬', 'a saved island keeps it');
  assert.equal(opened(`Old${zwsp} Cove`), 'Old Cove', 'and an opened one is tidied');
  assert.equal(opened(zwsp), 'My Island');
});

test('a new display name comes with a look while on the island, and stays told apart', () => {
  const { room } = makeRoom();
  const a = join(room, { name: 'Minji' });
  const b = join(room, { name: 'Brave Fox' });
  const renamed = (c) => c.last('look').name;
  b.inbox.length = 0;
  room.receive(b, { t: 'look', look: { animal: 'fox', fur: 'orange', shirt: 3, hat: 'cap' }, name: '  Minji ' });
  assert.equal(renamed(a), 'Minji 2', 'a second Minji on the island gets a number');
  assert.equal(renamed(b), 'Minji 2');
  room.receive(b, { t: 'look', look: { animal: 'fox' }, name: 'in\u200bvisible' });
  assert.equal(renamed(a), 'Minji 2', 'an invisible one is not taken');
  room.receive(b, { t: 'look', look: { animal: 'cat' } });
  assert.equal(renamed(a), 'Minji 2', 'a look alone keeps the name');
  room.receive(b, { t: 'look', look: { animal: 'cat' }, name: 'Captain' });
  assert.equal(renamed(a), 'Captain');
  assert.equal(room.exportSave().players.find((p) => p.id === 2).name, 'Captain', 'and the island keeps it');
});

test("a kid's skin and hair come along, tidied, and an animal has none", () => {
  const { room } = makeRoom();
  const a = join(room);
  const kid = { animal: 'kid', fur: 'tan', shirt: 3, hat: 'cap', skin: 'deep', hair: 'bun', hairColor: 'pink' };
  const b = join(room, { name: 'Minji', look: kid });
  assert.deepEqual(a.last('joined').player.look, kid);
  // Anything unknown is as a kid starts out.
  room.receive(b, { t: 'look', look: { ...kid, skin: 'green', hair: 'mohawk', hairColor: '#ff0000' } });
  assert.deepEqual(a.last('look').look, { ...kid, skin: 'golden', hair: 'short', hairColor: 'brown' });
  // An animal has fur instead.
  room.receive(b, { t: 'look', look: { ...kid, animal: 'cat', fur: 'orange' } });
  assert.deepEqual(a.last('look').look, { animal: 'cat', fur: 'orange', shirt: 3, hat: 'cap' });
  // A grown-up keeps them, with glasses or a beard; a kid has neither.
  room.receive(b, { t: 'look', look: { ...kid, animal: 'grownup', face: 'beard' } });
  assert.deepEqual(a.last('look').look, { ...kid, animal: 'grownup', face: 'beard' });
  room.receive(b, { t: 'look', look: { ...kid, face: 'beard' } });
  assert.deepEqual(a.last('look').look, kid);
});

test("a pet comes along in its owner's look, and petting it or giving it a fruit is passed on to everyone", () => {
  const { room } = makeRoom();
  const look = { animal: 'cat', fur: 'orange', shirt: 3, hat: 'cap', pet: { kind: 'puppy', coat: 'brown', name: '  Biscuit ' } };
  const a = join(room, { name: 'Minji', look });
  const b = join(room, { name: 'Jun' });
  assert.deepEqual(b.last('welcome').players.find((p) => p.name === 'Minji').look.pet, { kind: 'puppy', coat: 'brown', name: 'Biscuit' }, 'tidied');
  // Jun pets Minji's puppy, then gives it an apple: everyone sees it, Minji too.
  room.receive(b, { t: 'pet', op: 'pet', pid: 1 });
  room.receive(b, { t: 'pet', op: 'feed', pid: 1, fruit: 'apple' });
  for (const c of [a, b]) assert.deepEqual(c.all('pfx'), [{ t: 'pfx', pid: 1, by: 2, fx: 'pet' }, { t: 'pfx', pid: 1, by: 2, fx: 'yum', fruit: 'apple' }]);
  // Nothing for a fruit there is not, a player without a pet, nor one who went home.
  room.receive(a, { t: 'pet', op: 'feed', pid: 1, fruit: 'brick' });
  room.receive(a, { t: 'pet', op: 'pet', pid: 2 });
  room.receive(a, { t: 'pet', op: 'pet', pid: 7 });
  room.receive(a, { t: 'pet', op: 'hug', pid: 1 });
  assert.equal(a.all('pfx').length, 2);
  // A new pet with a new look, and none at all.
  room.receive(a, { t: 'look', look: { ...look, pet: { kind: 'dragon', coat: 'pink', name: 'Ember' } } });
  assert.deepEqual(b.last('look').look.pet, { kind: 'dragon', coat: 'pink', name: 'Ember' });
  room.receive(a, { t: 'look', look: { ...look, pet: null } });
  assert.equal(b.last('look').look.pet, undefined);
  room.receive(b, { t: 'pet', op: 'pet', pid: 1 });
  assert.equal(a.all('pfx').length, 2, 'no pet to pet');
  b.close();
  room.detach(b);
  room.receive(a, { t: 'look', look });
  room.receive(a, { t: 'pet', op: 'pet', pid: 2 });
  assert.equal(a.all('pfx').length, 2);
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
  assert.deepEqual(room.settings, { build: 'host', locked: true, day: 'night', monsters: false });
  assert.deepEqual(b.last('settings').settings, { ...room.settings, passcode: false });
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

test('phrases, stickers and anything typed can be said: tidied, and never empty, endless or too fast', () => {
  const { room, time } = makeRoom();
  const a = join(room);
  const b = join(room, { name: 'Brave Otter' });
  room.receive(a, { t: 'say', p: 0 });
  assert.equal(b.last('say').p, 0);
  assert.equal(PHRASES[b.last('say').p], 'Hi!');
  // Typed: spaces and new lines made one space, and nothing invisible but an emoji's joiners.
  const scotland = '\u{1f3f4}\u{e0067}\u{e0062}\u{e0073}\u{e0063}\u{e0074}\u{e007f}';
  room.receive(a, { t: 'say', text: `  안녕,\n  friends! 👨\u200d👩\u200d👧\u202e ${scotland} ` });
  assert.equal(b.last('say').text, `안녕, friends! 👨\u200d👩\u200d👧 ${scotland}`);
  assert.equal(b.last('say').name, 'Happy Panda');
  const before = b.all('say').length;
  room.receive(a, { t: 'say', p: 999 });
  room.receive(a, { t: 'say', e: -1 });
  room.receive(a, { t: 'say', text: ' \u200b ' });
  room.receive(a, { t: 'say', text: 'x'.repeat(121) });
  assert.equal(b.all('say').length, before);
  room.receive(a, { t: 'say', e: 3 });
  assert.equal(b.last('say').e, 3);
  // A few at once, then about one a second.
  for (let i = 0; i < 4; i++) room.receive(a, { t: 'say', text: `again ${i}` });
  assert.equal(b.last('say').text, 'again 1');
  assert.equal(a.last('notice')?.text, 'Whoa, slow down a little!');
  time.advance(1000);
  room.receive(a, { t: 'say', text: 'later' });
  assert.equal(b.last('say').text, 'later');
  // Whoever comes later hears what was said.
  assert.ok(join(room, { name: 'Lucky Bunny' }).last('welcome').chat.some((m) => m.text === 'later'));
  room.receive(a, { t: 'emote', e: 'dance' });
  assert.equal(b.last('emote').e, 'dance');
  room.receive(a, { t: 'emote', e: 'something-else' });
  assert.equal(b.all('emote').length, 1);
  // A swing at a monster: friends see it start; the one swinging is not told.
  room.receive(a, { t: 'swing' });
  assert.deepEqual(b.last('swing'), { t: 'swing', pid: a.last('welcome').you });
  assert.equal(a.all('swing').length, 0);
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
  assert.equal(save.v, 9);
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

test('a big animal is ridden by one player at a time, goes where they go, and stays where they get off', () => {
  const { room, time } = makeRoom();
  const a = join(room);
  const b = join(room, { name: 'Brave Fox' });
  const pony = room.critters.list.find((c) => c.type === 'pony');
  const near = (conn, c) => room.receive(conn, { t: 'm', s: [c.x + 1, c.y, c.z, 0, 0, 0] });
  // Too far away to climb on.
  room.receive(a, { t: 'critter', op: 'ride', id: pony.id });
  assert.equal(pony.rider, 0);
  near(a, pony);
  room.receive(a, { t: 'critter', op: 'ride', id: pony.id });
  assert.equal(pony.rider, 1);
  assert.deepEqual(b.last('ride'), { t: 'ride', id: pony.id, pid: 1 });
  // Up on its back at once.
  const seat = riderAt('pony', pony);
  assert.deepEqual(room.players.get(1).s.slice(0, 3), [seat.x, seat.y, seat.z].map((v) => +v.toFixed(2)));
  // Nobody else gets on, nor sends it home.
  near(b, pony);
  room.receive(b, { t: 'critter', op: 'ride', id: pony.id });
  assert.equal(pony.rider, 1);
  assert.match(b.last('notice').text, /already riding/);
  room.receive(b, { t: 'critter', op: 'bye', id: pony.id });
  assert.ok(room.critters.get(pony.id), 'still here');
  assert.match(b.last('notice').text, /Wait until they get off/);
  // It goes where its rider says they are.
  room.receive(a, { t: 'm', s: [40.5, 30, 41.5, 1.5, 6, 0] });
  time.advance(100);
  room.tick();
  assert.ok(Math.abs(pony.x - 40.5) < 1e-6 && Math.abs(pony.z - 41.5) < 1e-6 && Math.abs(pony.y - (30 - CRITTER_INFO.pony.ride.seat + 0.25)) < 1e-6);
  assert.equal(pony.yaw, 1.5);
  const [row] = b.last('c').c.filter((r) => r[0] === pony.id);
  assert.equal(unpackCritter(row).x, 40.5, 'and everyone is told');
  // Only a whale or an elephant has a trick for the host to pass on.
  room.receive(a, { t: 'critter', op: 'trick' });
  assert.equal(b.all('cfx').length, 0);
  // Getting off: it stays right there, and anyone can get on.
  room.receive(a, { t: 'm', s: [42.5, 30, 41.5, 1.5, 6, 0] });
  room.receive(a, { t: 'critter', op: 'off' });
  assert.equal(pony.rider, 0);
  assert.equal(pony.x, 42.5, 'where its rider last was');
  assert.deepEqual(b.last('ride'), { t: 'ride', id: pony.id, pid: 0 });
  near(b, pony);
  room.receive(b, { t: 'critter', op: 'ride', id: pony.id });
  assert.equal(pony.rider, 2);
  // Going home gets you off too, and the welcome says who rides what.
  room.receive(b, { t: 'leave' });
  assert.equal(pony.rider, 0);
  assert.equal(a.last('ride').pid, 0);
  const elephant = room.critters.list.find((c) => c.type === 'elephant');
  near(a, elephant);
  room.receive(a, { t: 'critter', op: 'ride', id: elephant.id });
  room.receive(a, { t: 'critter', op: 'trick' });
  assert.equal(a.last('cfx').fx, 'spray');
  const c = join(room, { name: 'Calm Otter' });
  assert.equal(c.last('welcome').critters.find((d) => d.id === elephant.id).rider, 1);
  // Riding one gets you off another; small animals cannot be ridden.
  near(a, pony);
  room.receive(a, { t: 'critter', op: 'ride', id: pony.id });
  assert.equal(elephant.rider, 0);
  assert.equal(pony.rider, 1);
  const bunny = room.critters.list.find((x) => x.type === 'bunny');
  near(a, bunny);
  room.receive(a, { t: 'critter', op: 'ride', id: bunny.id });
  assert.equal(bunny.rider, 0);
});

test('a big animal is invited where there is room for it', () => {
  const { room } = makeRoom();
  const a = join(room);
  const s = room.world.spawn;
  room.receive(a, { t: 'critter', op: 'invite', type: 'elephant', x: s.x, y: s.y, z: s.z });
  const el = room.critters.get(a.last('cadd').critter.id);
  assert.equal(el.type, 'elephant');
  // In a big, low hut, two blocks high: not there.
  const w = room.world;
  const hx = 8;
  const hz = 8;
  const floor = 30;
  for (let x = hx - 6; x <= hx + 6; x++) {
    for (let z = hz - 6; z <= hz + 6; z++) {
      for (let y = floor - 1; y <= floor + 2; y++) w.set(x, y, z, Math.abs(x - hx) === 6 || Math.abs(z - hz) === 6 || y === floor - 1 || y === floor + 2 ? B.PLANKS : B.AIR);
    }
  }
  const n = a.all('cadd').length;
  room.receive(a, { t: 'critter', op: 'invite', type: 'giraffe', x: hx + 0.5, y: floor, z: hz + 0.5 });
  assert.equal(a.all('cadd').length, n);
  assert.equal(a.last('notice').text, needsRoom('giraffe'));
  assert.equal(needsRoom('elephant'), 'There is no room for an elephant here. Try somewhere more open!');
  assert.equal(needsRoom('unicorn'), 'There is no room for a unicorn here. Try somewhere more open!');
});

test('an island from before the big animals gets them, once', () => {
  for (const theme of ['sunny', 'snowy', 'candy', 'flat']) {
    const { room, time } = makeRoom({ theme });
    const save = JSON.parse(JSON.stringify(room.exportSave()));
    const count = (r) => r.critters.list.filter((c) => BIG.includes(c.type)).length;
    const load = (sv) => new Room({ code: '123456', save: JSON.parse(JSON.stringify(sv)), now: time.now });
    const old = load({ ...save, v: 4, critters: save.critters.filter((c) => !BIG.includes(c.type)) });
    assert.equal(count(old), { sunny: 6, snowy: 5, candy: 4, flat: 4 }[theme], theme);
    assert.equal(count(load(old.exportSave())), count(old), `${theme}: only the once`);
  }
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

test('a bigger island has room for more animals, and keeps its size and its animals when saved', () => {
  for (const [size, side, max] of [
    ['big', 192, 96],
    ['huge', 256, 128],
  ]) {
    const { room, time } = makeRoom({ size });
    assert.equal(room.world.W, side);
    assert.equal(room.world.D, side);
    const a = join(room);
    assert.equal(a.last('welcome').meta.W, side);
    const s = room.world.spawn;
    for (let i = 0; i < max + 5; i++) {
      time.advance(50);
      room.receive(a, { t: 'critter', op: 'invite', type: 'bunny', x: s.x, y: s.y, z: s.z });
    }
    assert.equal(room.critters.list.length, max, `${size}: ${max} animals at most`);
    const copy = new Room({ code: '123456', save: JSON.parse(JSON.stringify(room.exportSave())), now: time.now });
    assert.equal(copy.world.W, side);
    assert.deepEqual(copy.world.blocks, room.world.blocks);
    assert.equal(copy.critters.list.length, max, `${size}: every animal comes back`);
  }
});

test('a flood of messages is rate limited', () => {
  const { room } = makeRoom();
  const a = join(room);
  const b = join(room, { name: 'Brave Otter' });
  for (let i = 0; i < 1000; i++) room.receive(a, { t: 'emote', e: 'wave' });
  assert.ok(b.all('emote').length < 400, `${b.all('emote').length} emotes got through`);
});
