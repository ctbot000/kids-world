// A player's quiz book: each quiz's questions they have been getting right,
// with how many times in a row, and the ones learnt (LEARNT_AFTER times),
// which are never asked of them again:
//   { [quiz's key]: { [question, as quiz.js questionKey]: times right in a row } }
// The island keeper keeps it, one for each player with a login, the same on
// all their devices (server/keeper.js): a page sends each answer as it is
// given, and the keeper files it and says what the book has now. A page
// keeps none of it but in memory (js/quizbook.js). This is what the two
// agree on:
//   page → keeper   { t: 'quizbook', book? }   → { t: 'quizbook', book }
//                   (book: one this device kept of its own, from when each
//                    device did, to be put together with the player's)
//                   { t: 'quiz', answers }     → { t: 'kept', what: 'quiz', changes }
//   keeper → page   { t: 'quiz-news', changes }   (unasked: what another of
//                   the player's pages filed, to a page that said quiz: true)
// answers: [{ id, level, q, right }], changes: [{ level, q, n }] (n: how many
// times in a row now).
//
// Here a book is checked for its shape and size only, not against the
// quizzes' questions, so that a keeper running older code keeps the questions
// of a newer game: each page leaves out those its own game does not ask
// (quiz.js cleanQuizBook).

// How many times in a row a question must be answered right to be learnt:
// after that it is never asked of you again.
export const LEARNT_AFTER = 3;

// Plenty of room past the game's own quizzes and questions (about a thousand,
// 53 KB of book with every one learnt), while a made-up book stays small.
const QUIZZES_MAX = 100;
const QUESTIONS_MAX = 2000;
const QUESTION_MAX = 1000;
export const QUIZ_BOOK_MAX = 512 * 1024;
// The most answers one message brings.
export const ANSWERS_MAX = 50;

const isLevel = (v) => typeof v === 'string' && /^[a-z][a-z0-9-]{0,31}$/i.test(v);
const isQuestion = (v) => typeof v === 'string' && v.length > 0 && v.length <= QUESTION_MAX;
// What tells one answer from every other, so that one sent again is not
// counted again: 8 random bytes.
const isAnswerId = (v) => typeof v === 'string' && /^[0-9a-f]{16}$/.test(v);

// Only what is really in it: never what every object has ("constructor").
const own = (o, key) => (Object.hasOwn(o, key) ? o[key] : undefined);

// A book as it was kept or sent, made safe (and a copy of it).
export function keptQuizBook(raw) {
  const book = {};
  if (!raw || typeof raw !== 'object') return book;
  for (const [level, page] of Object.entries(raw).slice(0, QUIZZES_MAX)) {
    if (!isLevel(level) || !page || typeof page !== 'object') continue;
    const right = Object.entries(page).filter(([q, n]) => isQuestion(q) && Number.isInteger(n) && n >= 1);
    if (right.length) book[level] = Object.fromEntries(right.slice(0, QUESTIONS_MAX).map(([q, n]) => [q, Math.min(n, LEARNT_AFTER)]));
  }
  return book;
}

// How many times in a row a question has been answered right.
export const timesRight = (book, level, q) => own(own(book ?? {}, level) ?? {}, q) ?? 0;

export function setTimesRight(book, level, q, n) {
  if (n > 0) {
    if (!own(book, level)) book[level] = {};
    book[level][q] = n;
  } else if (own(book, level)) delete book[level][q];
}

// Whether a question is learnt, never to be asked again.
export const isLearnt = (book, level, q) => timesRight(book, level, q) >= LEARNT_AFTER;

// An answer filed in a book: one more time right in a row, or, got wrong,
// back to none; a question learnt stays learnt. Returns true when it was the
// answer that learnt the question.
export function fileAnswer(book, level, q, right) {
  if (isLearnt(book, level, q)) return false;
  setTimesRight(book, level, q, right ? timesRight(book, level, q) + 1 : 0);
  return isLearnt(book, level, q);
}

// Another book put together with this one, each question as whichever has it
// right more times. Returns the changes that made here (so none, the second
// time round).
export function joinQuizBook(book, other) {
  const changes = [];
  for (const [level, page] of Object.entries(keptQuizBook(other))) {
    for (const [q, n] of Object.entries(page)) {
      if (n <= timesRight(book, level, q)) continue;
      setTimesRight(book, level, q, n);
      changes.push({ level, q, n });
    }
  }
  return changes;
}

// Answers, and changes, as they were sent (or have been waiting), made safe.
export function cleanAnswers(raw, max = ANSWERS_MAX) {
  return (Array.isArray(raw) ? raw : [])
    .filter((a) => a && isAnswerId(a.id) && isLevel(a.level) && isQuestion(a.q))
    .slice(0, max)
    .map(({ id, level, q, right }) => ({ id, level, q, right: right === true }));
}

export function cleanChanges(raw) {
  return (Array.isArray(raw) ? raw : []).filter((c) => c && isLevel(c.level) && isQuestion(c.q) && Number.isInteger(c.n) && c.n >= 0).map(({ level, q, n }) => ({ level, q, n: Math.min(n, LEARNT_AFTER) }));
}
