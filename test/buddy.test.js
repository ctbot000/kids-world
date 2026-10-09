// The AI friend: invited to an island of this server, it comes in under its
// own name and look, says hello and answers what friends say (with what the
// model was told about it), builds when asked, walks after its friend and
// flies to one far away, helps a dizzy friend up and bops a monster coming at
// one; it goes home when asked, when left alone, and stays away from an island
// whose owner sent it home. The admin page changes its settings, shows the
// islands it is on with what is said there, has it say something there as
// its own words, and sends it home from one. It keeps an island of its own,
// where it builds what the model picks a layer at a time, kept over a
// restart, and the admin page sees what it is doing there. The keeper lists it as a player to invite and
// passes invitations on to it. The model here is a stand-in; visiting a
// browser's island peer to peer is in e2e.test.js.
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, test } from 'node:test';
import { Reassembler, sendText } from '../public/js/shared/framing.js';
import { KEEPER_VERSION } from '../public/js/shared/keeper.js';
import { PROTOCOL, Room } from '../public/js/shared/room.js';
import * as B from '../public/js/shared/blocks.js';
import { Buddy, DEFAULT_NAME, isGoodbye, isPersonal, isPrying, languageOf, systemPrompt, tidySay } from '../server/buddy.js';
import { adminHandler } from '../server/admin.js';
import { FriendControl } from '../server/friend.js';
import { createIdentity, Keeper, KeeperStore } from '../server/keeper.js';
import { createGameServer } from '../server/server.js';
import { Ollama } from '../server/llm.js';

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
  // Between them: Minji stands in the start's safe place, which a monster
  // keeps out of, so one put down further off goes round its edge, away up
  // the hills, rather than at her.
  const [mx, mz] = [(me.s[0] + pip.s[0]) / 2, (me.s[2] + pip.s[2]) / 2];
  const m = room.monsters.add(w, mx, w.groundBelow(Math.floor(mx), Math.floor(me.s[1]) + 2, Math.floor(mz)) + 1, mz);
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

test('the admin page saves its settings and applies them, shows where it is and what is said, has it say something, and sends it home', async () => {
  const dir = await tempDir();
  const store = await new KeeperStore(join(dir, 'keep')).open();
  const { room, rooms, island } = server();
  const minji = child(room);
  const llm = { ...model(() => ({ say: 'Hi Minji!', action: 'none', stamp: 'none' })), url: 'http://127.0.0.1:11434', models: async () => ['gemma3:4b', 'llama3.2:3b'] };
  const control = new FriendControl({ dir: store.dir, llm, env: {}, make: (s) => friend({ llm, rooms, name: s.name, wander: s.wander, maxVisits: s.maxVisits }) });
  after(() => control.stop());
  await control.start();
  const web = createGameServer({ log: () => {}, admin: adminHandler({ store, friend: control }) });
  after(() => web.close());
  await new Promise((done) => web.listen(0, '127.0.0.1', done));
  const base = `http://127.0.0.1:${web.address().port}/admin/api/friend`;
  const put = (body, headers = { 'X-Kids-World-Admin': '1' }) => fetch(base, { method: 'PUT', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body) });

  let state = await (await fetch(base)).json();
  assert.deepEqual(state.settings, { on: true, name: DEFAULT_NAME, model: 'gemma3:4b', wander: true, maxVisits: 2, home: true });
  assert.equal(state.saved, false, 'from the environment until saved');
  assert.equal(state.ready, true);
  assert.deepEqual(state.models, ['gemma3:4b', 'llama3.2:3b']);

  // Invited, it is on the island, with what was said there.
  control.buddy.invited(island, 'Minji');
  await eventually(() => minji.of('say').some((m) => m.text === 'Hi Minji!'));
  state = await (await fetch(base)).json();
  assert.equal(state.visits.length, 1);
  assert.equal(state.visits[0].invitedBy, 'Minji');
  assert.deepEqual(state.visits[0].players, ['Minji']);
  assert.deepEqual(state.visits[0].chat.at(-1), { name: DEFAULT_NAME, text: 'Hi Minji!', mine: true });
  assert.equal(state.stats.answers, 1);
  assert.match(state.history[0].text, /off to "Maple Fields", invited by Minji/);
  // The model log: what it was sent, word for word, and what came back.
  const { calls } = await (await fetch(`${base}/llm`)).json();
  assert.equal(calls.length, 1);
  assert.equal(calls[0].state, 'answered');
  assert.equal(calls[0].about, 'what to say on “Maple Fields”');
  assert.deepEqual(calls[0].messages.map((m) => m.role), ['system', 'user']);
  assert.match(calls[0].messages[1].content, /Friends here: Minji/);
  assert.deepEqual(calls[0].answer, { say: 'Hi Minji!', action: 'none', stamp: 'none' });
  assert.ok(calls[0].schema.properties.say);
  assert.equal((await fetch(`${base}/llm`, { method: 'POST', headers: { 'X-Kids-World-Admin': '1' } })).status, 405);

  // Settings: checked, saved, and applied; a new name from its next visit on.
  assert.equal((await put({ name: 'Bolt 🤖' }, {})).status, 403, 'only with the admin header');
  assert.equal((await put({ maxVisits: 9 })).status, 400);
  assert.equal((await put({ name: '   ' })).status, 400);
  state = await (await put({ name: 'Bolt 🤖', model: 'llama3.2:3b', wander: false, maxVisits: 3 })).json();
  assert.deepEqual(state.settings, { on: true, name: 'Bolt 🤖', model: 'llama3.2:3b', wander: false, maxVisits: 3, home: true });
  assert.equal(llm.model, 'llama3.2:3b');
  assert.equal(control.buddy.name, 'Bolt 🤖');
  assert.equal(control.buddy.wander, false);
  assert.equal(state.visits[0].chat.at(-1).name, DEFAULT_NAME, 'the island knows it by the name it came with');
  assert.deepEqual(JSON.parse(await readFile(join(store.dir, 'ai-friend.json'), 'utf8')), state.settings);

  // Said there as its own words, under the name the island knows, and marked as from the admin page.
  const say = (code, text) => fetch(`${base}/visits/${code}/say`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Kids-World-Admin': '1' }, body: JSON.stringify({ text }) });
  assert.equal((await say(island.code, '   ')).status, 400);
  assert.equal((await say(island.code, 'x'.repeat(121))).status, 400);
  assert.equal((await say('999999', 'Hello')).status, 404);
  const asked = llm.asked.length;
  assert.equal((await say(island.code, '간식 시간이야! 🍪')).status, 200);
  const pid = buddyIn(room).id;
  await eventually(() => minji.of('say').some((m) => m.pid === pid && m.text === '간식 시간이야! 🍪'));
  state = await (await fetch(base)).json();
  assert.deepEqual(state.visits[0].chat.at(-1), { name: DEFAULT_NAME, text: '간식 시간이야! 🍪', mine: true, admin: true });
  assert.equal(llm.asked.length, asked, 'without asking the model');
  assert.ok(!state.history.some((e) => e.text.includes('간식')), 'what was said is not in what it did');
  // What it says next, the model sees as its own.
  minji.say({ t: 'say', text: 'yay cookies' });
  await eventually(() => llm.asked.length > asked);
  assert.match(llm.asked.at(-1), /Pip 🤖 \(you\): 간식 시간이야! 🍪\nMinji: yay cookies/);

  // Sent home from the island, and not back there by itself for a while.
  const home = (code) => fetch(`${base}/visits/${code}/home`, { method: 'POST', headers: { 'X-Kids-World-Admin': '1' } });
  assert.equal((await home('999999')).status, 404);
  assert.equal((await home(island.code)).status, 200);
  await eventually(() => !buddyIn(room) && control.buddy.visits.size === 0);
  assert.ok(control.buddy.avoid.get(island.code) > Date.now() + 3600000);

  // Off, and on again as it was saved: by a new control, as after a restart.
  state = await (await put({ on: false })).json();
  assert.equal(state.running, false);
  assert.equal(control.buddy, null);
  assert.ok(state.history.length, 'what it did is still there');
  const again = new FriendControl({ dir: store.dir, llm, env: { KIDS_WORLD_AI: 'off' }, make: (s) => friend({ llm, rooms, name: s.name }) });
  await again.start();
  assert.equal(again.buddy, null, 'the saved settings win over the environment');
  await again.change({ on: true });
  assert.equal(again.buddy.name, 'Bolt 🤖');
  again.stop();
});

test('it keeps an island of its own, builds there what the model picks a layer at a time, and has it again after a restart', async () => {
  const dir = await tempDir();
  const homeFile = join(dir, 'ai-friend-island.json');
  const llm = model((prompt) => {
    if (prompt.includes('Things you can build')) return { thing: 'rocket', color: 'teal', size: 'small', name: 'Star Zoomer', say: 'I am building a rocket! 🚀' };
    if (prompt.includes('Minji: build a castle')) return { say: 'A castle? Yes!', action: 'build', stamp: 'none' };
    return { say: 'Hi Minji! Welcome to my island!', action: 'wave', stamp: 'none' };
  });
  const rooms = new Map();
  const lines = [];
  const buddy = friend({ llm, rooms, home: true, homeFile, layerMs: 30, firstBuildMs: 0, log: (text) => lines.push(text) });
  await buddy.start();
  assert.equal(rooms.size, 1, 'an island of its own on this server');
  const [{ room }] = rooms.values();
  const timer = setInterval(() => room.tick(), 100);
  after(() => clearInterval(timer));
  assert.equal(room.world.name, "Pip's Island");
  const pip = await eventually(() => buddyIn(room));
  assert.equal(room.host, pip.id, 'the owner of it');
  assert.equal(room.listing().players, 1, 'on the list of open islands');
  assert.equal(buddy.wanderOnce(), null, 'never visiting itself');

  // It picks what to build, walks over and builds it a layer at a time, saying what it does.
  const doing = await eventually(() => buddy.home.summary().doing.match(/^Building a teal rocket \(“Star Zoomer”\): layer \d+ of \d+$/));
  assert.ok(doing);
  assert.match(llm.asked.find((p) => p.includes('Things you can build')), /- rocket: a rocket/);
  await eventually(() => buddy.builds.length === 1, 30000);
  assert.deepEqual(
    { key: buddy.builds[0].key, title: buddy.builds[0].title, name: buddy.builds[0].name },
    { key: 'rocket', title: 'a teal rocket', name: 'Star Zoomer' },
  );
  const teal = B.TOY_BRICKS[5];
  const count = (w) => w.blocks.reduce((n, id) => n + (id === teal ? 1 : 0), 0);
  assert.ok(count(room.world) > 20, 'the rocket is there');
  assert.ok(lines.some((l) => /started building a teal rocket, “Star Zoomer”, on its own island: “I am building a rocket! 🚀”/.test(l)));
  assert.ok(lines.some((l) => /finished building a teal rocket/.test(l)));
  assert.match(buddy.home.summary().doing, /Resting on its island|Looking around/);

  // A friend comes, is greeted, says bye without sending it off its own island, and asks for a build.
  const minji = child(room);
  await eventually(() => minji.of('say').some((m) => m.pid === pip.id && m.text.startsWith('Hi Minji')));
  minji.say({ t: 'say', text: 'bye Pip' });
  await new Promise((done) => setTimeout(done, 3500));
  assert.ok(buddyIn(room), 'still on its own island');
  minji.say({ t: 'say', text: 'build a castle' });
  await eventually(() => llm.asked.some((p) => p.includes('A friend asked you to build something')));
  // Built though the friend who asked was just talking with it.
  await eventually(() => buddy.builds.length === 2, 30000);

  // Stopped and started again, as after a restart: the same island, with the rocket, and it its owner.
  await buddy.stop();
  const kept = JSON.parse(await readFile(homeFile, 'utf8'));
  assert.equal(kept.code, room.code);
  assert.equal(kept.builds[0].key, 'rocket');
  const rooms2 = new Map();
  const again = friend({ llm, rooms: rooms2, home: true, homeFile, firstBuildMs: 60000 });
  await again.start();
  const room2 = rooms2.get(room.code)?.room;
  assert.ok(room2, 'under the same code');
  assert.ok(count(room2.world) > 20, 'with what it built');
  const pip2 = await eventually(() => buddyIn(room2));
  assert.equal(pip2.id, pip.id, 'as the same player');
  assert.equal(room2.host, pip2.id);
  assert.equal(again.builds.length, 2);
  await again.stop();
});

test('the Ollama client fills in a trace of each question for the model log', async () => {
  const sent = [];
  const fetch = async (url, init) => {
    sent.push(JSON.parse(init.body));
    return new Response(JSON.stringify({ message: { content: '{"say":"Hi!"}' }, prompt_eval_count: 120, eval_count: 9, total_duration: 2.5e9, load_duration: 1e9, prompt_eval_duration: 4e8, eval_duration: 1e9, done_reason: 'stop' }));
  };
  const llm = new Ollama({ url: 'http://ollama.test/', model: 'tiny', fetch });
  const trace = {};
  assert.deepEqual(await llm.chat([{ role: 'user', content: 'hi' }], { type: 'object' }, trace), { say: 'Hi!' });
  assert.equal(trace.model, 'tiny');
  assert.equal(trace.raw, '{"say":"Hi!"}');
  assert.deepEqual(trace.ollama, { promptTokens: 120, tokens: 9, totalMs: 2500, loadMs: 1000, promptMs: 400, answerMs: 1000, doneReason: 'stop' });
  assert.deepEqual(trace.options, sent[0].options);
  assert.ok(trace.sentAt > 0);
  // Without a trace, as before.
  assert.deepEqual(await llm.chat([{ role: 'user', content: 'hi' }], { type: 'object' }), { say: 'Hi!' });
});
