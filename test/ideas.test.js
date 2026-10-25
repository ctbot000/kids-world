// Ideas for the game: a logged-in player sends one from the game, the keeper
// keeps it (so many an hour, so many waiting), a CTB worker reads it and says
// yes or no, the answer goes to the pages of that player alone, and a yes is
// filed as a proposal on GitHub without the player's name. Each answer is
// scored, and the player hears each step an accepted idea takes after (picked,
// built, checked, in the game). The protocol is driven without WebRTC;
// GitHub and the model are stand-ins.
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, test } from 'node:test';
import { Reassembler, sendText } from '../public/js/shared/framing.js';
import { cleanWish, KEEPER_VERSION, TELL_US_LEVEL, WISHES_AN_HOUR, WISHES_WAITING } from '../public/js/shared/keeper.js';
import { levelFor } from '../public/js/shared/levels.js';
import { LABELS } from '../server/ctb-github.js';
import { Company, creditIn, defaultSettings, mdText, newsOf, pullBody, stageOf } from '../server/ctb.js';
import { createIdentity, Keeper, KeeperStore } from '../server/keeper.js';

const dirs = [];
async function tempDir() {
  const dir = await mkdtemp(join(tmpdir(), 'kids-world-ideas-'));
  dirs.push(dir);
  return dir;
}
after(() => Promise.all(dirs.map((dir) => rm(dir, { recursive: true, force: true }))));

const TABLET = 'a1'.repeat(16);
const PHONE = 'b2'.repeat(16);
const GUEST = 'd4'.repeat(16);
const PASSWORD = 'rocket-apple7';

async function page(keeper, device, nonce) {
  const replies = [];
  const pieces = new Reassembler();
  const conn = keeper.connection({ id: `page-${Math.random()}`, peer: 'page', pc: { close() {} } });
  conn.dc = {
    isOpen: () => !conn.closed,
    sendMessage: (piece) => {
      const text = pieces.accept(piece);
      if (text != null) replies.push(JSON.parse(text));
    },
    close() {},
  };
  keeper.conns.set(conn.id, conn);
  const say = async (msg) => {
    const parts = [];
    sendText({ send: (part) => parts.push(part) }, JSON.stringify(msg));
    const before = replies.length;
    for (const part of parts) await keeper.receive(conn, part);
    return replies.length > before ? replies.at(-1) : null;
  };
  await say({ t: 'hello', v: KEEPER_VERSION, nonce: nonce.repeat(16) });
  await say({ t: 'me', device });
  return { conn, replies, say, news: () => replies.filter((r) => r.t === 'wish-news') };
}

// Camps freed on Adventure Isle, 50 XP each: 24 of them is level 5 there,
// enough to send ideas and tell of problems.
const FREED_TO_TELL_US = 24;
const playIsle = (page, name, freed = FREED_TO_TELL_US) => page.say({ t: 'adventure', profile: { name, stats: { freed } } });

async function keeperWith(clock) {
  const dir = await tempDir();
  const now = () => clock.t;
  const store = await new KeeperStore(dir, { now }).open();
  const keeper = new Keeper({ store, identity: await createIdentity(dir), log: () => {}, now });
  await keeper.loadKey();
  return { store, keeper };
}

test('a logged-in player sends ideas, within limits, and only their own pages hear the answers', async () => {
  const clock = { t: Date.UTC(2026, 9, 18, 3) };
  const { store, keeper } = await keeperWith(clock);
  const heard = [];
  keeper.on('wish', (w) => heard.push(w));

  // Nobody sends one without logging in, nor tells of a problem.
  const guest = await page(keeper, GUEST, '11');
  assert.match((await guest.say({ t: 'wish', text: 'More ponies!' })).text, /Log in/);
  assert.match((await guest.say({ t: 'wishes' })).text, /Log in/);
  assert.match((await guest.say({ t: 'report', report: { text: 'The pony is stuck' } })).text, /Log in to tell of a problem/);
  assert.deepEqual(await store.reports(), []);

  const tablet = await page(keeper, TABLET, '22');
  await tablet.say({ t: 'make-login', username: 'Otter Fan', password: PASSWORD, profile: { name: 'Sunny Otter', look: { animal: 'cat' } } });
  const other = await page(keeper, PHONE, '33');
  await other.say({ t: 'make-login', username: 'Brave Fox', password: PASSWORD, profile: { name: 'Brave Fox' } });

  // Logged in, but not far enough on Adventure Isle yet: neither is kept.
  assert.equal(levelFor(50 * FREED_TO_TELL_US), TELL_US_LEVEL);
  const early = await tablet.say({ t: 'wish', text: 'More ponies!' });
  assert.equal(early.code, 'level');
  assert.match(early.text, /Reach level 5 on Adventure Isle to send an idea/);
  await playIsle(tablet, 'Sunny Otter', FREED_TO_TELL_US - 1);
  assert.equal((await tablet.say({ t: 'report', report: { text: 'The pony is stuck' } })).code, 'level', 'level 4 is not enough');
  assert.deepEqual(await store.reports(), []);
  assert.deepEqual(await store.wishes(), []);
  await playIsle(tablet, 'Sunny Otter');
  await playIsle(other, 'Brave Fox');

  assert.match((await tablet.say({ t: 'wish', text: '   ' })).text, /Write your idea/);
  // Each a second after the last, so the newest first is one order.
  const wish = (text) => {
    clock.t += 1000;
    return tablet.say({ t: 'wish', text });
  };
  const kept = await wish('  A   rainbow\nslide!  ');
  // Logged in, a problem is kept, under their name.
  const told = await tablet.say({ t: 'report', report: { text: 'The pony is stuck', about: { name: 'Sunny Otter' } } });
  assert.equal(told.what, 'report');
  assert.equal((await store.reports())[0].username, 'Otter Fan');
  assert.equal(kept.what, 'wish');
  assert.deepEqual(Object.keys(kept.wish).sort(), ['answeredAt', 'at', 'by', 'id', 'reply', 'score', 'stage', 'stageAt', 'state', 'text'], 'never who sent it');
  assert.equal(kept.wish.text, 'A rainbow slide!');
  assert.equal(kept.wish.state, 'waiting');
  assert.equal(heard.length, 1);
  assert.equal(heard[0].name, 'Sunny Otter', 'CTB and the admin page know who sent it');
  assert.deepEqual(cleanWish(kept.wish), kept.wish);

  // So many an hour.
  for (let i = 1; i < WISHES_AN_HOUR; i++) assert.equal((await wish(`Idea ${i}`)).what, 'wish');
  const busy = await wish('One more');
  assert.equal(busy.code, 'wait');
  // An hour on, more; but so many waiting at once at most.
  clock.t += 3600001;
  for (let i = WISHES_AN_HOUR; i < WISHES_WAITING; i++) await wish(`Idea ${i}`);
  assert.match((await wish('Too many')).text, /still being read/);

  // Their own ideas, the newest first; another player sees only theirs.
  const mine = (await tablet.say({ t: 'wishes' })).wishes;
  assert.equal(mine.length, WISHES_WAITING);
  assert.equal(mine.at(-1).text, 'A rainbow slide!');
  assert.deepEqual((await other.say({ t: 'wishes' })).wishes, []);

  // An answer: kept, and told to that player's pages, not another's.
  const answered = await keeper.answerWish(kept.wish.id, { state: 'accepted', by: 'Ada 💼', reply: 'Yes! A rainbow slide sounds super fun.', score: 81.6, issue: { number: 9, url: 'https://github.com/x/y/issues/9' } });
  assert.equal(answered.issue.number, 9);
  assert.equal(tablet.news().length, 1);
  assert.deepEqual(tablet.news()[0].wish, { ...kept.wish, state: 'accepted', by: 'Ada 💼', reply: 'Yes! A rainbow slide sounds super fun.', answeredAt: clock.t, score: 82 });
  assert.equal(other.news().length, 0);
  // Each step it takes since is kept and told to that player too, once.
  clock.t += 1000;
  assert.equal((await keeper.stageWish(kept.wish.id, 'building')).stage, 'building');
  assert.equal(await keeper.stageWish(kept.wish.id, 'building'), null, 'no news when it is there already');
  assert.equal(await keeper.stageWish(kept.wish.id, 'flying'), null);
  assert.equal(tablet.news().length, 2);
  assert.deepEqual(tablet.news()[1].wish, { ...tablet.news()[0].wish, stage: 'building', stageAt: clock.t });
  assert.deepEqual(cleanWish(tablet.news()[1].wish), tablet.news()[1].wish);
  assert.equal(other.news().length, 0);
  assert.equal((await store.wishes()).find((w) => w.id === kept.wish.id).state, 'accepted');
  assert.equal(await keeper.answerWish('1234567890123-00000000', { state: 'declined', by: 'x', reply: 'y' }), null);
  assert.equal(cleanWish({ id: 'nope', text: 'x' }), null);
});

// GitHub as the workers see it, in memory.
function hub() {
  const made = [];
  const issues = new Map();
  return {
    repo: 'ctbot000/toy',
    made,
    problem: async () => '',
    tasks: async () => [],
    proposals: async () => [],
    pulls: async () => [],
    requests: async () => [...issues.values()],
    issues,
    create: async ({ title, body, labels }) => {
      made.push({ title, body, labels });
      return { number: 40 + made.length, url: `https://github.com/ctbot000/toy/issues/${40 + made.length}` };
    },
  };
}

test('a worker reads each idea in turn, says yes or no in the player’s language, and files a yes as a proposal', async () => {
  const clock = { t: Date.UTC(2026, 9, 18, 3) };
  const { keeper } = await keeperWith(clock);
  const tablet = await page(keeper, TABLET, '22');
  await tablet.say({ t: 'make-login', username: 'Otter Fan', password: PASSWORD, profile: { name: 'Sunny Otter' } });
  await playIsle(tablet, 'Sunny Otter');
  const send = async (text) => {
    clock.t += 1000;
    return (await tablet.say({ t: 'wish', text })).wish;
  };
  const yes = await send('A rainbow slide on my island');
  const no = await send('숙제를 대신 해 주세요');
  const later = await send('Fireworks at night');

  const asked = [];
  let fail = true;
  const llm = {
    model: 'stand-in',
    problem: async () => '',
    models: async () => [],
    chat: async (messages, schema, trace) => {
      trace.usage = [{ name: 'Z.ai', model: 'stand-in', promptTokens: 5, tokens: 5 }];
      const idea = messages.at(-1).content.split("The child's idea:\n")[1];
      asked.push({ idea, system: messages[0].content, schema });
      if (idea.startsWith('A rainbow')) return { accept: true, score: 77, reply: 'Yes! We love that idea.', title: 'Add a rainbow slide stamp', tldr: 'A rainbow slide kids can slide down.', what: 'A stamp of a slide in rainbow bricks.', done: ['It is in the toy box', 'Sliding down it works'] };
      if (idea.startsWith('숙제')) return { accept: false, score: '12', reply: '그건 게임 밖의 일이라 할 수 없어요. 미안해요!', title: '', tldr: '', what: '', done: [] };
      if (fail) throw new Error('Z.ai is busy');
      return { accept: false, reply: 'We have fireworks already!' };
    },
  };
  const github = hub();
  const said = [];
  const company = new Company({
    llm,
    github,
    repoDir: await tempDir(),
    workDir: await tempDir(),
    settings: { ...defaultSettings({}), workers: 2, propose: false },
    log: () => {},
    office: { say: (k, text) => said.push([k, text]), emote: () => {} },
    wishes: { list: () => keeper.store.wishes(), answer: (id, a) => keeper.answerWish(id, a), stage: (id, stage) => keeper.stageWish(id, stage) },
  });
  company.problem = '';
  await company.reviewWishes();

  // The oldest first, each by the next worker; the one the model failed on waits.
  assert.deepEqual(
    asked.map((a) => a.idea),
    ['A rainbow slide on my island', '숙제를 대신 해 주세요', 'Fireworks at night'],
  );
  assert.match(asked[0].system, /^You are Ada/);
  assert.match(asked[1].system, /^You are Ben/);
  assert.match(asked[0].system, /in the language the child wrote in/);
  assert.match(asked[0].system, /Score the idea from 0 to 100/);
  assert.ok(asked[0].schema.required.includes('score'));
  const kept = await keeper.store.wishes();
  const of = (w) => kept.find((k) => k.id === w.id);
  assert.equal(of(yes).state, 'accepted');
  assert.equal(of(yes).by, 'Ada 💼');
  assert.equal(of(yes).reply, 'Yes! We love that idea.');
  assert.deepEqual(of(yes).issue, { number: 41, url: 'https://github.com/ctbot000/toy/issues/41' });
  // Each scored by the worker who read it, a yes or a no; the player sees it.
  assert.equal(of(yes).score, 77);
  assert.equal(of(no).score, 12, 'a score given as text');
  assert.match(github.made[0].body, /\*\*Score: 77\/100\*\*/);
  assert.equal(of(no).state, 'declined');
  assert.equal(of(no).reply, '그건 게임 밖의 일이라 할 수 없어요. 미안해요!');
  assert.equal(of(later).state, 'waiting');

  // A yes is a proposal, marked as a player's idea, short, and without who sent it.
  assert.equal(github.made.length, 1);
  assert.equal(github.made[0].title, 'Add a rainbow slide stamp');
  assert.deepEqual(github.made[0].labels, [LABELS.proposal, LABELS.request]);
  assert.match(github.made[0].body, /^## TL;DR\n\nA rainbow slide kids can slide down\./);
  // Credited to the player by the name they play under, never their username.
  assert.match(github.made[0].body, /💡 An idea from \*\*Sunny Otter\*\*, playing Kids World — thank you! Accepted by Ada 💼/);
  assert.doesNotMatch(github.made[0].body, /Otter Fan/);
  assert.equal(creditIn(github.made[0].body), 'Sunny Otter');
  // The pull request that makes it credits them too.
  assert.match(pullBody({ issue: { number: 41, body: github.made[0].body }, summary: 'Added it.', worker: 'Ben 💼', model: 'glm' }), /Closes #41\.\n\n💡 An idea from \*\*Sunny Otter\*\*, playing Kids World — thank you!/);
  assert.doesNotMatch(pullBody({ issue: { number: 3, body: 'A task.' }, summary: 'Done.', worker: 'Ben 💼', model: 'glm' }), /An idea from/);
  // A name says nothing but itself on GitHub: no formatting, links or @mentions.
  assert.equal(mdText('Sunny @Otter_1 [x](y)'), 'Sunny \\@Otter\\_1 \\[x\\]\\(y\\)');
  // The player heard both answers; the workers said so on the island, naming nobody.
  assert.deepEqual(
    tablet.news().map((n) => n.wish.state),
    ['accepted', 'declined'],
  );
  assert.equal(said.length, 2);
  assert.ok(said.every(([, text]) => !/Sunny|Otter/.test(text)));

  // Next time, the one that waited is read.
  fail = false;
  await company.reviewWishes();
  assert.equal((await keeper.store.wishes()).find((w) => w.id === later.id).state, 'declined');
  assert.equal((await keeper.store.wishes()).find((w) => w.id === later.id).score, null, 'no score given');

  // From then on the player hears each step their idea takes on GitHub, once
  // each, and only forward: picked, built, checked, in the game.
  const steps = () => tablet.news().filter((n) => n.wish.id === yes.id && n.wish.stage).map((n) => n.wish.stage);
  const issue = (labels, closed = false, completed = false) => github.issues.set(41, { number: 41, labels, closed, completed });
  issue([LABELS.proposal, LABELS.request]);
  await company.followWishes();
  assert.deepEqual(steps(), ['proposed']);
  issue([LABELS.task, LABELS.approved, LABELS.request]);
  await company.followWishes();
  await company.followWishes();
  issue([LABELS.task, LABELS.approved, LABELS.request, LABELS.working]);
  await company.followWishes();
  // Between two tries, a moment without "working": not told as picked again.
  issue([LABELS.task, LABELS.approved, LABELS.request]);
  await company.followWishes();
  issue([LABELS.task, LABELS.approved, LABELS.request, LABELS.stuck]);
  await company.followWishes();
  issue([LABELS.task, LABELS.approved, LABELS.request, LABELS.working]);
  await company.followWishes();
  issue([LABELS.task, LABELS.approved, LABELS.request, LABELS.pr]);
  await company.followWishes();
  issue([LABELS.task, LABELS.approved, LABELS.request, LABELS.pr], true, true);
  await company.followWishes();
  assert.deepEqual(steps(), ['proposed', 'approved', 'building', 'stuck', 'building', 'checking', 'done']);
  // Done with, it is not looked up again.
  let asks = 0;
  github.requests = async () => (asks++, []);
  await company.followWishes();
  assert.equal(asks, 0);

  // Turned down on GitHub: not picked.
  assert.equal(stageOf({ closed: true, completed: false, labels: [LABELS.proposal] }), 'dropped');
  assert.equal(newsOf('proposed', 'dropped'), true);
  assert.equal(newsOf('done', 'dropped'), false);
});
