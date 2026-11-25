// Your quiz book on this page (what it is made of: shared/quizbook.js). The
// island keeper keeps it, not this device: the page brings it here as it
// reaches the keeper (keeper.js), has it in memory only, and sends each
// answer as it is given for the keeper to file, so it is one book on all your
// devices, and what one files the others hear of at once.
//
// All there ever is of it on the device is what the keeper does not have yet:
// answers given while it is away ('quizanswers'), and a book from when each
// device kept one of its own ('quizbook'), each until the keeper says it has
// it. Until the book has come (a page opened while the keeper is away), it is
// what is waiting here, so a question learnt may come up again: the quizzes
// wait for nobody. Not logged in, there is no keeper to keep it, and the book
// is for this visit alone.
import { randomHex } from './shared/keeper.js';
import { cleanQuizBook } from './shared/quiz.js';
import { cleanAnswers, cleanChanges, fileAnswer, isLearnt, joinQuizBook, keptQuizBook, setTimesRight } from './shared/quizbook.js';
import { load, remove, save } from './storage.js';

// Answers waiting for the keeper, at most: the oldest go first.
const WAITING_MAX = 2000;

// Says 'answer' when there is one for the keeper, and 'change' when the book
// is another than it was: as it comes, or as something is filed elsewhere.
export class QuizBook extends EventTarget {
  // kept: whether the keeper keeps it (logged in).
  constructor({ kept = false } = {}) {
    super();
    this.kept = kept;
    // The keeper's book as last heard, or null until it has come.
    this.book = kept ? null : {};
    const old = keptQuizBook(kept ? load('quizbook', null) : null);
    // The one this device kept of its own before, while the keeper lacks it.
    this.old = Object.keys(old).length ? old : null;
    this.answers = kept ? cleanAnswers(load('quizanswers', []), WAITING_MAX) : [];
    this.work();
  }

  // Whether the book has come, and so knows what you have learnt.
  get here() {
    return this.book !== null;
  }

  // Works the pages out: the keeper's book, with what it does not have yet,
  // as this game's quizzes have it ({ [quiz's key]: { [question]: times right
  // in a row } }).
  work() {
    const book = keptQuizBook(this.book);
    joinQuizBook(book, this.old);
    for (const { level, q, right } of this.answers) fileAnswer(book, level, q, right);
    this.pages = cleanQuizBook(book);
  }

  // An answer you gave, filed. Returns true when it was the one that learnt
  // the question (one learnt already stays so: there is nothing to file).
  file(level, q, right) {
    if (isLearnt(this.pages, level, q)) return false;
    if (this.kept) {
      this.answers = [...this.answers, { id: randomHex(8), level, q, right }].slice(-WAITING_MAX);
      this.storeAnswers();
    } else fileAnswer(this.book, level, q, right);
    this.work();
    if (this.kept) this.dispatchEvent(new CustomEvent('answer'));
    return isLearnt(this.pages, level, q);
  }

  // The book, come from the keeper. old: the one of this device's own it was
  // asked to put in it, which need not wait here any more.
  came(raw, old = null) {
    this.book = keptQuizBook(raw);
    if (old && old === this.old) {
      this.old = null;
      remove('quizbook');
    }
    this.changed();
  }

  // Answers the keeper has filed, by their ids, and what the book has of
  // those questions now.
  filed(ids, changes) {
    this.answers = this.answers.filter((a) => !ids.includes(a.id));
    this.storeAnswers();
    this.heard(changes);
  }

  // What the book has of some questions now, filed here or on another of your
  // devices. (Not come yet, it comes with them in it.)
  heard(raw) {
    if (!this.book) return;
    for (const { level, q, n } of cleanChanges(raw)) setTimesRight(this.book, level, q, n);
    this.changed();
  }

  changed() {
    this.work();
    this.dispatchEvent(new CustomEvent('change'));
  }

  storeAnswers() {
    if (this.answers.length) save('quizanswers', this.answers);
    else remove('quizanswers');
  }
}
