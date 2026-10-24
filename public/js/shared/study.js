// Studying at a Study Desk (a piece of furniture, blocks.js): sit down at
// one and your workbooks open — adding, taking away, times tables, sharing
// and spelling. Unlike a class at school (school.js), it is real practice
// that remembers what you know: each fact sits in a box of its own in your
// notebook, one box up when you get it right first time and back to the
// first when you miss it, and a fact four boxes up is known by heart. A
// study asks STUDY_SIZE facts, the ones you know least first, a few new
// ones (shown to you before you are asked them) and an old one known by
// heart now and then, so it does not slip away. You type the answer; a
// miss shows the right one and a way to work it out, and the fact comes
// back a little later in the same study, until you get it.
//
// It all happens on your own page, and the notebook stays on this device
// (game.js, storage.js); what you learn counts towards XP and stickers.
import { BLOCKS } from './blocks.js';
import { Rng } from './rng.js';

// Whether a block is a study desk (any way it faces).
export const isStudyDesk = (id) => BLOCKS[id]?.model === 'study-desk';

// How many facts a study asks, how many of them may be new, and the box a
// fact known by heart is in.
export const STUDY_SIZE = 10;
export const NEW_PER_STUDY = 3;
export const BY_HEART = 4;
// How many questions later a fact missed comes back.
export const AGAIN_AFTER = 3;

// The words to spell, each with a picture and a sentence it goes in.
export const WORDS = [
  ['cat', '🐱', 'The cat naps in the sun.'],
  ['dog', '🐶', 'My dog wags its tail.'],
  ['sun', '☀️', 'The sun is hot and bright.'],
  ['hat', '🎩', 'He wears a hat on his head.'],
  ['bed', '🛏️', 'I sleep in my bed.'],
  ['pig', '🐷', 'The pig rolls in the mud.'],
  ['bus', '🚌', 'We ride the bus to school.'],
  ['egg', '🥚', 'The hen laid an egg.'],
  ['cup', '🥤', 'Pour the milk into a cup.'],
  ['fox', '🦊', 'A fox has a bushy tail.'],
  ['fish', '🐟', 'A fish swims in the pond.'],
  ['frog', '🐸', 'The frog jumps on a lily pad.'],
  ['duck', '🦆', 'The duck says quack.'],
  ['star', '⭐', 'A star twinkles at night.'],
  ['moon', '🌙', 'The moon is up in the sky.'],
  ['tree', '🌳', 'A bird sits in the tree.'],
  ['ship', '🚢', 'The ship sails on the sea.'],
  ['milk', '🥛', 'I drink a glass of milk.'],
  ['cake', '🎂', 'We ate cake at the party.'],
  ['rain', '🌧️', 'Take an umbrella in the rain.'],
  ['snow', '❄️', 'We built a snowman in the snow.'],
  ['book', '📖', 'I read a book before bed.'],
  ['bird', '🐦', 'The bird sings a song.'],
  ['ball', '⚽', 'Kick the ball into the goal.'],
  ['apple', '🍎', 'An apple a day is good for you.'],
  ['house', '🏠', 'Our house has a red door.'],
  ['train', '🚂', 'The train goes choo choo.'],
  ['horse', '🐴', 'She rides a horse on the farm.'],
  ['chair', '🪑', 'Sit down on the chair.'],
  ['bread', '🍞', 'Make a sandwich with bread.'],
  ['cloud', '☁️', 'A white cloud floats by.'],
  ['clock', '🕰️', 'The clock says it is time for lunch.'],
  ['plant', '🪴', 'Water the plant every day.'],
  ['whale', '🐋', 'A whale is a very big animal.'],
  ['queen', '👑', 'The queen wears a crown.'],
  ['flower', '🌸', 'Smell the pretty flower.'],
  ['rabbit', '🐰', 'The rabbit hops in the grass.'],
  ['school', '🏫', 'We learn at school.'],
  ['friend', '🤝', 'My friend plays with me.'],
  ['rainbow', '🌈', 'A rainbow comes after the rain.'],
];

// The workbooks, each with what it practises.
export const WORKBOOKS = [
  { key: 'add', icon: '➕', name: 'Adding', how: 'Sums up to 10 + 10' },
  { key: 'subtract', icon: '➖', name: 'Taking away', how: 'Take away from numbers up to 20' },
  { key: 'times', icon: '✖️', name: 'Times tables', how: 'The 2 to 10 times tables' },
  { key: 'divide', icon: '➗', name: 'Sharing', how: 'Divide, using the times tables' },
  { key: 'spelling', icon: '🔤', name: 'Spelling', how: 'Hear a word and spell it', words: true },
];
export const workbookByKey = (key) => WORKBOOKS.find((w) => w.key === key) ?? null;

// The order the times tables are learnt in: the easy ones first.
const TABLES = [2, 10, 5, 3, 4, 6, 7, 8, 9];

// A way to work out a sum: make ten first when it goes past ten.
function addHint(a, b) {
  const sum = a + b;
  const [big, small] = a >= b ? [a, b] : [b, a];
  if (sum > 10 && big < 10) return `${big} + ${10 - big} makes 10, and ${small - (10 - big)} more makes ${sum}.`;
  if (small <= 3) return `Start at ${big} and count on ${small}: ${Array.from({ length: small }, (_, i) => big + i + 1).join(', ')}.`;
  return `${a} + ${b} = ${sum}.`;
}

// A way to work out a times fact: from the one before it, or by adding up.
function timesHint(a, b) {
  if (b === 1) return `${a} × 1 is just ${a}.`;
  if (b === 10) return `${a} × 10: put a 0 on the end of ${a} to make ${a * 10}.`;
  if (b <= 4) return `${b} lots of ${a}: ${Array(b).fill(a).join(' + ')} = ${a * b}.`;
  return `${a} × ${b - 1} = ${a * (b - 1)}, and ${a} more makes ${a * b}.`;
}

// Every fact of a workbook, in the order they are best learnt: { key, q,
// answer, hint }, and for a word its picture and sentence (with a gap for
// the word in `q`) and `say`, the word to read out.
export function factsOf(book) {
  const out = [];
  if (book === 'add' || book === 'subtract') {
    // The small sums first.
    for (let sum = 2; sum <= 20; sum++) {
      for (let a = Math.max(1, sum - 10); a <= Math.min(10, sum - 1); a++) {
        const b = sum - a;
        if (book === 'add') out.push({ key: `${a}+${b}`, q: `${a} + ${b} = ?`, answer: String(sum), hint: addHint(a, b) });
        else out.push({ key: `${sum}-${b}`, q: `${sum} − ${b} = ?`, answer: String(a), hint: `Because ${b} + ${a} = ${sum}, ${sum} − ${b} = ${a}.` });
      }
    }
  } else if (book === 'times' || book === 'divide') {
    for (const a of TABLES) {
      for (let b = 1; b <= 10; b++) {
        if (book === 'times') out.push({ key: `${a}x${b}`, q: `${a} × ${b} = ?`, answer: String(a * b), hint: timesHint(a, b) });
        else out.push({ key: `${a * b}/${a}`, q: `${a * b} ÷ ${a} = ?`, answer: String(b), hint: `Because ${a} × ${b} = ${a * b}, ${a * b} ÷ ${a} = ${b}.` });
      }
    }
  } else if (book === 'spelling') {
    for (const [word, picture, sentence] of WORDS) {
      out.push({ key: word, q: sentence.replace(new RegExp(`\\b${word}\\b`, 'i'), '___'), answer: word, picture, say: word, hint: `It is spelt ${word.split('').join(' · ')}.` });
    }
  }
  return out;
}

// An answer as typed, the way it is checked: no spaces round it or in a
// number, and in small letters.
export const tidyAnswer = (text) => String(text ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
export const isRight = (fact, text) => {
  const t = tidyAnswer(text);
  return t === fact.answer || t.replace(/ /g, '') === fact.answer;
};

// A notebook as it was kept, made safe: { [book]: { [fact key]: box } },
// boxes 1 to BY_HEART, only for facts that exist.
export function cleanNotebook(raw) {
  const out = {};
  for (const { key } of WORKBOOKS) {
    const known = new Set(factsOf(key).map((f) => f.key));
    const page = raw?.[key];
    out[key] = {};
    if (!page || typeof page !== 'object') continue;
    for (const [k, box] of Object.entries(page)) if (known.has(k) && Number.isInteger(box) && box >= 1 && box <= BY_HEART) out[key][k] = box;
  }
  return out;
}

// How far along a workbook is: { byHeart, seen, total }.
export function workbookProgress(notebook, book) {
  const page = notebook?.[book] ?? {};
  const total = factsOf(book).length;
  const boxes = Object.values(page);
  return { byHeart: boxes.filter((b) => b >= BY_HEART).length, seen: boxes.length, total };
}

// Facts known by heart, in every workbook.
export const allByHeart = (notebook) => WORKBOOKS.reduce((n, w) => n + workbookProgress(notebook, w.key).byHeart, 0);

// A list in a mixed-up order, by `rng` (Fisher–Yates).
function shuffle(rng, list) {
  for (let i = list.length - 1; i > 0; i--) {
    const j = rng.int(0, i);
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list;
}

// A study of a workbook: the facts to ask, in order, each { fact, learn }
// (learn: a new one, shown before it is asked). The ones known least come
// first in the choosing, ties by chance; new ones in the order they are
// best learnt; and one known by heart to keep it fresh.
export function makeStudy(book, notebook, seed, size = STUDY_SIZE) {
  const rng = new Rng(seed);
  const page = notebook?.[book] ?? {};
  const facts = factsOf(book);
  const fresh = facts.filter((f) => !page[f.key]);
  const learning = shuffle(rng, facts.filter((f) => page[f.key] && page[f.key] < BY_HEART)).sort((a, b) => page[a.key] - page[b.key]);
  const known = shuffle(rng, facts.filter((f) => page[f.key] >= BY_HEART));
  const picked = [];
  const take = (list, n, learn) => {
    for (const fact of list.splice(0, Math.max(0, Math.min(n, size - picked.length)))) picked.push({ fact, learn });
  };
  take(fresh, NEW_PER_STUDY, true);
  take(known, 1, false);
  take(learning, size, false);
  // Not enough to go over yet: more new ones, then more known by heart.
  take(fresh, size, true);
  take(known, size, false);
  // The new ones shown and asked first, then the rest mixed up.
  const learn = picked.filter((p) => p.learn);
  const rest = shuffle(rng, picked.filter((p) => !p.learn));
  return { book, asks: [...learn, ...rest], at: 0, shown: false, missed: [], right: 0, done: false };
}

// An answer typed to the fact being asked: { right, fact }. A right one
// goes on to the next; a miss puts the fact back in AGAIN_AFTER questions'
// time (the window shows the right answer first, then goes on). The last
// one right ends the study. Undefined when there is nothing to answer.
export function answerStudy(study, text) {
  if (!study || study.done) return;
  const ask = study.asks[study.at];
  if (!ask) return;
  const { fact } = ask;
  const right = isRight(fact, text);
  if (right) {
    if (!study.missed.includes(fact.key) && !ask.again) study.right++;
  } else {
    if (!study.missed.includes(fact.key)) study.missed.push(fact.key);
    study.asks.splice(Math.min(study.asks.length, study.at + 1 + AGAIN_AFTER), 0, { fact, learn: false, again: true });
  }
  study.at++;
  study.shown = false;
  if (study.at >= study.asks.length) study.done = true;
  return { right, fact };
}

// The notebook after a study: a fact right first time one box up (a new
// one into the first), a missed one back to the first. Returns the facts
// that came to be known by heart.
export function fileStudy(notebook, study) {
  const page = (notebook[study.book] ??= {});
  let learnt = 0;
  for (const { fact, again } of study.asks) {
    if (again) continue;
    const before = page[fact.key] ?? 0;
    page[fact.key] = study.missed.includes(fact.key) ? 1 : Math.min(BY_HEART, before + 1);
    if (before < BY_HEART && page[fact.key] >= BY_HEART) learnt++;
  }
  return learnt;
}
