// Extra-credit quizzes: a stage of Adventure Isle conquered offers everyone who
// freed it quizzes for extra credit — at elementary school second-year and
// third-year level, middle school third-year level and high school
// first-year level, a thinking-math one of puzzles to work out and English
// Words — each a few questions picked and shuffled out of a bank of them,
// with the right answer never where it was written; coins for the answers
// got right, and the counts and stickers they earn. A question answered
// right three times in a row is learnt, and never asked again.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { XP_FOR } from '../public/js/shared/levels.js';
import { cleanQuizBook, fileQuizAnswer, isLearnt, LEARNT_AFTER, makeQuiz, QUESTION_BANKS, QUIZ_LEVELS, QUIZ_SIZE, quizCoins, quizProgress } from '../public/js/shared/quiz.js';
import { STAT_KEYS, STICKERS } from '../public/js/shared/stickers.js';

test('six quizzes, from elementary school to high school, each with questions to spare', () => {
  assert.deepEqual(Object.keys(QUIZ_LEVELS), ['junior', 'elementary3', 'senior', 'high1', 'thinker', 'english']);
  assert.deepEqual(
    Object.values(QUIZ_LEVELS).map((l) => l.name),
    ['Elementary School Year 2', 'Elementary School Year 3', 'Middle School Year 3', 'High School Year 1', 'Thinking Math', 'English Words'],
  );
  for (const [key, def] of Object.entries(QUIZ_LEVELS)) {
    assert.equal(def.key, key);
    assert.ok(def.icon && def.name && def.how && def.color, `${key} says what it is`);
    const bank = QUESTION_BANKS[key];
    assert.ok(bank.length > QUIZ_SIZE, `${key} has more questions than a quiz asks`);
    const asked = new Set();
    for (const { q, a, pic } of bank) {
      assert.equal(typeof q, 'string');
      assert.ok(q.trim().length > 0, 'a question in words');
      const answers = key === 'english' ? 3 : 4;
      assert.equal(a.length, answers, `${answers} answers to pick from`);
      assert.equal(new Set(a).size, answers, 'no two answers alike');
      assert.ok(a.every((answer) => typeof answer === 'string' && answer.trim().length > 0), 'answers in words');
      if (pic !== undefined) {
        assert.ok(Array.isArray(pic) && pic.length > 0, 'a picture has rows');
        assert.ok(pic.every((row) => typeof row === 'string' && row.trim().length > 0), 'each row has tiles');
      }
      assert.ok(!asked.has(q), 'no question twice');
      asked.add(q);
    }
  }
  // The quizzes ask different things, but for the dictionary's, which may
  // ask what another does (a spider's legs).
  const all = Object.entries(QUESTION_BANKS).flatMap(([key, bank]) => (key === 'english' ? [] : bank.map((b) => b.q)));
  assert.equal(new Set(all).size, all.length, 'each bank its own');
  // Each quiz's own button colour, and none the green of Done.
  const colors = Object.values(QUIZ_LEVELS).map((l) => l.color);
  assert.equal(new Set(colors).size, colors.length);
  assert.ok(!colors.includes('green'));
  // The new years with banks as big as the others, or bigger: learnt
  // questions go, so a bank wants plenty.
  for (const key of ['elementary3', 'high1']) assert.ok(QUESTION_BANKS[key].length >= 40, `${key} has plenty of questions`);
});

test('the sums in the Year 3 and high school banks come out right', () => {
  const answer = (key, q) => QUESTION_BANKS[key].find((b) => b.q === q).a[0];
  assert.equal(answer('elementary3', 'What is 356 + 278?'), String(356 + 278));
  assert.equal(answer('elementary3', 'What is 503 − 248?'), String(503 - 248));
  assert.equal(answer('elementary3', 'What is 24 × 3?'), String(24 * 3));
  assert.equal(answer('elementary3', 'What is 56 ÷ 7?'), String(56 / 7));
  assert.equal(answer('elementary3', 'What is 72 ÷ 3?'), String(72 / 3));
  assert.equal(answer('elementary3', 'What is 125 × 4?'), String(125 * 4));
  assert.equal(answer('elementary3', 'What is 23 × 12?'), String(23 * 12));
  assert.equal(answer('elementary3', 'What is the remainder when 17 is divided by 5?'), String(17 % 5));
  assert.equal(answer('elementary3', 'A box holds 6 eggs. How many eggs are in 15 boxes?'), String(6 * 15));
  assert.equal(answer('elementary3', '48 candies are shared equally among 6 children. How many does each child get?'), String(48 / 6));
  // Quadratics: roots that multiply to c, and the discriminant.
  const roots = (a, b, c) => [(-b + Math.sqrt(b * b - 4 * a * c)) / (2 * a), (-b - Math.sqrt(b * b - 4 * a * c)) / (2 * a)];
  assert.equal(answer('high1', 'The two roots of x² − 7x + 10 = 0 multiply to…'), String(roots(1, -7, 10).reduce((p, r) => p * r, 1)));
  assert.equal(answer('high1', 'For which k does x² + 4x + k = 0 have just one root, a double root?'), String(4 ** 2 / 4));
  const f = (x) => x ** 3 - 2 * x + 5;
  assert.equal(answer('high1', 'What is the remainder when x³ − 2x + 5 is divided by x − 1?'), String(f(1)));
  assert.equal(answer('high1', 'In how many ways can 4 runners come first, second and third?'), String(4 * 3 * 2));
  assert.equal(answer('high1', 'In how many ways can you choose 2 of 5 students, if the order does not matter?'), String((5 * 4) / 2));
  assert.equal(answer('high1', 'What is 5! (5 factorial)?'), String(5 * 4 * 3 * 2 * 1));
  assert.equal(answer('high1', 'How many subsets does the set {a, b, c} have?'), String(2 ** 3));
  assert.equal(answer('high1', 'How far apart are the points (1, 2) and (4, 6)?'), String(Math.hypot(4 - 1, 6 - 2)));
  assert.equal(answer('high1', 'f(x) = 2x + 1 and g(x) = x². What is f(g(3))?'), String(2 * 3 ** 2 + 1));
  assert.equal(answer('high1', 'A 2 kg cart is pushed with a force of 10 N. What is its acceleration?'), `${10 / 2} m/s²`);
  assert.equal(answer('high1', 'What is the momentum of a 3 kg ball moving at 4 m/s?'), `${3 * 4} kg·m/s`);
});

test('a quiz asks its bank’s questions, the right answer somewhere among the answers', () => {
  for (const level of Object.keys(QUIZ_LEVELS)) {
    const quiz = makeQuiz(level, 123);
    assert.equal(quiz.level, level);
    assert.equal(quiz.questions.length, QUIZ_SIZE);
    const asked = new Set();
    for (const ask of quiz.questions) {
      const n = level === 'english' ? 3 : 4;
      assert.equal(ask.choices.length, n);
      assert.equal(new Set(ask.choices).size, n);
      assert.ok(Number.isInteger(ask.answer) && ask.answer >= 0 && ask.answer < n, 'the right answer is one of them');
      const bank = QUESTION_BANKS[level].find((b) => b.q === ask.q);
      assert.ok(bank, `a question of the ${level} bank`);
      assert.equal(ask.choices[ask.answer], bank.a[0], 'where it says the right answer is, there it is');
      for (const choice of ask.choices) assert.ok(bank.a.includes(choice), 'no answer made up');
      assert.ok(!asked.has(ask.q), 'no question twice in one quiz');
      asked.add(ask.q);
    }
  }
});

test('a puzzle with a picture keeps its picture in the quiz', () => {
  const withPics = QUESTION_BANKS.thinker.filter((b) => b.pic);
  assert.ok(withPics.length >= 10, 'plenty of picture puzzles');
  const quiz = makeQuiz('thinker', 5, QUESTION_BANKS.thinker.length);
  for (const ask of quiz.questions) assert.deepEqual(ask.pic, QUESTION_BANKS.thinker.find((b) => b.q === ask.q).pic);
});

test('the same seed asks the same quiz, and a different seed a different one', () => {
  assert.deepEqual(makeQuiz('junior', 7), makeQuiz('junior', 7));
  assert.notDeepEqual(makeQuiz('junior', 7), makeQuiz('junior', 8));
  assert.notDeepEqual(makeQuiz('junior', 7), makeQuiz('senior', 7));
});

test('a level that is not one asks nothing', () => {
  assert.deepEqual(makeQuiz('nonsense', 1), { level: 'nonsense', questions: [] });
  assert.deepEqual(makeQuiz(undefined, 1), { level: undefined, questions: [] });
});

test('every answer right pays a coin, two on the middle school and thinking-math quizzes, and three on the high school one', () => {
  assert.equal(quizCoins(0, 'junior'), 0);
  assert.equal(quizCoins(3, 'junior'), 3);
  assert.equal(quizCoins(3, 'senior'), 6);
  assert.equal(quizCoins(5, 'senior'), 10);
  assert.equal(quizCoins(0, 'senior'), 0);
  assert.equal(quizCoins(-2, 'junior'), 0);
  assert.equal(quizCoins(NaN, 'senior'), 0);
  assert.equal(quizCoins(3, 'thinker'), 6);
  assert.equal(quizCoins(3, 'english'), 3);
  assert.equal(quizCoins(1, 'elementary3'), 1);
  assert.equal(quizCoins(1, 'high1'), 3);
  assert.equal(quizCoins(3, 'high1'), 9);
});

test('a question answered right three times in a row is learnt, and a wrong answer starts it over', () => {
  assert.equal(LEARNT_AFTER, 3);
  const [first, second] = QUESTION_BANKS.junior;
  const book = cleanQuizBook({});
  assert.equal(fileQuizAnswer(book, 'junior', first.q, true), false);
  assert.equal(fileQuizAnswer(book, 'junior', first.q, true), false);
  assert.equal(book.junior[first.q], 2);
  // A miss in between: back to none, and three more in a row to learn it.
  assert.equal(fileQuizAnswer(book, 'junior', first.q, false), false);
  assert.ok(!(first.q in book.junior), 'a miss starts it over');
  assert.equal(fileQuizAnswer(book, 'junior', first.q, true), false);
  assert.equal(fileQuizAnswer(book, 'junior', first.q, true), false);
  assert.equal(isLearnt(book, 'junior', first.q), false);
  assert.equal(fileQuizAnswer(book, 'junior', first.q, true), true, 'the third in a row learns it');
  assert.equal(isLearnt(book, 'junior', first.q), true);
  // Learnt stays learnt: it is never asked again, so nothing undoes it.
  assert.equal(fileQuizAnswer(book, 'junior', first.q, false), false);
  assert.equal(fileQuizAnswer(book, 'junior', first.q, true), false);
  assert.equal(isLearnt(book, 'junior', first.q), true);
  // Each question on its own, and each quiz too: the same words in another
  // quiz's bank, or no bank's at all, are not filed.
  assert.equal(isLearnt(book, 'junior', second.q), false);
  assert.equal(isLearnt(book, 'senior', first.q), false);
  assert.equal(fileQuizAnswer(book, 'junior', 'What is the meaning of life?', true), false);
  assert.equal(fileQuizAnswer(book, 'nonsense', first.q, true), false);
  assert.deepEqual(quizProgress(book, 'junior'), { learnt: 1, left: QUESTION_BANKS.junior.length - 1, total: QUESTION_BANKS.junior.length });
});

test('a quiz never asks a question you have learnt, and asks nothing once you have learnt them all', () => {
  for (const level of Object.keys(QUIZ_LEVELS)) {
    const bank = QUESTION_BANKS[level];
    const book = cleanQuizBook({});
    // All but two learnt: those two are all that is asked, however many
    // are wanted.
    for (const { q } of bank.slice(2)) book[level][q] = LEARNT_AFTER;
    for (let seed = 1; seed <= 20; seed++) {
      const quiz = makeQuiz(level, seed, 3, book);
      assert.deepEqual(quiz.questions.map((ask) => ask.q).sort(), [bank[0].q, bank[1].q].sort(), `${level}: only the questions left`);
    }
    assert.equal(makeQuiz(level, 4, 1, book).questions.length, 1);
    assert.deepEqual(quizProgress(book, level), { learnt: bank.length - 2, left: 2, total: bank.length });
    // A question on its way to learnt is still asked.
    book[level][bank[0].q] = LEARNT_AFTER - 1;
    assert.ok(makeQuiz(level, 2, 3, book).questions.some((ask) => ask.q === bank[0].q));
    // All learnt: nothing left to ask.
    for (const { q } of bank) book[level][q] = LEARNT_AFTER;
    assert.deepEqual(makeQuiz(level, 9, 3, book).questions, []);
    assert.equal(quizProgress(book, level).left, 0);
  }
  // Without a book, or with an empty one, every question as before.
  assert.deepEqual(makeQuiz('senior', 7, 3, cleanQuizBook({})), makeQuiz('senior', 7, 3));
});

test('a quiz book kept on a device is tidied: only real questions of real quizzes, counted right', () => {
  const [a, b, c] = QUESTION_BANKS.high1;
  const kept = {
    high1: { [a.q]: 2, [b.q]: 7, [c.q]: 0, 'A question nobody asks': 3 },
    junior: { [QUESTION_BANKS.junior[0].q]: 1.5, [QUESTION_BANKS.junior[1].q]: 'lots' },
    senior: 'nonsense',
    hard: { [a.q]: 3 },
  };
  const book = cleanQuizBook(kept);
  assert.deepEqual(Object.keys(book), Object.keys(QUIZ_LEVELS), 'a page for every quiz');
  assert.deepEqual(book.high1, { [a.q]: 2, [b.q]: LEARNT_AFTER });
  assert.deepEqual(book.junior, {});
  assert.deepEqual(book.senior, {});
  for (const raw of [null, undefined, 'x', 5, []]) assert.deepEqual(cleanQuizBook(raw), Object.fromEntries(Object.keys(QUIZ_LEVELS).map((k) => [k, {}])));
});

test('the quizzes are counted, and earn their XP and stickers', () => {
  for (const key of ['quizzes', 'quizright', 'quizperfect']) {
    assert.ok(STAT_KEYS.includes(key), `${key} is counted`);
    assert.ok(XP_FOR[key]?.xp > 0, `${key} earns XP`);
  }
  const zero = Object.fromEntries(STAT_KEYS.map((k) => [k, 0]));
  const whiz = STICKERS.find((s) => s.key === 'quiz-whiz');
  const perfect = STICKERS.find((s) => s.key === 'quiz-perfect');
  assert.ok(whiz && perfect, 'a sticker for each');
  assert.equal(whiz.test({ ...zero, quizzes: 1 }), true);
  assert.equal(whiz.test(zero), false);
  assert.equal(perfect.test({ ...zero, quizperfect: 1 }), true);
  assert.equal(perfect.test({ ...zero, quizzes: 5, quizright: 25 }), false, 'only a perfect quiz');
});

test('English Words asks the Kids Dictionary’s quizzes, each about its word', async () => {
  const { readWord } = await import('../scripts/dictionary.mjs');
  const page = ['# 🍎 apple', '', '## 한국어 뜻', '', '**사과**', '', '## Quiz', '', '1. What is an apple?', '   - an animal', '   - a fruit', '   - a color', '', '<details>', '<summary>Answers · 정답</summary>', '', '1. a fruit', '', '</details>'].join('\n');
  assert.deepEqual(readWord(page), { word: 'apple', emoji: '🍎', ko: '사과', quiz: [{ q: 'What is an apple?', a: ['a fruit', 'an animal', 'a color'] }] });
  assert.equal(readWord(page.replace('🍎 ', '')).emoji, '');
  assert.throws(() => readWord(page.replace('1. a fruit', '1. a tree')), /not one of the answers/);
  assert.throws(() => readWord(page.replace('**사과**', '사과')), /Korean meaning/);

  const apple = QUESTION_BANKS.english.find((b) => b.q === 'What is an apple?');
  assert.deepEqual(apple.word, { word: 'apple', emoji: '🍎', ko: '사과' });
  assert.equal(apple.a[0], 'a fruit');
  const quiz = makeQuiz('english', 9, QUESTION_BANKS.english.length);
  for (const ask of quiz.questions) assert.ok(ask.word?.word && ask.word.ko, 'each question says its word');
  assert.ok(makeQuiz('junior', 9).questions.every((ask) => !ask.word), 'only English Words has words');
});
