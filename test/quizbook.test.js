// Quiz books (shared/quizbook.js), kept by the keeper for each player with a
// login: what makes a book safe to keep, answers filed on disk and each once,
// a device's own book from before put together with it, the protocol driven
// without WebRTC (and what one of a player's pages files reaching the others),
// and the book on a page (js/quizbook.js), which leaves nothing on the device
// but what the keeper does not have yet. Real pages are in e2e.test.js.
import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, test } from 'node:test';
import { Reassembler, sendText } from '../public/js/shared/framing.js';
import { KEEPER_VERSION, randomHex } from '../public/js/shared/keeper.js';
import { QUESTION_BANKS, questionKey } from '../public/js/shared/quiz.js';
import { ANSWERS_MAX, cleanAnswers, cleanChanges, fileAnswer, isLearnt, joinQuizBook, keptQuizBook, LEARNT_AFTER, QUIZ_BOOK_MAX, timesRight } from '../public/js/shared/quizbook.js';
import { createIdentity, KeepError, Keeper, KeeperStore } from '../server/keeper.js';

const dirs = [];
async function tempDir() {
  const dir = await mkdtemp(join(tmpdir(), 'kids-world-quizbook-'));
  dirs.push(dir);
  return dir;
}
after(() => Promise.all(dirs.map((dir) => rm(dir, { recursive: true, force: true }))));

const TABLET = 'a1'.repeat(16);
const PHONE = 'b2'.repeat(16);
const SISTER = 'c3'.repeat(16);
const PASSWORD = 'rocket-apple7';
const [APPLE, BEAR, CAT] = QUESTION_BANKS.junior.map(questionKey);
const answer = (level, q, right = true) => ({ id: randomHex(8), level, q, right });
const refused = (promise, code) => assert.rejects(promise, (e) => e instanceof KeepError && e.code === code);

test('a quiz book is checked for its shape and size, not against the quizzes: a newer game’s questions stay in it', () => {
  const raw = {
    junior: { [APPLE]: 2, [BEAR]: 9, [CAT]: 0, '': 3, 'half': 1.5, 'lots': 'three', ['x'.repeat(1001)]: 3 },
    'a-quiz-to-come': { 'A question to come?': 1 },
    empty: {},
    list: ['x'],
    'no such name!': { [APPLE]: 3 },
    senior: 'nonsense',
  };
  const book = keptQuizBook(raw);
  assert.deepEqual(book, { junior: { [APPLE]: 2, [BEAR]: LEARNT_AFTER }, 'a-quiz-to-come': { 'A question to come?': 1 } });
  book.junior[APPLE] = 3;
  assert.equal(raw.junior[APPLE], 2, 'a copy');
  for (const nothing of [null, undefined, 'x', 5, []]) assert.deepEqual(keptQuizBook(nothing), {});
  // However much is sent, so much is kept.
  const huge = Object.fromEntries(Array.from({ length: 300 }, (_, i) => [`quiz${i}`, Object.fromEntries(Array.from({ length: i ? 1 : 3000 }, (_, n) => [`Question ${n}`, 1]))]));
  assert.equal(Object.keys(keptQuizBook(huge)).length, 100);
  assert.equal(Object.keys(keptQuizBook(huge).quiz0).length, 2000);

  assert.deepEqual(cleanAnswers([{ id: '0123456789abcdef', level: 'junior', q: APPLE, right: true, extra: 1 }, { id: 'nope', level: 'junior', q: APPLE, right: true }, { id: '0123456789abcdef', level: '__proto__', q: APPLE, right: true }, { id: '0123456789abcdef', level: 'junior', q: BEAR, right: 'yes' }, null]), [
    { id: '0123456789abcdef', level: 'junior', q: APPLE, right: true },
    { id: '0123456789abcdef', level: 'junior', q: BEAR, right: false },
  ]);
  assert.equal(cleanAnswers(Array.from({ length: 200 }, () => answer('junior', APPLE))).length, ANSWERS_MAX);
  assert.deepEqual(cleanAnswers('x'), []);
  assert.deepEqual(cleanChanges([{ level: 'junior', q: APPLE, n: 8 }, { level: 'junior', q: BEAR, n: 0 }, { level: 'junior', q: CAT, n: -1 }, { level: 'junior', q: CAT }, 5]), [
    { level: 'junior', q: APPLE, n: LEARNT_AFTER },
    { level: 'junior', q: BEAR, n: 0 },
  ]);
});

test('names every object has are only names in a quiz book', () => {
  const book = keptQuizBook(JSON.parse('{"__proto__": {"a": 3}, "constructor": {"b": 2}, "junior": {"toString": 1}}'));
  assert.equal(timesRight(book, 'constructor', 'b'), 2);
  assert.equal(timesRight(book, 'junior', 'toString'), 1);
  assert.equal(timesRight(book, 'junior', 'valueOf'), 0);
  assert.equal(timesRight({}, 'toString', 'length'), 0);
  assert.equal(isLearnt(null, 'junior', APPLE), false);
  const fresh = {};
  for (const level of ['constructor', 'toString']) fileAnswer(fresh, level, 'polluted', true);
  fileAnswer(fresh, 'junior', '__proto__', true);
  assert.equal({}.polluted, undefined);
  assert.equal(Object.polluted, undefined);
  assert.equal({}.toString.polluted, undefined);
  assert.equal(fresh.constructor.polluted, 1);
});

test('two quiz books put together have each question as whichever had it right more times', () => {
  const book = { junior: { [APPLE]: 1, [BEAR]: 3 } };
  const other = { junior: { [APPLE]: 2, [BEAR]: 1, [CAT]: 3 }, coding: { 'What does this print?': 1 }, senior: 'nonsense' };
  assert.deepEqual(joinQuizBook(book, other), [
    { level: 'junior', q: APPLE, n: 2 },
    { level: 'junior', q: CAT, n: 3 },
    { level: 'coding', q: 'What does this print?', n: 1 },
  ]);
  assert.deepEqual(book, { junior: { [APPLE]: 2, [BEAR]: 3, [CAT]: 3 }, coding: { 'What does this print?': 1 } });
  assert.deepEqual(joinQuizBook(book, other), [], 'the second time round, nothing more');
  assert.deepEqual(joinQuizBook(book, null), []);
});

test('answers are filed in the player’s quiz book on the keeper’s disk, each once, and stay there over a restart', async () => {
  const dir = await tempDir();
  const store = await new KeeperStore(dir).open();
  const player = KeeperStore.deviceId(TABLET);
  const sister = KeeperStore.deviceId(SISTER);
  await store.makeLogin(player, PASSWORD, { name: 'Sunny Otter' }, { username: 'otter' });
  assert.deepEqual(await store.openQuizBook(player), { book: {}, changes: [] });

  const first = answer('junior', APPLE);
  assert.deepEqual(await store.fileAnswers(player, [first, answer('junior', BEAR, false)]), [
    { level: 'junior', q: APPLE, n: 1 },
    { level: 'junior', q: BEAR, n: 0 },
  ]);
  // Sent again, by a page that never heard it was filed: it counts once.
  assert.deepEqual(await store.fileAnswers(player, [first]), [{ level: 'junior', q: APPLE, n: 1 }]);
  assert.deepEqual(await store.fileAnswers(player, [first, answer('junior', APPLE), answer('junior', APPLE)]), Array(3).fill({ level: 'junior', q: APPLE, n: 3 }));
  // Learnt stays learnt, and a miss starts over one that is not.
  await store.fileAnswers(player, [answer('junior', APPLE, false), answer('junior', CAT), answer('junior', CAT), answer('junior', CAT, false), answer('junior', CAT)]);
  // A question, and a quiz, of a game newer than this keeper.
  await store.fileAnswers(player, [answer('junior', 'A question to come?'), answer('a-quiz-to-come', 'Another?')]);
  const book = { junior: { [APPLE]: 3, [CAT]: 1, 'A question to come?': 1 }, 'a-quiz-to-come': { 'Another?': 1 } };
  assert.deepEqual((await store.openQuizBook(player)).book, book);

  // In a file of its own, so that it is not written with every step they take.
  const kept = JSON.parse(await readFile(join(dir, 'devices', player, 'quizbook.json'), 'utf8'));
  assert.deepEqual(kept.book, book);
  assert.ok(!(await readFile(join(dir, 'devices', player, 'device.json'), 'utf8')).includes('junior'));
  // Another keeper, started on the same folder, has it; another player has none of it.
  const again = await new KeeperStore(dir).open();
  assert.equal(again.bytes, store.bytes, 'counted as what is kept');
  assert.deepEqual((await again.openQuizBook(player)).book, book);
  assert.deepEqual(await again.fileAnswers(player, [first]), [{ level: 'junior', q: APPLE, n: 3 }], 'nor does it count twice after that');
  assert.deepEqual((await again.openQuizBook(sister)).book, {});
  // The answers remembered are the ones filed last, not every one ever.
  for (let i = 0; i < 6; i++) await store.fileAnswers(player, Array.from({ length: ANSWERS_MAX }, () => answer('senior', `Question ${i}`)));
  assert.equal(JSON.parse(await readFile(join(dir, 'devices', player, 'quizbook.json'), 'utf8')).filed.length, 200);

  await refused(store.openQuizBook('../../etc'), 'bad');
  await refused(store.fileAnswers('../../etc', [first]), 'bad');
  assert.deepEqual(await store.fileAnswers(player, 'nonsense'), []);
});

test('a device’s own quiz book from before goes into the player’s, whichever device comes first, and nothing learnt is lost', async () => {
  const store = await new KeeperStore(await tempDir()).open();
  const player = KeeperStore.deviceId(TABLET);
  const tablet = { junior: { [APPLE]: 3, [BEAR]: 1 }, high1: { 'An old question': 2 } };
  const phone = { junior: { [APPLE]: 1, [BEAR]: 2, [CAT]: 3 } };
  const one = await store.openQuizBook(player, tablet);
  assert.deepEqual(one.book, tablet);
  assert.equal(one.changes.length, 3);
  // Asked twice (the page never heard back), it changes nothing.
  assert.deepEqual((await store.openQuizBook(player, tablet)).changes, []);
  const both = await store.openQuizBook(player, phone);
  assert.deepEqual(both.book, { junior: { [APPLE]: 3, [BEAR]: 2, [CAT]: 3 }, high1: { 'An old question': 2 } });
  assert.deepEqual(both.changes, [
    { level: 'junior', q: BEAR, n: 2 },
    { level: 'junior', q: CAT, n: 3 },
  ]);
  for (const nonsense of ['x', 7, [], { junior: 5 }]) assert.deepEqual((await store.openQuizBook(player, nonsense)).changes, []);
});

test('a quiz book that cannot be read is never written over, one too big is refused, and it goes where the player’s copies go', async () => {
  const dir = await tempDir();
  const store = await new KeeperStore(dir).open();
  const player = KeeperStore.deviceId(TABLET);
  const gone = KeeperStore.deviceId(PHONE);
  await store.makeLogin(player, PASSWORD, { name: 'Sunny Otter' }, { username: 'otter' });
  await store.fileAnswers(player, [answer('junior', APPLE), answer('junior', BEAR)]);
  const file = join(dir, 'devices', player, 'quizbook.json');
  const good = await readFile(file, 'utf8');

  await writeFile(file, good.slice(0, 20));
  await assert.rejects(store.openQuizBook(player));
  await assert.rejects(store.fileAnswers(player, [answer('junior', CAT)]));
  assert.equal(await readFile(file, 'utf8'), good.slice(0, 20), 'left as it was, to put right');
  await writeFile(file, good);
  assert.equal(timesRight((await store.openQuizBook(player)).book, 'junior', APPLE), 1);

  // Bigger than any real book: not kept, and what was there is there still.
  const long = (n) => `${n} ${'x'.repeat(900)}`;
  await refused(store.openQuizBook(player, Object.fromEntries(Array.from({ length: 9 }, (_, i) => [`quiz${i}`, Object.fromEntries(Array.from({ length: 100 }, (_, n) => [long(n), 1]))]))), 'full');
  assert.equal(await readFile(file, 'utf8'), good);
  assert.ok(good.length < QUIZ_BOOK_MAX);
  // Nor once the keeper is full.
  store.maxBytes = store.bytes + 10;
  await refused(store.fileAnswers(player, [answer('junior', CAT)]), 'full');
  store.maxBytes = Infinity;

  // A login taken away, and its device's copies moved into another: its quiz
  // book too, or nothing of it while that cannot be read.
  await store.makeLogin(gone, PASSWORD, { name: 'Happy Panda' }, { username: 'panda' });
  await store.fileAnswers(gone, [answer('junior', BEAR), answer('junior', BEAR), answer('junior', CAT)]);
  await store.removeLogin(gone);
  await writeFile(file, good.slice(0, 20));
  await assert.rejects(store.adoptDevice(gone, player));
  assert.ok((await store.devices()).some((d) => d.id === gone), 'still there');
  await writeFile(file, good);
  assert.equal(await store.adoptDevice(gone, player), 0);
  assert.deepEqual((await store.openQuizBook(player)).book, { junior: { [APPLE]: 1, [BEAR]: 2, [CAT]: 1 } });
  // A device that never had one leaves the player's as it is.
  await store.keepProfileIn(gone, { name: 'Happy Panda' });
  await store.adoptDevice(gone, player);
  assert.deepEqual((await store.openQuizBook(player)).book, { junior: { [APPLE]: 1, [BEAR]: 2, [CAT]: 1 } });

  // Deleted from the admin pages with the rest of theirs.
  assert.equal(await store.deleteDevice(player), true);
  assert.deepEqual(await readdir(join(dir, 'devices')), []);
  assert.equal(store.bytes, 0);
});

// A page talking to the keeper, without WebRTC (see login.test.js), as far as
// saying who it is. knows: whether its game knows quiz books.
async function page(keeper, device, login = null, { knows = true } = {}) {
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
  await say({ t: 'hello', v: KEEPER_VERSION, nonce: 'd4'.repeat(16) });
  await say({ t: 'me', device, ...(knows ? { quiz: true } : {}), ...(login ? { login } : {}) });
  return { conn, replies, say, news: () => replies.filter((r) => r.t === 'quiz-news').map((r) => r.changes) };
}

test('the protocol: a logged-in page opens the player’s quiz book and files answers in it, and their other pages hear of it', async () => {
  const dir = await tempDir();
  const store = await new KeeperStore(dir).open();
  const keeper = new Keeper({ store, identity: await createIdentity(dir), log: () => {} });
  await keeper.loadKey();
  const { player, token } = await store.makeLogin(KeeperStore.deviceId(TABLET), PASSWORD, { name: 'Sunny Otter' }, { username: 'otter' });
  const other = await store.makeLogin(KeeperStore.deviceId(SISTER), PASSWORD, { name: 'Happy Panda' }, { username: 'panda' });

  // Not logged in, there is no book to open, nor to file in.
  const guest = await page(keeper, 'e5'.repeat(16));
  assert.equal((await guest.say({ t: 'quizbook', book: { junior: { [APPLE]: 3 } } })).code, 'bad');
  assert.equal((await guest.say({ t: 'quiz', answers: [answer('junior', APPLE)] })).code, 'bad');

  const tablet = await page(keeper, TABLET, { player, token });
  const phone = await page(keeper, PHONE, { player, token: (await store.login('otter', PASSWORD)).token });
  const old = await page(keeper, 'f6'.repeat(16), { player, token: (await store.login('otter', PASSWORD)).token }, { knows: false });
  const sister = await page(keeper, SISTER, { player: other.player, token: other.token });
  assert.deepEqual(await phone.say({ t: 'quizbook' }), { t: 'quizbook', book: {} });
  // The tablet brings the book it kept of its own: the phone hears what is in it.
  assert.deepEqual(await tablet.say({ t: 'quizbook', book: { junior: { [APPLE]: 2 }, nonsense: 5 } }), { t: 'quizbook', book: { junior: { [APPLE]: 2 } } });
  assert.deepEqual(phone.news(), [[{ level: 'junior', q: APPLE, n: 2 }]]);

  // An answer on the phone learns it, for the tablet too.
  const learnt = answer('junior', APPLE);
  assert.deepEqual(await phone.say({ t: 'quiz', answers: [learnt, answer('junior', CAT, false)] }), {
    t: 'kept',
    what: 'quiz',
    changes: [
      { level: 'junior', q: APPLE, n: 3 },
      { level: 'junior', q: CAT, n: 0 },
    ],
  });
  assert.deepEqual(tablet.news(), [
    [
      { level: 'junior', q: APPLE, n: 3 },
      { level: 'junior', q: CAT, n: 0 },
    ],
  ]);
  assert.equal(phone.news().length, 1, 'not back to the page it came from');
  assert.deepEqual(old.news(), [], 'nor to a page whose game does not know quiz books: it would take it for an answer');
  assert.deepEqual(sister.news(), [], 'nor to anyone else');
  assert.deepEqual(await sister.say({ t: 'quizbook' }), { t: 'quizbook', book: {} });
  assert.deepEqual((await tablet.say({ t: 'quizbook' })).book, { junior: { [APPLE]: 3 } });

  // Logged out, a page hears no more, and has no book.
  await tablet.say({ t: 'logout' });
  await phone.say({ t: 'quiz', answers: [answer('junior', BEAR)] });
  assert.equal(tablet.news().length, 1);
  assert.equal((await tablet.say({ t: 'quizbook' })).code, 'bad');
  // Two answers at once from two pages: both are filed.
  const laptop = await page(keeper, 'a7'.repeat(16), { player, token: (await store.login('otter', PASSWORD)).token });
  await Promise.all([phone.say({ t: 'quiz', answers: [answer('junior', BEAR)] }), laptop.say({ t: 'quiz', answers: [answer('junior', BEAR)] })]);
  assert.equal(timesRight((await store.openQuizBook(player)).book, 'junior', BEAR), 3);
  // A page that opens the book just as another files in it ends up with what
  // was filed, whichever came first: in the book, or in the news after it.
  for (let i = 0; i < 20; i++) {
    // (Not slowed down, as a page that asks that often is.)
    for (const p of [phone, laptop]) p.conn.tokens = 20;
    laptop.replies.length = 0;
    const q = `Question ${i}`;
    const both = [() => phone.say({ t: 'quiz', answers: [answer('senior', q)] }), () => laptop.say({ t: 'quizbook' })];
    await Promise.all((i % 2 ? both : both.reverse()).map((go) => go()));
    const opened = laptop.replies.findIndex((r) => r.t === 'quizbook');
    const has = timesRight(laptop.replies[opened].book, 'senior', q) === 1;
    assert.ok(has || laptop.replies.slice(opened + 1).some((r) => r.t === 'quiz-news' && r.changes.some((c) => c.q === q && c.n === 1)), `question ${i}: ${JSON.stringify(laptop.replies.map((r) => r.t))}`);
  }
});

// What a page of a player's has left on the device, under the keys it uses.
function fakeStorage() {
  const store = new Map();
  globalThis.localStorage = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) };
  return store;
}

test('the book on a page: the keeper’s, with what it does not have yet, and nothing else on the device', async () => {
  const store = fakeStorage();
  const prefix = 'kidsworld.@aabbccddeeff00112233.';
  // From when each device kept its own: a question learnt, one nearly.
  store.set(`${prefix}quizbook`, JSON.stringify({ junior: { [APPLE]: 3, [BEAR]: 2 } }));
  const storage = await import('../public/js/storage.js');
  const { QuizBook } = await import('../public/js/quizbook.js');
  try {
    storage.useSpace('aabbccddeeff00112233');
    const said = [];
    const open = () => {
      const book = new QuizBook({ kept: true });
      for (const type of ['answer', 'change']) book.addEventListener(type, () => said.push(type));
      return book;
    };
    const book = open();
    // Until the keeper's has come, what is waiting here for it.
    assert.equal(book.here, false);
    assert.deepEqual(book.pages.junior, { [APPLE]: 3, [BEAR]: 2 });
    assert.deepEqual(book.pages.coding, {}, 'a page for every quiz');
    assert.equal(book.file('junior', BEAR, true), true, 'the answer that learnt it says so');
    assert.equal(book.file('junior', CAT, true), false);
    assert.equal(book.file('junior', APPLE, false), false);
    assert.deepEqual(book.pages.junior, { [APPLE]: 3, [BEAR]: 3, [CAT]: 1 });
    assert.deepEqual(said, ['answer', 'answer'], 'one learnt already has nothing to file');
    assert.deepEqual(book.answers.map(({ level, q, right }) => [level, q, right]), [
      ['junior', BEAR, true],
      ['junior', CAT, true],
    ]);
    assert.equal(new Set(book.answers.map((a) => a.id)).size, 2);
    assert.deepEqual(cleanAnswers(book.answers), book.answers, 'as the keeper takes them');

    // The page reloaded, the keeper still away: they wait here.
    const back = open();
    assert.deepEqual(back.answers, book.answers);
    assert.deepEqual(back.pages, book.pages);
    // The keeper's book comes, with this device's own put in it: that need not wait here any more.
    const { old } = back;
    back.came({ junior: { [APPLE]: 3, [BEAR]: 2 }, senior: { 'An answer from the phone': 2 }, 'a-quiz-to-come': { 'Another?': 3 } }, old);
    assert.equal(back.here, true);
    assert.equal(back.old, null);
    assert.ok(!store.has(`${prefix}quizbook`));
    assert.deepEqual(back.pages.junior, { [APPLE]: 3, [BEAR]: 3, [CAT]: 1 }, 'with the answers on their way to it');
    assert.equal('a-quiz-to-come' in back.pages, false, 'only what this game asks');
    // One of the two is filed; another answer is given meanwhile.
    const [one, two] = back.answers;
    back.file('junior', CAT, true);
    back.filed([one.id, two.id], [{ level: 'junior', q: BEAR, n: 3 }, { level: 'junior', q: CAT, n: 1 }]);
    assert.deepEqual(back.answers.map((a) => a.q), [CAT]);
    assert.deepEqual(back.pages.junior, { [APPLE]: 3, [BEAR]: 3, [CAT]: 2 });
    // The phone files one, and one right here is filed after it.
    back.heard([{ level: 'junior', q: CAT, n: 2 }]);
    assert.equal(back.pages.junior[CAT], 3);
    back.filed([back.answers[0].id], [{ level: 'junior', q: CAT, n: 3 }]);
    assert.deepEqual(back.pages.junior, { [APPLE]: 3, [BEAR]: 3, [CAT]: 3 });
    // A miss on the phone starts a question over here.
    back.heard([{ level: 'thinker', q: questionKey(QUESTION_BANKS.thinker[0]), n: 2 }]);
    back.heard([{ level: 'thinker', q: questionKey(QUESTION_BANKS.thinker[0]), n: 0 }]);
    assert.deepEqual(back.pages.thinker, {});
    assert.ok(said.includes('change'));
    // Nothing of it is left on the device now.
    assert.deepEqual([...store.keys()], []);

    // The next page knows nothing of it until the keeper's has come, whatever it hears before.
    const next = open();
    assert.equal(next.here, false);
    next.heard([{ level: 'junior', q: APPLE, n: 1 }]);
    assert.equal(next.here, false);
    assert.deepEqual(next.pages.junior, {});
    next.came({ junior: { [APPLE]: 3 } });
    assert.deepEqual(next.pages.junior, { [APPLE]: 3 });
    // What came spoilt is nothing worse than an empty book.
    next.came('nonsense');
    assert.deepEqual(next.pages.junior, {});
  } finally {
    storage.useSpace(null);
    delete globalThis.localStorage;
  }
});

test('with no login there is no keeper to keep it: the book is for this visit, and leaves nothing on the device', async () => {
  const store = fakeStorage();
  store.set('kidsworld.quizanswers', '[]');
  const { QuizBook } = await import('../public/js/quizbook.js');
  try {
    const book = new QuizBook();
    assert.equal(book.here, true);
    let said = 0;
    book.addEventListener('answer', () => said++);
    for (let i = 1; i < LEARNT_AFTER; i++) assert.equal(book.file('junior', APPLE, true), false);
    assert.equal(book.file('junior', BEAR, true), false);
    assert.equal(book.file('junior', BEAR, false), false);
    assert.equal(book.file('junior', APPLE, true), true);
    assert.deepEqual(book.pages.junior, { [APPLE]: LEARNT_AFTER });
    assert.equal(said, 0, 'nothing for a keeper');
    assert.deepEqual([...store.keys()], ['kidsworld.quizanswers'], 'nothing written');
    assert.deepEqual(new QuizBook().pages.junior, {});
  } finally {
    delete globalThis.localStorage;
  }
});
