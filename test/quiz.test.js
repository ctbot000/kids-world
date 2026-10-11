// Extra-credit quizzes: an adventure island conquered offers everyone who
// freed it two quizzes for extra credit — one at elementary school
// second-year level, one at middle school third-year level — each a few
// questions picked and shuffled out of a bank of them, with the right answer
// never where it was written; coins for the answers got right, and the
// counts and stickers they earn.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { XP_FOR } from '../public/js/shared/levels.js';
import { makeQuiz, QUESTION_BANKS, QUIZ_LEVELS, QUIZ_SIZE, quizCoins } from '../public/js/shared/quiz.js';
import { STAT_KEYS, STICKERS } from '../public/js/shared/stickers.js';

test('two quizzes, one for each school level, each with questions to spare', () => {
  assert.deepEqual(Object.keys(QUIZ_LEVELS), ['junior', 'senior']);
  for (const [key, def] of Object.entries(QUIZ_LEVELS)) {
    assert.ok(def.icon && def.name && def.how, `${key} says what it is`);
    const bank = QUESTION_BANKS[key];
    assert.ok(bank.length > QUIZ_SIZE, `${key} has more questions than a quiz asks`);
    const asked = new Set();
    for (const { q, a } of bank) {
      assert.equal(typeof q, 'string');
      assert.ok(q.trim().length > 0, 'a question in words');
      assert.equal(a.length, 4, 'four answers to pick from');
      assert.equal(new Set(a).size, 4, 'no two answers alike');
      assert.ok(a.every((answer) => typeof answer === 'string' && answer.trim().length > 0), 'answers in words');
      assert.ok(!asked.has(q), 'no question twice');
      asked.add(q);
    }
  }
  // The two quizzes ask different things.
  for (const { q } of QUESTION_BANKS.junior) assert.ok(!QUESTION_BANKS.senior.some((o) => o.q === q), 'each bank its own');
});

test('a quiz asks its bank’s questions, the right answer somewhere among the answers', () => {
  for (const level of Object.keys(QUIZ_LEVELS)) {
    const quiz = makeQuiz(level, 123);
    assert.equal(quiz.level, level);
    assert.equal(quiz.questions.length, QUIZ_SIZE);
    const asked = new Set();
    for (const ask of quiz.questions) {
      assert.equal(ask.choices.length, 4);
      assert.equal(new Set(ask.choices).size, 4);
      assert.ok(Number.isInteger(ask.answer) && ask.answer >= 0 && ask.answer < 4, 'the right answer is one of the four');
      const bank = QUESTION_BANKS[level].find((b) => b.q === ask.q);
      assert.ok(bank, `a question of the ${level} bank`);
      assert.equal(ask.choices[ask.answer], bank.a[0], 'where it says the right answer is, there it is');
      for (const choice of ask.choices) assert.ok(bank.a.includes(choice), 'no answer made up');
      assert.ok(!asked.has(ask.q), 'no question twice in one quiz');
      asked.add(ask.q);
    }
  }
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

test('every answer right pays a coin, or two on the middle school quiz', () => {
  assert.equal(quizCoins(0, 'junior'), 0);
  assert.equal(quizCoins(3, 'junior'), 3);
  assert.equal(quizCoins(3, 'senior'), 6);
  assert.equal(quizCoins(5, 'senior'), 10);
  assert.equal(quizCoins(0, 'senior'), 0);
  assert.equal(quizCoins(-2, 'junior'), 0);
  assert.equal(quizCoins(NaN, 'senior'), 0);
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
