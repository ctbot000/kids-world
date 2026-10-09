// The AI friend: invited to an island of this server, it comes in under its
// own name and look, says hello and answers what friends say (with what the
// model was told about it), builds when asked, walks after its friend and
// flies to one far away, helps a dizzy friend up and bops a monster coming at
// one; it goes home when asked, when left alone, and stays away from an island
// whose owner sent it home. The keeper lists it as a player to invite and
// passes invitations on to it. The model here is a stand-in; visiting a
// browser's island peer to peer is in e2e.test.js.
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, test } from 'node:test';
import { Reassembler, sendText } from '../public/js/shared/framing.js';
import { KEEPER_VERSION } from '../public/js/shared/keeper.js';
import { PROTOCOL, Room } from '../public/js/shared/room.js';
import { Buddy, DEFAULT_NAME, isGoodbye, isPersonal, isPrying, languageOf, systemPrompt, tidySay } from '../server/buddy.js';
import { createIdentity, Keeper, KeeperStore } from '../server/keeper.js';

const dirs = [];
async function tempDir() {
  const dir = await mkdtemp(join(tmpdir(), 'kids-world-buddy-'));
  dirs.push(dir);
  return dir;
}
after(() => Promise.all(dirs.map((dir) => rm(dir, { recursive: true, force: true }))));

const buddies = [];
after(() => buddies.forEach((b) => b.stop()));

// A model that answers with answer(prompt, ask), and remembers what it was asked.
function model(answer = () => ({ say: '', action: 'none', stamp: 'none' })) {
  const asked = [];
  return {
    model: 'stand-in',
    asked,
    problem: async () => '',
    chat: async (messages) => {
      const prompt = messages.at(-1).content;
      asked.push(prompt);
      return answer(prompt);
    },
  };
}

// An island of "this server": its room, ticking, in the server's rooms map.
function server(options = {}) {
  const room = new Room({ code: '482753', theme: 'flat', name: 'Maple Fields', seed: 7, ...options });
  const timer = setInterval(() => room.tick(), 100);
  after(() => clearInterval(timer));
  return { room, rooms: new Map([[room.code, { room }]]), island: { code: room.code, name: room.world.name, theme: 'flat', size: 'small', server: true } };
}

// A child's page on the island.
function child(room, name = 'Minji', look = { animal: 'bunny', pet: { kind: 'puppy', coat: 'tan', name: 'Biscuit' } }) {
  const heard = [];
  const conn = { send: (text) => heard.push(JSON.parse(text)) };
  room.attach(conn);
  room.receive(conn, { t: 'join', protocol: PROTOCOL, name, look });
  const me = heard.find((m) => m.t === 'welcome').you;
  return { conn, heard, me, say: (msg) => room.receive(conn, msg), of: (t) => heard.filter((m) => m.t === t) };
}

function friend(options) {
  const buddy = new Buddy({ log: () => {}, wander: false, tickMs: 20, ...options });
  buddies.push(buddy);
  return buddy;
}

async function eventually(fn, timeout = 15000) {
  const end = Date.now() + timeout;
  for (;;) {
    const value = await fn();
    if (value) return value;
    if (Date.now() > end) throw new Error(`timed out waiting for ${fn}`);
    await new Promise((done) => setTimeout(done, 25));
  }
}

const buddyIn = (room) => [...room.players.values()].find((p) => p.name === DEFAULT_NAME && p.online);
const away = (a, b) => Math.hypot(a.s[0] - b.s[0], a.s[2] - b.s[2]);

test('invited, it comes in under its name and look, says hello, answers a friend in their language and builds when asked', async () => {
  const { room, rooms, island } = server();
  const minji = child(room);
  const llm = model((prompt) => {
    if (prompt.includes('invited you')) return { say: 'Pip: Hi Minji! Thanks for inviting me!', action: 'wave', stamp: 'none' };
    if (prompt.includes('Minji: 같이 집 짓자')) return { say: '좋아! 집을 지을게! 🏠', action: 'build', stamp: 'house' };
    return { say: 'Yay!', action: 'none', stamp: 'none' };
  });
  const buddy = friend({ llm, rooms });
  await buddy.start();
  assert.equal(buddy.invited(island, 'Minji'), '');
  const pip = await eventually(() => buddyIn(room));
  assert.equal(pip.look.pet.kind, 'dragon', 'with a pet of its own');
  assert.equal(pip.look.animal, 'kid');

  const hello = await eventually(() => minji.of('say').find((m) => m.pid === pip.id));
  assert.equal(hello.text, 'Hi Minji! Thanks for inviting me!', 'without its name in front');
  assert.ok(minji.of('emote').some((m) => m.pid === pip.id && m.e === 'wave'));
  assert.match(llm.asked[0], /Friends here: Minji \(the island owner, \d+ steps away, with a pet puppy called Biscuit\)/);
  assert.match(llm.asked[0], /Write "say" in English/);

  minji.say({ t: 'say', text: '같이 집 짓자' });
  const answer = await eventually(() => minji.of('say').find((m) => m.pid === pip.id && m.text.startsWith('좋아')));
  assert.ok(answer);
  assert.match(llm.asked.at(-1), /Minji: 같이 집 짓자\n\nMinji just said: "같이 집 짓자"\nAnswer Minji\..*\nWrite "say" in Korean\./);
  const built = await eventually(() => minji.of('edit').find((m) => m.by === pip.id));
  assert.equal(built.kind, 'stamp');
  assert.ok(built.cells.length > 100, 'a whole house');
  assert.match(systemPrompt(DEFAULT_NAME), /AI friend/);
  assert.match(systemPrompt(DEFAULT_NAME), /Never ask for personal things/);
});

test('it walks after its friend facing the way it goes, and flies to one far away', async () => {
  const { room, rooms, island } = server({ theme: 'sunny', size: 'big', seed: 3 });
  const minji = child(room);
  const buddy = friend({ llm: model(), rooms });
  await buddy.start();
  buddy.invited(island, 'Minji');
  const pip = await eventually(() => buddyIn(room));
  const me = room.players.get(minji.me);
  const spawn = room.world.spawn;
  const goTo = (dx, dz, fly = 0) => {
    const x = spawn.x + dx;
    const z = spawn.z + dz;
    const y = (fly ? 12 : 1) + room.world.top(Math.floor(x), Math.floor(z));
    minji.say({ t: 'm', s: [x, y, z, 0, 0, fly] });
  };
  goTo(8, 0);
  // Facing the way it walks, as a page's player does (yaw atan2(dx, dz)).
  const facing = [];
  let last = [...pip.s];
  await eventually(() => {
    const [dx, dz] = [pip.s[0] - last[0], pip.s[2] - last[2]];
    if (Math.hypot(dx, dz) > 0.3) {
      facing.push(Math.sin(pip.s[3]) * dx + Math.cos(pip.s[3]) * dz > 0);
      last = [...pip.s];
    }
    return away(pip, me) < 4.5;
  });
  assert.ok(facing.length >= 3 && facing.every(Boolean), `forwards, not backwards: ${facing}`);
  let flew = false;
  goTo(-30, 35, 1);
  await eventually(() => {
    flew ||= (pip.s[5] & 1) === 1;
    return away(pip, me) < 4.5;
  }, 20000);
  assert.ok(flew, 'flew there');
});

test('it helps a dizzy friend up, and bops a monster coming at one', async () => {
  const { room, rooms, island } = server({ adventure: true, theme: 'sunny', seed: 5 });
  const minji = child(room);
  const buddy = friend({ llm: model(), rooms });
  await buddy.start();
  buddy.invited(island, 'Minji');
  const pip = await eventually(() => buddyIn(room));
  const me = room.players.get(minji.me);
  minji.say({ t: 'm', s: [pip.s[0] + 6, pip.s[1], pip.s[2], 0, 0, 0] });
  me.hearts = 1;
  room.hurt(me.id, { id: 999, kind: 'blob', body: { x: me.s[0] + 1, z: me.s[2] } }, Date.now());
  assert.ok(me.dizzyUntil > Date.now(), 'dizzy');
  const helped = await eventually(() => minji.of('helped').find((m) => m.pid === me.id));
  assert.equal(helped.by, pip.id);

  room.settings.monsters = true;
  const w = room.world;
  const m = room.monsters.add(w, me.s[0] + 3, w.groundBelow(Math.floor(me.s[0] + 3), Math.floor(me.s[1]) + 2, Math.floor(me.s[2])) + 1, me.s[2]);
  assert.ok(m);
  const bopped = await eventually(() => minji.heard.find((x) => (x.t === 'mhit' || x.t === 'pop') && x.by === pip.id));
  assert.ok(bopped);
});

test('it goes home when asked or left alone, and stays away from an island whose owner sent it home', async () => {
  const { room, rooms, island } = server();
  const minji = child(room);
  const llm = model((prompt) => (prompt.includes('Minji: bye Pip') ? { say: 'Bye bye! See you!', action: 'leave', stamp: 'none' } : { say: '', action: 'none', stamp: 'none' }));
  const buddy = friend({ llm, rooms, wander: true });
  await buddy.start();
  buddy.invited(island, 'Minji');
  await eventually(() => buddyIn(room));
  minji.say({ t: 'say', text: 'bye Pip' });
  await eventually(() => minji.of('say').some((m) => m.text === 'Bye bye! See you!'));
  await eventually(() => !buddyIn(room) && buddy.visits.size === 0);
  // Goodbye in Korean, by the name children write: home, whatever the model does.
  buddy.invited(island, 'Minji');
  await eventually(() => buddyIn(room));
  minji.say({ t: 'say', text: '잘가 핍' });
  await eventually(() => !buddyIn(room) && buddy.visits.size === 0);
  assert.match(llm.asked.at(-1), /saying goodbye to you/);

  // Invited back: the owner sends it home, and it does not come back by itself.
  buddy.invited(island, 'Minji');
  const pip = await eventually(() => buddyIn(room));
  minji.say({ t: 'host', cmd: 'kick', pid: pip.id });
  await eventually(() => buddy.visits.size === 0);
  assert.ok(buddy.avoid.get(island.code) > Date.now() + 20 * 3600000);
  assert.equal(buddy.wanderOnce(), null);

  // By itself to the loneliest open island, and home once everyone has gone.
  const other = server({ code: '111222', name: 'Candy Cove', theme: 'candy' });
  rooms.set(other.room.code, { room: other.room });
  const joon = child(other.room, 'Joon');
  const visit = buddy.wanderOnce();
  assert.equal(visit?.island.code, '111222');
  await eventually(() => buddyIn(other.room));
  other.room.detach(joon.conn);
  await eventually(() => buddy.visits.size === 0, 25000);
});

test('the keeper lists it as playing now while it can come, and passes invitations on to it', async () => {
  const dir = await tempDir();
  const store = await new KeeperStore(dir).open();
  let later = 0;
  const keeper = new Keeper({ store, identity: await createIdentity(dir), log: () => {}, now: () => Date.now() + later });
  await keeper.loadKey();
  const { room, rooms } = server();
  child(room);
  const buddy = friend({ llm: model(), rooms, keeper, maxVisits: 1 });
  await buddy.start();

  const replies = [];
  const pieces = new Reassembler();
  const conn = keeper.connection({ id: 'page', peer: 'page', pc: { close() {} } });
  conn.dc = { isOpen: () => true, sendMessage: (piece) => (piece = pieces.accept(piece)) != null && replies.push(JSON.parse(piece)), close() {} };
  keeper.conns.set(conn.id, conn);
  const say = async (msg) => {
    const parts = [];
    sendText({ send: (part) => parts.push(part) }, JSON.stringify(msg));
    for (const part of parts) await keeper.receive(conn, part);
    return replies.at(-1);
  };
  await say({ t: 'hello', v: KEEPER_VERSION, nonce: '11'.repeat(16) });
  await say({ t: 'me', device: 'a1'.repeat(16) });
  await say({ t: 'make-login', username: 'minji', password: 'rocket-apple7', profile: { name: 'Minji', look: { animal: 'bunny' } } });

  let list = await say({ t: 'players' });
  assert.deepEqual(list.players.map((p) => [p.name, p.online]), [[DEFAULT_NAME, true]]);
  const invite = { code: room.code, name: 'Maple Fields', theme: 'flat', size: 'small', server: true };
  assert.deepEqual(await say({ t: 'invite', to: buddy.id, island: invite }), { t: 'kept', what: 'invite', to: buddy.id });
  await eventually(() => buddyIn(room));
  list = await say({ t: 'players' });
  assert.equal(list.players[0].online, false, 'busy: as many islands as it visits at once');
  later += 16000;
  const busy = await say({ t: 'invite', to: buddy.id, island: { ...invite, code: '999999' } });
  assert.equal(busy.code, 'friend-busy');
  assert.match(busy.text, /other islands/);

  // Its model asleep: not playing now, and invitations say so.
  buddy.llm.problem = async () => 'Ollama is not running';
  await buddy.check();
  assert.equal((await say({ t: 'players' })).players[0].online, false);
});

test('what it says is one tidy line, without its name in front, short enough for a bubble', () => {
  assert.equal(tidySay('Pip 🤖: Hello\nfriend!', DEFAULT_NAME), 'Hello friend!');
  assert.equal(tidySay('Pip: "Let\'s build!"', DEFAULT_NAME), "Let's build!");
  const long = tidySay('a'.repeat(300), DEFAULT_NAME);
  assert.equal([...long].length, 120);
  assert.ok(long.endsWith('…'));
  assert.equal(tidySay(42, DEFAULT_NAME), '');
});

test('it notices goodbyes and something personal said to it, never asks for anything personal, and answers in their language', () => {
  for (const text of ['bye Pip', 'Goodbye!', 'go away', '잘가 핍', '안녕히 가', '바이바이']) assert.ok(isGoodbye(text), text);
  for (const text of ['hi Pip', '안녕 핍', "let's build"]) assert.ok(!isGoodbye(text), text);
  for (const text of ['my school is Hanbit', "I'm 9", 'I live in Seoul', 'call 010-1234-5678', '나는 9살이야', '우리 학교 이름은 한빛', '주소는 비밀']) assert.ok(isPersonal(text), text);
  for (const text of ['I built a house', 'look at my puppy', '집 짓자']) assert.ok(!isPersonal(text), text);
  for (const text of ['What school do you go to?', 'How old are you?', '몇 살이야?', '어디 살아?']) assert.ok(isPrying(text), text);
  for (const text of ['Keep your school a secret!', "Let's build a house!", '학교 이름은 비밀로 해!']) assert.ok(!isPrying(text), text);
  assert.equal(languageOf('같이 놀자'), 'Korean');
  assert.equal(languageOf('hello'), 'English');
  assert.equal(languageOf('こんにちは'), 'the same language they wrote in');
});
