// Studying at a Study Desk (shared/study.js): the workbooks' facts, a study
// asking the ones known least with a few new ones, misses coming back, and
// the notebook remembering what is known by heart.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as B from '../public/js/shared/blocks.js';
import { AGAIN_AFTER, allByHeart, answerStudy, BY_HEART, cleanNotebook, factsOf, fileStudy, isRight, isStudyDesk, makeStudy, NEW_PER_STUDY, STUDY_SIZE, workbookProgress, WORKBOOKS } from '../public/js/shared/study.js';
import { STAT_KEYS, STICKERS } from '../public/js/shared/stickers.js';
import { XP_FOR } from '../public/js/shared/levels.js';

test('every workbook has its facts, each with the right answer and a hint', () => {
  const sizes = Object.fromEntries(WORKBOOKS.map((w) => [w.key, factsOf(w.key).length]));
  assert.deepEqual(sizes, { add: 100, subtract: 100, times: 90, divide: 90, spelling: 40 });
  for (const w of WORKBOOKS) {
    const facts = factsOf(w.key);
    assert.equal(new Set(facts.map((f) => f.key)).size, facts.length, `${w.key}: every fact its own`);
    for (const f of facts) {
      assert.ok(f.q && f.answer && f.hint, `${w.key} ${f.key}`);
      if (w.words) {
        assert.ok(f.q.includes('___') && f.picture && f.say === f.answer, `${f.key} has a gap, a picture and a word to say`);
        continue;
      }
      const [a, op, b] = f.q.split(' ');
      const want = { '+': +a + +b, '−': a - b, '×': a * b, '÷': a / b }[op];
      assert.equal(f.answer, String(want), f.q);
      assert.ok(f.hint.includes(f.answer), `${f.q} hint gives the answer: ${f.hint}`);
    }
  }
  // Learnt small first: 1 + 1 before 9 + 9, the 2 times table before the 9.
  assert.equal(factsOf('add')[0].key, '1+1');
  assert.equal(factsOf('times')[0].key, '2x1');
  assert.equal(factsOf('add').find((f) => f.key === '8+5').hint, '8 + 2 makes 10, and 3 more makes 13.');
  assert.equal(factsOf('times').find((f) => f.key === '7x8').hint, '7 × 7 = 49, and 7 more makes 56.');
});

test('answers are checked forgiving of spaces and capitals', () => {
  const [cat] = factsOf('spelling');
  assert.ok(isRight(cat, ' Cat '));
  assert.ok(!isRight(cat, 'kat'));
  const sum = factsOf('add').find((f) => f.key === '7+8');
  assert.ok(isRight(sum, ' 15'));
  assert.ok(isRight(sum, '1 5'));
  assert.ok(!isRight(sum, '14'));
  assert.ok(!isRight(sum, ''));
});

test('a first study shows new facts, in the order they are learnt, before asking them', () => {
  const s = makeStudy('times', cleanNotebook({}), 7);
  assert.equal(s.asks.length, STUDY_SIZE);
  assert.ok(s.asks.every((a) => a.learn));
  assert.deepEqual(
    s.asks.map((a) => a.fact.key),
    factsOf('times').slice(0, STUDY_SIZE).map((f) => f.key),
  );
});

test('later studies ask a few new facts, the ones known least, and one known by heart', () => {
  const facts = factsOf('add');
  const page = {};
  // 30 seen: 10 in each of boxes 1 and 2, 10 by heart.
  facts.slice(0, 30).forEach((f, i) => (page[f.key] = i < 10 ? 1 : i < 20 ? 2 : BY_HEART));
  const notebook = cleanNotebook({ add: page });
  for (let seed = 1; seed < 20; seed++) {
    const s = makeStudy('add', notebook, seed);
    assert.equal(s.asks.length, STUDY_SIZE);
    const fresh = s.asks.filter((a) => a.learn);
    assert.equal(fresh.length, NEW_PER_STUDY);
    assert.deepEqual(
      fresh.map((a) => a.fact.key),
      facts.slice(30, 30 + NEW_PER_STUDY).map((f) => f.key),
      'the next new ones',
    );
    assert.ok(s.asks.slice(0, NEW_PER_STUDY).every((a) => a.learn), 'shown first');
    const boxes = s.asks.filter((a) => !a.learn).map((a) => notebook.add[a.fact.key]);
    assert.equal(boxes.filter((b) => b === BY_HEART).length, 1, 'one known by heart, to keep it fresh');
    assert.equal(boxes.filter((b) => b === 1).length, STUDY_SIZE - NEW_PER_STUDY - 1, 'the ones known least');
  }
});

test('a miss comes back a few questions later; the study files right ones a box up and misses back to the first', () => {
  const notebook = cleanNotebook({ add: { '1+1': 1, '1+2': BY_HEART - 1, '2+1': 2 } });
  const s = makeStudy('add', notebook, 3);
  const first = s.asks[0].fact;
  assert.deepEqual(answerStudy(s, 'nope'), { right: false, fact: first });
  assert.equal(s.asks.length, STUDY_SIZE + 1);
  assert.equal(s.asks[1 + AGAIN_AFTER].fact, first, 'asked again later');
  assert.ok(s.asks[1 + AGAIN_AFTER].again);
  while (!s.done) answerStudy(s, s.asks[s.at].fact.answer);
  assert.equal(s.right, STUDY_SIZE - 1, 'all but the miss right first time');
  assert.deepEqual(s.missed, [first.key]);
  assert.equal(answerStudy(s, '2'), undefined, 'nothing left to answer');

  const before = structuredClone(notebook.add);
  const learnt = fileStudy(notebook, s);
  assert.equal(notebook.add[first.key], 1, 'the miss back to the first box');
  for (const { fact } of s.asks) {
    if (fact.key === first.key) continue;
    assert.equal(notebook.add[fact.key], Math.min(BY_HEART, (before[fact.key] ?? 0) + 1), `${fact.key} one box up`);
  }
  assert.equal(learnt, first.key === '1+2' ? 0 : 1, '1 + 2 now known by heart');
  assert.equal(workbookProgress(notebook, 'add').byHeart, learnt);
  assert.equal(allByHeart(notebook), learnt);
});

test('a notebook kept keeps only real facts in real boxes', () => {
  const nb = cleanNotebook({ add: { '1+1': 2, '99+1': 3, '2+2': 9, '3+3': 'x' }, times: null, junk: { a: 1 } });
  assert.deepEqual(nb.add, { '1+1': 2 });
  assert.deepEqual(nb.times, {});
  assert.ok(!('junk' in nb));
  assert.deepEqual(cleanNotebook(null).spelling, {});
});

test('the study desk is told apart, and studying counts for XP and stickers', () => {
  for (let f = 0; f < 4; f++) assert.ok(isStudyDesk(B.turnedTo(B.STUDY_DESK, f)));
  for (const id of [B.SCHOOL_DESK, B.TABLE, B.AIR]) assert.ok(!isStudyDesk(id));
  for (const k of ['studies', 'studyright', 'byheart']) assert.ok(STAT_KEYS.includes(k), k);
  assert.ok(XP_FOR.studies.xp > 0 && XP_FOR.studyright.xp > 0);
  const sticker = (key) => STICKERS.find((s) => s.key === key);
  assert.ok(sticker('bookworm').test({ studies: 1 }));
  assert.ok(!sticker('by-heart').test({ byheart: 24 }) && sticker('by-heart').test({ byheart: 25 }));
  assert.ok(sticker('star-student').test({ byheart: 100 }));
});
