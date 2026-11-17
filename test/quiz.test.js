// Quizzes, asked in classes at school and as Adventure Isle's key quizzes
// — every school year from Year 1 of elementary school to Year 3 of high
// school, the Olympiads (maths, science, logic and coding), a thinking-math
// one of puzzles to work out and English Words — each a few questions picked and
// shuffled out of a bank of them, with the right answer never where it was
// written; coins for the answers got right, and the counts and stickers
// they earn. A question answered right three times in a row is learnt, and
// never asked again.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { XP_FOR } from '../public/js/shared/levels.js';
import { spawnSync } from 'node:child_process';
import { cleanQuizBook, fileQuizAnswer, isLearnt, LEARNT_AFTER, makeQuiz, OLYMPIADS, QUESTION_BANKS, questionKey, QUIZ_LEVELS, QUIZ_SIZE, quizCoins, quizProgress, SCHOOLS } from '../public/js/shared/quiz.js';
import { STAT_KEYS, STICKERS } from '../public/js/shared/stickers.js';

test('a quiz for every school year, from elementary school to high school, four Olympiads and two more, each with questions to spare', () => {
  // The ones that came first keep their keys, for the quiz books that have them.
  assert.deepEqual(Object.keys(QUIZ_LEVELS), ['elementary1', 'junior', 'elementary3', 'elementary4', 'elementary5', 'elementary6', 'middle1', 'middle2', 'senior', 'high1', 'high2', 'high3', 'olympiad', 'science', 'logic', 'coding', 'thinker', 'english']);
  assert.deepEqual(
    Object.values(QUIZ_LEVELS).map((l) => l.name),
    [
      ...[1, 2, 3, 4, 5, 6].map((n) => `Elementary School Year ${n}`),
      ...[1, 2, 3].map((n) => `Middle School Year ${n}`),
      ...[1, 2, 3].map((n) => `High School Year ${n}`),
      'Math Olympiad',
      'Science Olympiad',
      'Logic Olympiad',
      'Coding Olympiad',
      'Thinking Math',
      'English Words',
    ],
  );
  for (const [key, def] of Object.entries(QUIZ_LEVELS)) {
    assert.equal(def.key, key);
    assert.ok(def.icon && def.name && def.how && def.color, `${key} says what it is`);
    const bank = QUESTION_BANKS[key];
    assert.ok(bank.length > QUIZ_SIZE, `${key} has more questions than a quiz asks`);
    const asked = new Set();
    for (const b of bank) {
      const { q, a, pic, code } = b;
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
      if (code !== undefined) assert.ok(typeof code === 'string' && code.trim().length > 0 && !code.includes('\t'), 'a program in lines, spaces for indents');
      // Questions in the same words show different programs.
      assert.ok(!asked.has(questionKey(b)), 'no question twice');
      asked.add(questionKey(b));
    }
  }
  // The quizzes ask different things, but for the dictionary's, which may
  // ask what another does (a spider's legs).
  const all = Object.entries(QUESTION_BANKS).flatMap(([key, bank]) => (key === 'english' ? [] : bank.map(questionKey)));
  assert.equal(new Set(all).size, all.length, 'each bank its own');
  // Each school's years, in order, in its colour, and paying what it pays;
  // the quizzes of no school year each in a colour of its own; none the
  // green of Done.
  for (const s of SCHOOLS) {
    const years = Object.values(QUIZ_LEVELS).filter((l) => l.school === s.key);
    assert.deepEqual(
      years.map((l) => l.year),
      Array.from({ length: s.years }, (_, i) => i + 1),
    );
    for (const l of years) assert.deepEqual([l.color, l.coins, l.icon], [s.color, s.coins, s.icon]);
  }
  // The Olympiads in theirs, each with its subject's icon and short name.
  const olympiads = Object.values(QUIZ_LEVELS).filter((l) => l.olympiad);
  assert.deepEqual(
    olympiads.map((l) => [l.key, l.short]),
    [
      ['olympiad', 'Math'],
      ['science', 'Science'],
      ['logic', 'Logic'],
      ['coding', 'Coding'],
    ],
  );
  for (const l of olympiads) assert.deepEqual([l.name, l.color, l.coins], [`${l.short} Olympiad`, OLYMPIADS.color, OLYMPIADS.coins]);
  assert.equal(new Set(olympiads.map((l) => l.icon)).size, olympiads.length);
  const others = Object.values(QUIZ_LEVELS).filter((l) => !l.school && !l.olympiad);
  assert.deepEqual(
    others.map((l) => l.key),
    ['thinker', 'english'],
  );
  const colors = [...SCHOOLS, OLYMPIADS, ...others].map((l) => l.color);
  assert.equal(new Set(colors).size, colors.length);
  assert.ok(!colors.includes('green'));
  // The banks the years and the Olympiad have had added, as big as the
  // others or bigger: learnt questions go, so a bank wants plenty.
  for (const key of ['elementary1', 'elementary3', 'elementary4', 'elementary5', 'elementary6', 'middle1', 'middle2', 'high1', 'high2', 'high3']) assert.ok(QUESTION_BANKS[key].length >= 39, `${key} has plenty of questions`);
  assert.ok(QUESTION_BANKS.olympiad.length >= 45);
  for (const key of ['science', 'logic', 'coding']) assert.ok(QUESTION_BANKS[key].length >= 35, `${key} has plenty of questions`);
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

test('the sums in the new school years’ banks come out right', () => {
  const answer = (key, q) => {
    const b = QUESTION_BANKS[key].find((x) => x.q === q);
    assert.ok(b, `${key} asks “${q}”`);
    return b.a[0];
  };
  const n = (x) => x.toLocaleString('en-US');
  const gcd = (a, b) => (b ? gcd(b, a % b) : a);
  const frac = (top, bottom) => `${top / gcd(top, bottom)}/${bottom / gcd(top, bottom)}`;
  const round = (x, places = 2) => Math.round(x * 10 ** places) / 10 ** places;
  // Year 1, counting the apples in the picture too.
  assert.equal(answer('elementary1', 'What is 3 + 4?'), String(3 + 4));
  assert.equal(answer('elementary1', 'What is 9 − 5?'), String(9 - 5));
  assert.equal(answer('elementary1', 'What is 6 + 6?'), String(6 + 6));
  assert.equal(answer('elementary1', 'What is 10 − 3?'), String(10 - 3));
  assert.equal(answer('elementary1', 'What is 8 + 5?'), String(8 + 5));
  assert.equal(answer('elementary1', 'What is 15 − 4?'), String(15 - 4));
  const apples = QUESTION_BANKS.elementary1.find((b) => b.q === 'How many apples are there?');
  assert.equal(apples.a[0], String(apples.pic.join(' ').split(' ').filter((t) => t === '🍎').length));
  // Year 4
  assert.equal(answer('elementary4', 'What is 325 × 14?'), n(325 * 14));
  assert.equal(answer('elementary4', 'What is 864 ÷ 24?'), String(864 / 24));
  assert.equal(answer('elementary4', 'What is 520 ÷ 13?'), String(520 / 13));
  assert.equal(answer('elementary4', 'What is 15 × 40?'), String(15 * 40));
  assert.equal(answer('elementary4', 'What is 3,847 rounded to the nearest hundred?'), n(Math.round(3847 / 100) * 100));
  assert.equal(answer('elementary4', 'What is 0.45 + 0.3?'), String(round(0.45 + 0.3)));
  assert.equal(answer('elementary4', 'What is 3.2 − 1.45?'), String(round(3.2 - 1.45)));
  assert.equal(answer('elementary4', 'Two angles of a triangle are 50° and 60°. What is the third?'), `${180 - 50 - 60}°`);
  assert.equal(answer('elementary4', 'How many diagonals does a pentagon have?'), String((5 * (5 - 3)) / 2));
  assert.equal(answer('elementary4', 'The numbers go 2, 5, 8, 11, … What is the 10th number?'), String(2 + 3 * 9));
  assert.equal(answer('elementary4', 'What is the largest number you can make with the cards 3, 8, 1 and 6, using each card once?'), n(Number([3, 8, 1, 6].sort((a, b) => b - a).join(''))));
  // Year 5
  assert.equal(answer('elementary5', 'What is 8 + 12 ÷ 4 × 2?'), String(8 + (12 / 4) * 2));
  assert.equal(answer('elementary5', 'What is (15 − 3) × 2 + 6?'), String((15 - 3) * 2 + 6));
  assert.equal(answer('elementary5', 'What is the greatest common factor of 18 and 24?'), String(gcd(18, 24)));
  assert.equal(answer('elementary5', 'What is the least common multiple of 4 and 6?'), String((4 * 6) / gcd(4, 6)));
  assert.equal(answer('elementary5', 'How many factors does 12 have?'), String([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].filter((d) => 12 % d === 0).length));
  assert.equal(answer('elementary5', 'What is 12/18 in its lowest terms?'), frac(12, 18));
  assert.equal(answer('elementary5', 'What is 1/2 + 1/3?'), frac(3 + 2, 6));
  assert.equal(answer('elementary5', 'What is 3/4 − 1/6?'), frac(9 - 2, 12));
  assert.equal(answer('elementary5', 'What is 3/5 × 5/6?'), frac(3 * 5, 5 * 6));
  assert.equal(answer('elementary5', 'What is 4 × 1/6?'), frac(4, 6));
  assert.equal(answer('elementary5', 'What is 1.2 × 0.4?'), String(round(1.2 * 0.4)));
  assert.equal(answer('elementary5', 'A trapezoid has parallel sides of 4 cm and 6 cm and a height of 5 cm. What is its area?'), `${((4 + 6) * 5) / 2} cm²`);
  assert.equal(answer('elementary5', 'A rhombus has diagonals of 6 cm and 8 cm. What is its area?'), `${(6 * 8) / 2} cm²`);
  assert.equal(answer('elementary5', 'What is the average of 70, 80 and 90?'), String((70 + 80 + 90) / 3));
  // Year 6
  assert.equal(answer('elementary6', 'What is 6 ÷ 2/3?'), String((6 * 3) / 2));
  assert.equal(answer('elementary6', 'What is 5/6 ÷ 5?'), frac(5, 6 * 5));
  assert.equal(answer('elementary6', 'What is 4.8 ÷ 0.6?'), String(round(4.8 / 0.6)));
  assert.equal(answer('elementary6', 'What is 2.4 ÷ 3?'), String(round(2.4 / 3)));
  assert.equal(answer('elementary6', 'What is 25% of 80?'), String((80 * 25) / 100));
  assert.equal(answer('elementary6', 'A shirt costs 20,000 won with 30% off. What is the sale price?'), `${n(20000 * 0.7)} won`);
  assert.equal(answer('elementary6', 'There are 20 children, boys and girls in the ratio 3 : 2. How many are girls?'), String((20 * 2) / (3 + 2)));
  assert.equal(answer('elementary6', 'Solve the proportion 3 : 4 = 9 : ☐'), String((4 * 9) / 3));
  assert.equal(answer('elementary6', 'On a 1 : 50,000 map, two places are 4 cm apart. How far apart are they really?'), `${(4 * 50000) / 100000} km`);
  assert.equal(answer('elementary6', 'A circle has a diameter of 10 cm. Taking π as 3.14, what is its circumference?'), `${round(10 * 3.14)} cm`);
  assert.equal(answer('elementary6', 'A circle has a radius of 10 cm. Taking π as 3.14, what is its area?'), `${round(10 * 10 * 3.14)} cm²`);
  assert.equal(answer('elementary6', 'What is the volume of a cuboid 5 cm long, 4 cm wide and 3 cm high?'), `${5 * 4 * 3} cm³`);
  assert.equal(answer('elementary6', 'What is the surface area of a cube with 3 cm edges?'), `${6 * 3 * 3} cm²`);
  // Middle school
  const isPrime = (k) => k > 1 && Array.from({ length: k - 2 }, (_, i) => i + 2).every((d) => k % d);
  assert.equal(answer('middle1', 'How many prime numbers are there between 1 and 20?'), String(Array.from({ length: 20 }, (_, i) => i + 1).filter(isPrime).length));
  assert.equal(answer('middle1', 'What is (−12) ÷ (−3) × (−2)?'), String((-12 / -3) * -2).replace('-', '−'));
  assert.equal(answer('middle1', 'Solve 4x − 7 = 13'), String((13 + 7) / 4));
  assert.equal(answer('middle1', 'Solve 3(x + 2) = 2x + 9'), String(9 - 6));
  assert.equal(answer('middle1', 'If x = −2, what is x² − 3x?'), String((-2) ** 2 - 3 * -2));
  assert.equal(answer('middle1', 'What do the inside angles of a hexagon add up to?'), `${180 * (6 - 2)}°`);
  assert.equal(answer('middle1', 'How big is each inside angle of a regular pentagon?'), `${(180 * (5 - 2)) / 5}°`);
  assert.equal(answer('middle1', 'How many diagonals does a hexagon have?'), String((6 * (6 - 3)) / 2));
  assert.equal(answer('middle2', 'x + y = 10 and x − y = 4. What is x?'), String((10 + 4) / 2));
  assert.equal(answer('middle2', '2x + y = 7 and x + y = 5. What is y?'), String(5 - (7 - 5)));
  assert.equal(answer('middle2', 'What is the slope of the line through (1, 3) and (3, 7)?'), String((7 - 3) / (3 - 1)));
  assert.equal(answer('middle2', 'A right-angled triangle has shorter sides of 6 and 8. How long is its longest side?'), String(Math.hypot(6, 8)));
  const dice = [1, 2, 3, 4, 5, 6];
  assert.equal(answer('middle2', 'Two dice are rolled. In how many ways can they add up to 7?'), String(dice.flatMap((a) => dice.filter((b) => a + b === 7)).length));
  assert.equal(answer('middle2', 'A 6 V battery drives a current through a 3 Ω resistor. What is the current?'), `${6 / 3} A`);
  // High school
  assert.equal(answer('high2', 'What is log₂ 32?'), String(Math.log2(32)));
  assert.equal(answer('high2', 'What is log₁₀ 1000?'), String(Math.round(Math.log10(1000))));
  assert.equal(answer('high2', 'What is log₃ 9 + log₃ 3?'), String(2 + 1));
  assert.equal(answer('high2', 'What is 8 to the power of 2/3?'), String(Math.round(8 ** (2 / 3))));
  assert.equal(answer('high2', 'Solve 2ˣ = 16'), String(Math.log2(16)));
  assert.equal(answer('high2', 'An arithmetic sequence goes 3, 7, 11, … What is its 10th term?'), String(3 + 9 * 4));
  assert.equal(answer('high2', 'A geometric sequence goes 2, 6, 18, … What is its 5th term?'), String(2 * 3 ** 4));
  assert.equal(answer('high2', 'What is 1 + 2 + 3 + … + 100?'), n((100 * 101) / 2));
  assert.equal(answer('high2', 'f(x) = x² + 3x. What is f′(2)?'), String(2 * 2 + 3));
  assert.equal(answer('high2', 'What is the integral of 3x² from x = 0 to x = 2?'), String(2 ** 3 - 0 ** 3));
  assert.equal(answer('high2', 'A car’s position is s(t) = t² + 2t metres. How fast is it going at t = 3 s?'), `${2 * 3 + 2} m/s`);
  assert.equal(answer('high2', 'What is the kinetic energy of a 2 kg ball moving at 3 m/s?'), `${(2 * 3 ** 2) / 2} J`);
  assert.equal(answer('high2', 'How much potential energy does a 5 kg box gain when it is lifted 2 m? (g = 10 m/s²)'), `${5 * 10 * 2} J`);
  assert.equal(answer('high2', 'How many moles are there in 36 g of water (18 g/mol)?'), String(36 / 18));
  const choose = (a, b) => (b === 0 ? 1 : (choose(a - 1, b - 1) * a) / b);
  assert.equal(answer('high3', 'What is the coefficient of x² in (x + 2)⁵?'), String(choose(5, 2) * 2 ** 3));
  assert.equal(answer('high3', 'In how many ways can 3 different letters go into 2 postboxes?'), String(2 ** 3));
  assert.equal(answer('high3', 'In how many ways can the letters of AABB be arranged?'), String(new Set(['A', 'A', 'B', 'B'].flatMap((a, i, all) => all.flatMap((b, j) => all.flatMap((c, k) => all.map((d, l) => (new Set([i, j, k, l]).size === 4 ? a + b + c + d : null))))).filter(Boolean)).size));
  assert.equal(answer('high3', 'A and B are independent, with P(A) = 0.5 and P(B) = 0.4. What is P(A and B)?'), String(0.5 * 0.4));
  assert.equal(answer('high3', 'P(A and B) = 0.12 and P(B) = 0.4. What is P(A | B)?'), String(round(0.12 / 0.4)));
  assert.equal(answer('high3', 'X follows the binomial distribution B(100, 1/2). What is its variance?'), String(100 * 0.5 * 0.5));
  assert.equal(answer('high3', 'a = (1, 2) and b = (3, −1). What is the dot product a · b?'), String(1 * 3 + 2 * -1));
  assert.equal(answer('high3', 'Where is the focus of the parabola y² = 8x?'), `(${8 / 4}, 0)`);
  assert.equal(answer('high3', 'A substance has a half-life of 5 years. How much of 80 g of it is left after 15 years?'), `${80 / 2 ** (15 / 5)} g`);
  assert.equal(answer('high3', 'In a population in Hardy–Weinberg balance, the allele frequency q is 0.3. How common is the qq genotype?'), String(round(0.3 ** 2)));
});

test('the Math Olympiad’s answers, worked out the long way', () => {
  const answer = (q) => {
    const b = QUESTION_BANKS.olympiad.find((x) => x.q === q);
    assert.ok(b, `the Olympiad asks “${q}”`);
    return b.a[0];
  };
  const n = (x) => x.toLocaleString('en-US');
  const range = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => a + i);
  const divisors = (k) => range(1, k).filter((d) => k % d === 0);
  const isPrime = (k) => divisors(k).length === 2;
  const fact = (k) => range(1, k).reduce((p, i) => p * BigInt(i), 1n);
  const sum = (list) => list.reduce((a, b) => a + b, 0);
  const perms = (list) => (list.length <= 1 ? [list] : list.flatMap((x, i) => perms([...list.slice(0, i), ...list.slice(i + 1)]).map((rest) => [x, ...rest])));
  assert.equal(answer('What is the last digit of 7¹⁰⁰?'), String(7n ** 100n % 10n));
  assert.equal(answer('How many zeros are there at the end of 25! (25 factorial)?'), String(fact(25).toString().match(/0*$/)[0].length));
  assert.equal(answer('What is the remainder when 2¹⁰ is divided by 7?'), String(2 ** 10 % 7));
  assert.equal(answer('How many positive divisors does 360 have?'), String(divisors(360).length));
  assert.equal(answer('What do all the divisors of 28 add up to, 28 itself included?'), String(sum(divisors(28))));
  assert.equal(answer('What is the largest prime factor of 2024?'), String(Math.max(...divisors(2024).filter(isPrime))));
  assert.equal(answer('What is the smallest number bigger than 1 that leaves a remainder of 1 when divided by 2, 3, 4, 5 or 6?'), String(range(2, 1000).find((k) => [2, 3, 4, 5, 6].every((d) => k % d === 1))));
  const climbs = (k) => (k <= 1 ? 1 : climbs(k - 1) + climbs(k - 2));
  assert.equal(answer('In how many ways can you climb 6 stairs, taking 1 or 2 stairs at a time?'), String(climbs(6)));
  assert.equal(answer('How many squares of any size are there on an 8 × 8 chessboard?'), String(sum(range(1, 8).map((k) => (9 - k) ** 2))));
  assert.equal(answer('How many diagonals does a 10-sided polygon have?'), String((10 * 9) / 2 - 10));
  const apart = range(0, 22).reduce((p, i) => (p * (365 - i)) / 365, 1);
  assert.equal(answer('With 23 people in a room, about how likely is it that two of them share a birthday?'), `About ${Math.round((1 - apart) * 10) * 10}%`);
  assert.equal(answer('What is the angle between the hands of a clock at 3:30?'), `${Math.abs(30 * 6 - (3 * 30 + 30 / 2))}°`);
  assert.equal(answer('What is 1 + 3 + 5 + … + 99?'), n(sum(range(1, 99).filter((k) => k % 2))));
  const digitSum = (k) => sum(String(k).split('').map(Number));
  assert.equal(answer('How many three-digit numbers have digits that add up to 5?'), String(range(100, 999).filter((k) => digitSum(k) === 5).length));
  const s = (13 + 14 + 15) / 2;
  assert.equal(answer('What is the area of a triangle with sides 13, 14 and 15?'), String(Math.sqrt(s * (s - 13) * (s - 14) * (s - 15))));
  assert.equal(answer('A rectangle has a perimeter of 20 cm. What is the biggest area it can have?'), `${Math.max(...range(0, 100).map((w) => (w / 10) * (10 - w / 10)))} cm²`);
  assert.equal(answer('What do the angles at the five tips of a five-pointed star add up to?'), `${5 * (180 - 2 * 72)}°`);
  const shuffles = perms([1, 2, 3]);
  assert.equal(answer('Three cards marked 1, 2 and 3 are shuffled into a row. What is the chance that no card is in its own place?'), `1/${shuffles.length / shuffles.filter((p) => p.every((c, i) => c !== i + 1)).length}`);
  assert.equal(answer('Which is bigger, 2¹⁰⁰ or 3⁶⁰?'), 2n ** 100n > 3n ** 60n ? '2¹⁰⁰' : '3⁶⁰');
  assert.equal(answer('How many times do you write the digit 7 when you write the numbers from 1 to 100?'), String(range(1, 100).join('').split('').filter((d) => d === '7').length));
  assert.ok(range(10, 99).every((k) => (k + Number(String(k).split('').reverse().join(''))) % 11 === 0));
  assert.equal(answer('Any two-digit number plus the number with its digits the other way round (like 47 + 74) always makes…'), 'A multiple of 11');
  assert.equal(answer('What is the units digit of 3¹ + 3² + 3³ + … + 3²⁰?'), String(range(1, 20).reduce((t, k) => t + 3n ** BigInt(k), 0n) % 10n));
  assert.equal(answer('Two trains 200 km apart head toward each other at 60 km/h and 40 km/h. A bird flies back and forth between them at 100 km/h until they meet. How far does the bird fly?'), `${(200 / (60 + 40)) * 100} km`);
  assert.equal(answer('Three fair coins are tossed. What is the chance of at least one head?'), `${2 ** 3 - 1}/${2 ** 3}`);
  assert.equal(answer('What is √(2 + √3) × √(2 − √3)?'), String(Math.round(Math.sqrt(2 + Math.sqrt(3)) * Math.sqrt(2 - Math.sqrt(3)) * 1e9) / 1e9));
  const x = (3 + Math.sqrt(5)) / 2;
  assert.equal(answer('If x + 1/x = 3, what is x² + 1/x²?'), String(Math.round(x ** 2 + 1 / x ** 2)));
  assert.equal(answer('What is the remainder when 1! + 2! + 3! + … + 100! is divided by 12?'), String(range(1, 100).reduce((t, k) => t + fact(k), 0n) % 12n));
  assert.equal(answer('In how many ways can 8 rooks be put on a chessboard so that no two attack each other?'), n(Number(fact(8))));
  const cubes = range(0, 2).flatMap((a) => range(0, 2).flatMap((b) => range(0, 2).map((c) => [a, b, c].filter((v) => v !== 1).length)));
  assert.equal(answer('A 3 × 3 × 3 cube painted on the outside is cut into 27 little cubes. How many of them have exactly two painted faces?'), String(cubes.filter((faces) => faces === 2).length));
  let rest = 1;
  let digit = 0;
  for (let i = 0; i < 100; i++) {
    digit = Math.floor((rest * 10) / 7);
    rest = (rest * 10) % 7;
  }
  assert.equal(answer('What is the 100th digit after the decimal point of 1/7?'), String(digit));
  assert.equal(answer('Ann is twice as old as Ben was when Ann was as old as Ben is now. Ann is 24. How old is Ben?'), String(range(1, 23).find((ben) => 24 === 2 * (ben - (24 - ben)))));
  const say = (t) => t.match(/(.)\1*/g).map((run) => `${run.length}${run[0]}`).join('');
  assert.equal(answer('What comes next: 1, 11, 21, 1211, 111221, …?'), say('111221'));
  // The newer ones.
  const gcd = (a, b) => (b ? gcd(b, a % b) : a);
  const choose = (a, b) => (b === 0 ? 1 : (choose(a - 1, b - 1) * a) / b);
  assert.equal(answer('How many whole numbers from 1 to 100 can be divided exactly by 3 or by 5?'), String(range(1, 100).filter((k) => k % 3 === 0 || k % 5 === 0).length));
  assert.equal(answer('What is the smallest whole number that has exactly 10 divisors?'), String(range(1, 1000).find((k) => divisors(k).length === 10)));
  let change = 0;
  for (let tens = 0; tens * 10 <= 25; tens++) for (let fives = 0; tens * 10 + fives * 5 <= 25; fives++) change++;
  assert.equal(answer('In how many ways can you make 25¢ out of 1¢, 5¢ and 10¢ coins?'), String(change));
  assert.equal(answer('How many four-digit palindromes are there, numbers like 1221 that read the same both ways?'), String(range(1000, 9999).filter((k) => String(k) === [...String(k)].reverse().join('')).length));
  assert.equal(answer('What is the greatest common factor of 2¹⁰ − 1 and 2⁶ − 1?'), String(gcd(2 ** 10 - 1, 2 ** 6 - 1)));
  assert.equal(answer('What is the remainder when 3¹⁰⁰ is divided by 5?'), String(3n ** 100n % 5n));
  assert.equal(answer('A circle just fits inside a square with sides of 2. What is the area inside the square but outside the circle?'), '4 − π');
  assert.equal(answer('In how many ways can 5 people sit round a round table, if turning the table does not count as a new way?'), String(perms([1, 2, 3, 4, 5]).length / 5));
  assert.equal(answer('Moving only right or up along the lines of a 4 × 4 grid of squares, how many shortest paths go from one corner to the opposite one?'), String(choose(8, 4)));
  assert.equal(answer('Five numbers average 10. One is taken away, and the other four average 9. What number was taken away?'), String(5 * 10 - 4 * 9));
  assert.equal(answer('What is 999 × 999?'), n(999 * 999));
  const powers = [
    ['2⁵⁰', 2n ** 50n],
    ['3³³', 3n ** 33n],
    ['5²¹', 5n ** 21n],
  ];
  assert.equal(answer('Which is the biggest: 2⁵⁰, 3³³ or 5²¹?'), powers.reduce((best, p) => (p[1] > best[1] ? p : best))[0]);
  const tilings = (k) => (k <= 1 ? 1 : tilings(k - 1) + tilings(k - 2));
  assert.equal(answer('In how many ways can a 2 × 5 board be covered with 1 × 2 dominoes?'), String(tilings(5)));
  assert.equal(answer('Two cards are drawn from a shuffled pack of 52. What is the chance that both are aces?'), `1/${(52 * 51) / (4 * 3)}`);
  assert.ok(Math.abs(((3 * Math.sqrt(3)) / 2) * 2 ** 2 - 6 * Math.sqrt(3)) < 1e-12);
  assert.equal(answer('What is the area of a regular hexagon with sides of 2?'), '6√3');
  assert.equal(answer('What is 1 + 4 + 9 + 16 + … + 400, the first 20 square numbers added up?'), n(sum(range(1, 20).map((k) => k * k))));
  assert.equal(answer('What is the smallest number that leaves a remainder of 2 when divided by 3, 3 when divided by 4 and 4 when divided by 5?'), String(range(1, 1000).find((k) => k % 3 === 2 && k % 4 === 3 && k % 5 === 4)));
});

test('the Science Olympiad’s sums come out right, and its genes by every child the parents could have', () => {
  const answer = (q) => {
    const b = QUESTION_BANKS.science.find((x) => x.q === q);
    assert.ok(b, `the Science Olympiad asks “${q}”`);
    return b.a[0];
  };
  const g = 10;
  const round = (x) => Math.round(x * 1000) / 1000;
  const gcd = (a, b) => (b ? gcd(b, a % b) : a);
  assert.equal(answer('A ball is thrown straight up at 20 m/s. How high does it go? (g = 10 m/s²)'), `${20 ** 2 / (2 * g)} m`);
  assert.equal(answer('A ball thrown straight up at 15 m/s comes back down to your hand after how long? (g = 10 m/s²)'), `${(2 * 15) / g} s`);
  assert.equal(answer('A pendulum is let go 45 cm above its lowest point. How fast is it moving at the bottom? (g = 10 m/s²)'), `${round(Math.sqrt(2 * g * 0.45))} m/s`);
  assert.equal(answer('What do two 6 Ω resistors joined in parallel make?'), `${round(1 / (1 / 6 + 1 / 6))} Ω`);
  assert.equal(answer('A 2 Ω and a 3 Ω resistor are joined in series to a 10 V battery. What current flows?'), `${10 / (2 + 3)} A`);
  assert.equal(answer('How much power does a 12 V lamp use when 2 A flows through it?'), `${12 * 2} W`);
  assert.equal(answer('An object stands 30 cm from a convex lens with a focal length of 10 cm. How far behind the lens is its image?'), `${round(1 / (1 / 10 - 1 / 30))} cm`);
  assert.equal(answer('A wave has a frequency of 5 Hz and a wavelength of 2 m. How fast does it travel?'), `${5 * 2} m/s`);
  assert.equal(answer('You shout at a cliff and hear the echo 2 s later. Sound travels at 340 m/s. How far away is the cliff?'), `${(340 * 2) / 2} m`);
  assert.equal(answer('About how much of a floating ice cube is under the water?'), `About ${Math.round((0.917 / 1) * 10) * 10}%`);
  assert.equal(answer('A 1,000 kg car going at 20 m/s brakes to a stop. How much of its energy turns into heat?'), `${((1000 * 20 ** 2) / 2).toLocaleString('en-US')} J`);
  assert.equal(answer('A 2 kg box is pulled with a force of 10 N against 4 N of friction. What is its acceleration?'), `${(10 - 4) / 2} m/s²`);
  assert.equal(answer('A planet goes round the Sun 4 times as far out as the Earth. How long is its year?'), `${Math.sqrt(4 ** 3)} Earth years`);
  assert.equal(answer('About how long does sunlight take to reach the Earth?'), `About ${Math.round(149.6e6 / 299792 / 60)} minutes`);
  assert.equal(answer('A transformer has 100 turns on its input coil and 500 on its output coil. 10 V goes in. What comes out?'), `${(10 * 500) / 100} V`);
  assert.equal(answer('A balloon holds 2 L of gas at 300 K. Warmed to 450 K at the same pressure, how big does it get?'), `${(2 * 450) / 300} L`);
  // Chemistry: the atoms balance, the masses add up.
  assert.equal(answer('Balance it: C₃H₈ + ☐O₂ → 3CO₂ + 4H₂O'), String((3 * 2 + 4 * 1) / 2));
  assert.equal(answer('What is the molar mass of CO₂? (C = 12, O = 16)'), `${12 + 2 * 16} g/mol`);
  assert.equal(answer('What is the oxidation number of manganese in KMnO₄?'), `+${0 - 1 - 4 * -2}`);
  assert.equal(answer('How many grams of salt, NaCl, are there in 0.5 mol of it? (Na = 23, Cl = 35.5)'), `${0.5 * (23 + 35.5)} g`);
  assert.equal(answer('How many neutrons does an atom of carbon-14 have?'), String(14 - 6));
  // Genes: every child the parents could have, each as likely.
  const kids = (mum, dad) => [...mum].flatMap((m) => [...dad].map((d) => m + d));
  const share = (list, fits) => {
    const n = list.filter(fits).length;
    return n ? `${n / gcd(n, list.length)}/${list.length / gcd(n, list.length)}` : '0';
  };
  assert.equal(answer('Two parents are both Aa. What is the chance that their child is aa?'), share(kids('Aa', 'Aa'), (k) => k === 'aa'));
  const gametes = ['AB', 'Ab', 'aB', 'ab'];
  assert.equal(
    answer('Two plants, both AaBb, are crossed, the two genes sorting independently. What share of their young show both dominant traits?'),
    share(
      gametes.flatMap((x) => gametes.map((y) => x + y)),
      (k) => k.includes('A') && k.includes('B'),
    ),
  );
  assert.equal(answer('A mother with blood type AO and a father with type BO have a child. What is the chance it is type O?'), share(kids('AO', 'BO'), (k) => k === 'OO'));
  // A son has his X from his mother, and hers carry no colour blindness.
  assert.equal(answer('Colour blindness is carried on the X chromosome. A colour-blind father and a mother with no colour-blindness gene have a son. What is the chance he is colour-blind?'), share(kids('XX', 'Y'), (k) => k.includes('x')));
  const pair = { A: 'T', T: 'A', G: 'C', C: 'G' };
  assert.equal(answer('One strand of DNA reads ATGCCA. What does the strand paired with it read?'), [...'ATGCCA'].map((b) => pair[b]).join(''));
});

test('the Logic Olympiad: every way it could be is tried, and only the right answer fits', () => {
  const answer = (q) => {
    const b = QUESTION_BANKS.logic.find((x) => x.q === q);
    assert.ok(b, `the Logic Olympiad asks “${q}”`);
    return b.a[0];
  };
  const tf = [true, false];
  const perms = (list) => (list.length <= 1 ? [list] : list.flatMap((x, i) => perms([...list.slice(0, i), ...list.slice(i + 1)]).map((rest) => [x, ...rest])));
  // Knights (true) and knaves (false): only the ways where each says what fits what it is.
  const pairs = tf.flatMap((a) => tf.map((b) => [a, b]));
  const kind = ([a, b]) => `A is a ${a ? 'knight' : 'knave'}, B is a ${b ? 'knight' : 'knave'}`;
  const both = pairs.filter(([a, b]) => a === (!a && !b));
  assert.equal(both.length, 1);
  assert.equal(answer('On an island, knights always tell the truth and knaves always lie. A says: “We are both knaves.” What are A and B?'), kind(both[0]));
  const same = pairs.filter(([a, b]) => a === !b && b === (a === b));
  assert.equal(same.length, 1);
  assert.equal(answer('Knights always tell the truth and knaves always lie. A says: “B is a knave.” B says: “A and I are the same kind.” What are they?'), kind(same[0]));
  const three = tf.flatMap((a) => tf.flatMap((b) => tf.map((c) => [a, b, c]))).filter(([a, b, c]) => a === !b && b === !c && c === (!a && !b));
  assert.deepEqual(three, [[false, true, false]]);
  assert.equal(answer('A says: “B is lying.” B says: “C is lying.” C says: “A and B are both lying.” Who is telling the truth?'), 'Only B');
  const gold = [1, 2, 3].filter((at) => [at === 1, at !== 2, at !== 1].filter(Boolean).length === 1);
  assert.equal(gold.length, 1);
  assert.equal(answer('Gold is in one of three boxes. Box 1 says “The gold is here”, box 2 says “The gold is not here” and box 3 says “The gold is not in box 1”. Only one sign is true. Where is the gold?'), `Box ${gold[0]}`);
  // Weighings: each has three outcomes, so n of them tell 3ⁿ cases apart.
  assert.equal(answer('Nine coins look the same, but one is a little heavier. How few weighings on a balance always find it?'), String([1, 2, 3, 4].find((w) => 3 ** w >= 9)));
  assert.equal(answer('Twelve coins look the same, but one is fake: heavier or lighter. How few weighings on a balance always find it, and whether it is heavier or lighter?'), String([1, 2, 3, 4].find((w) => (3 ** w - 3) / 2 >= 12)));
  // The river: every crossing tried, the fewest that gets them all over.
  const safe = ([farmer, wolf, goat, cabbage]) => !(wolf === goat && goat !== farmer) && !(goat === cabbage && goat !== farmer);
  const seen = new Set(['0000']);
  let frontier = [[0, 0, 0, 0]];
  let crossings = 0;
  while (!frontier.some((st) => st.every((side) => side === 1))) {
    crossings++;
    frontier = frontier.flatMap((st) =>
      [null, 1, 2, 3]
        .filter((thing) => thing === null || st[thing] === st[0])
        .map((thing) => st.map((side, i) => (i === 0 || i === thing ? 1 - side : side)))
        .filter((next) => safe(next) && !seen.has(next.join('')) && seen.add(next.join(''))),
    );
  }
  assert.equal(answer('A farmer takes a wolf, a goat and a cabbage across a river, one at a time in his boat. The wolf can’t be left with the goat, nor the goat with the cabbage. How many crossings does it take, at the fewest?'), String(crossings));
  // The bridge: the quickest of every way across.
  const pace = [1, 2, 5, 10];
  const best = new Map([['0000|0', 0]]);
  const queue = [['0000', 0, 0]];
  while (queue.length) {
    queue.sort((x, y) => x[2] - y[2]);
    const [sides, torch, time] = queue.shift();
    const here = [0, 1, 2, 3].filter((i) => Number(sides[i]) === torch);
    const groups = here.flatMap((i) => [[i], ...here.filter((j) => j > i).map((j) => [i, j])]);
    for (const group of groups) {
      const next = [...sides].map((side, i) => (group.includes(i) ? String(1 - Number(side)) : side)).join('');
      const t = time + Math.max(...group.map((i) => pace[i]));
      const at = `${next}|${1 - torch}`;
      if (t < (best.get(at) ?? Infinity)) {
        best.set(at, t);
        queue.push([next, 1 - torch, t]);
      }
    }
  }
  assert.equal(answer('Four people cross a bridge at night with one torch. At most two cross at a time, at the slower one’s pace. They take 1, 2, 5 and 10 minutes. What is the shortest time for all of them to cross?'), `${best.get('1111|1')} minutes`);
  // The doors: every place the car could be and every first pick.
  const games = [0, 1, 2].flatMap((car) => [0, 1, 2].map((pick) => ({ car, pick })));
  assert.equal(games.filter(({ car, pick }) => car !== pick).length * 3, games.length * 2, 'switching wins 2 in 3');
  assert.equal(answer('You pick one of three doors; a car is behind one of them. The host, who knows where it is, opens another door with a goat behind it and lets you switch. How often does switching win the car?'), '2 times in 3');
  // The cards: turn over the ones whose other side could break the rule.
  const vowel = (c) => 'AEIOU'.includes(c);
  const breaks = (letter, number) => vowel(letter) && number % 2 === 1;
  const turn = ['A', 'K', '4', '7'].filter((face) => (/\d/.test(face) ? ['A', 'K'].some((l) => breaks(l, Number(face))) : [4, 7].some((n) => breaks(face, n))));
  assert.equal(answer('Four cards show A, K, 4 and 7. The rule: “A card with a vowel on one side has an even number on the other.” Which cards must you turn over to check it?'), turn.join(' and '));
  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  const today = (days.indexOf('Sunday') - 2 + 7) % 7;
  assert.equal(answer('If the day after tomorrow is Sunday, what day was the day before yesterday?'), days[(today - 2 + 7) % 7]);
  // Socks: the unluckiest draws.
  assert.equal(answer('A dark drawer holds 10 black socks and 10 white ones. How many must you take out to be sure of a matching pair?'), String(2 + 1));
  assert.equal(answer('From a dark drawer of 10 black socks and 10 white ones, how many must you take out to be sure of two black ones?'), String(10 + 2));
  assert.equal(answer('A bat and a ball cost 1,100 won together. The bat costs 1,000 won more than the ball. How much is the ball?'), `${(1100 - 1000) / 2} won`);
  assert.equal(answer('Lily pads on a pond double every day and cover all of it on day 48. On which day did they cover half of it?'), `Day ${48 - 1}`);
  const shown = 12 * 60 + (6 * 60 * 55) / 60;
  assert.equal(answer('A clock loses 5 minutes every hour. It is set right at noon. What does it show at 6 p.m.?'), `${Math.floor(shown / 60) - 12}:${String(shown % 60).padStart(2, '0')}`);
  // The hands meet every 12/11 hours.
  assert.equal(answer('How many times a day are a clock’s hour and minute hands exactly on top of each other?'), String(Array.from({ length: 30 }, (_, k) => (k * 12) / 11).filter((h) => h < 24).length));
  const pets = perms(['cat', 'dog', 'fish']).filter(([ann, ben]) => ann === 'fish' && ben !== 'dog');
  assert.equal(pets.length, 1);
  assert.equal(answer('Ann, Ben and Cal have a cat, a dog and a fish, one pet each. Ann is allergic to fur, and Ben’s pet does not bark. Who has the dog?'), ['Ann', 'Ben', 'Cal'][pets[0].indexOf('dog')]);
  const race = perms(['Amy', 'Bo', 'Cy', 'Di', 'Eve']).filter((o) => o.indexOf('Cy') < o.indexOf('Amy') && o.indexOf('Amy') < o.indexOf('Bo') && o.indexOf('Bo') < o.indexOf('Di') && o.indexOf('Eve') === o.indexOf('Cy') + 1);
  assert.equal(race.length, 1);
  assert.equal(answer('In a race of five, Cy beat Amy, Amy beat Bo, Bo beat Di, and Eve crossed the line just after Cy. Who came third?'), race[0][2]);
  const rows = perms(['A', 'B', 'C', 'D']).filter((r) => r.indexOf('D') === 1 && (r[0] === 'C' || r[3] === 'C') && Math.abs(r.indexOf('A') - r.indexOf('B')) > 1 && r.indexOf('A') < r.indexOf('B'));
  assert.equal(rows.length, 1);
  assert.equal(answer('A, B, C and D sit in a row. D sits second from the left, C sits at one end, A is not next to B, and A sits somewhere to the left of B. Who sits at the left end?'), rows[0][0]);
  const digits = QUESTION_BANKS.logic.find((b) => b.q.startsWith('Each letter stands for a different digit')).a.filter((ab) => ab[0] !== ab[1] && Number(ab) + Number([...ab].reverse().join('')) === 121);
  assert.deepEqual(digits, [answer('Each letter stands for a different digit, and AB + BA = 121. Which could AB be?')]);
  const prime = (k) => k > 1 && Array.from({ length: k - 2 }, (_, i) => i + 2).every((d) => k % d);
  assert.deepEqual([3, 5, 7, 9, 11].filter((k) => !prime(k)).map(String), [answer('Which number does not belong: 3, 5, 7, 9, 11?')]);
  assert.equal(answer('What letter comes next: O, T, T, F, F, S, S, E, …?'), ['One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'][8][0]);
  assert.equal(answer('What comes next: 2, 3, 5, 9, 17, …?'), String(17 * 2 - 1));
  const jumps = [-2, -1, 1, 2].flatMap((dx) => [-2, -1, 1, 2].filter((dy) => Math.abs(dx) !== Math.abs(dy)).map((dy) => [dx, dy]));
  assert.equal(answer('A knight stands on a corner square of a chessboard. How many squares can it move to?'), String(jumps.filter(([dx, dy]) => dx >= 0 && dy >= 0 && dx < 8 && dy < 8).length));
});

test('the Coding Olympiad: Python runs every program to see what it prints, and the rest are worked out', (t) => {
  const bank = QUESTION_BANKS.coding;
  const programs = bank.filter((b) => b.code);
  assert.ok(programs.length >= 15, 'plenty of programs to read');
  // Every program run by Python itself, what it prints caught.
  const python = ['import contextlib, io, json, sys', 'out = []', 'for code in json.load(sys.stdin):', '    buf = io.StringIO()', '    with contextlib.redirect_stdout(buf):', '        exec(code, {})', '    out.append(buf.getvalue().strip())', 'print(json.dumps(out))'].join('\n');
  const run = spawnSync('python3', ['-c', python], { input: JSON.stringify(programs.map((b) => b.code)), encoding: 'utf8' });
  if (run.error) {
    t.skip('no python3 here to run the programs');
    return;
  }
  assert.equal(run.status, 0, run.stderr);
  const printed = JSON.parse(run.stdout);
  programs.forEach((b, i) => {
    assert.equal(printed[i], b.a[0], b.code);
    assert.ok(!b.a.slice(1).some((wrong) => wrong.replace('−', '-') === printed[i]), `only one answer is what it prints:\n${b.code}`);
  });
  const answer = (q) => {
    const b = bank.find((x) => x.q === q && !x.code);
    assert.ok(b, `the Coding Olympiad asks “${q}”`);
    return b.a[0];
  };
  assert.equal(answer('What is the binary number 1011 in decimal?'), String(parseInt('1011', 2)));
  assert.equal(answer('What is 25 written in binary?'), (25).toString(2));
  assert.equal(answer('How many different values can one byte, 8 bits, hold?'), String(2 ** 8));
  assert.equal(answer('What is the hexadecimal number FF in decimal?'), String(parseInt('FF', 16)));
  assert.equal(answer('At most how many guesses does binary search need to find a name in a sorted list of 1,000 names?'), String(Math.ceil(Math.log2(1000 + 1))));
  assert.equal(answer('An AND gate gets a 1 and a 0. What does it give out?'), String(1 & 0));
  const list = [3, 1, 2];
  let swaps = 0;
  for (let i = 0; i < list.length; i++) {
    for (let j = 0; j + 1 < list.length - i; j++) {
      if (list[j] > list[j + 1]) {
        [list[j], list[j + 1]] = [list[j + 1], list[j]];
        swaps++;
      }
    }
  }
  assert.equal(answer('Bubble sort sorts [3, 1, 2] by swapping neighbours that are the wrong way round. How many swaps does it make?'), String(swaps));
  const stack = [1, 2, 3];
  stack.pop();
  stack.push(4);
  stack.pop();
  assert.equal(answer('A stack: push 1, push 2, push 3, pop, push 4, pop. What is on top now?'), String(stack.at(-1)));
  const line = ['A', 'B', 'C'];
  line.shift();
  line.push('D');
  assert.equal(answer('A queue: add A, add B, add C, take one out, add D. Which is at the front now?'), line[0]);
  assert.equal(answer('A tree has 10 nodes. How many edges does it have?'), String(10 - 1));
  const roads = { AB: 4, BC: 3, AC: 9, CD: 2, BD: 7 };
  const road = (a, b) => roads[a + b] ?? roads[b + a];
  const ways = (at, been) => (at === 'D' ? [0] : ['A', 'B', 'C', 'D'].filter((next) => !been.includes(next) && road(at, next)).flatMap((next) => ways(next, [...been, next]).map((km) => km + road(at, next))));
  assert.equal(answer('Roads go A–B 4 km, B–C 3 km, A–C 9 km, C–D 2 km and B–D 7 km. How long is the shortest way from A to D?'), `${Math.min(...ways('A', ['A']))} km`);
  assert.equal(answer('How many bits are there in a kilobyte, taking 1 KB as 1,024 bytes?'), (1024 * 8).toLocaleString('en-US'));
  assert.equal(answer('In most programming languages, what is 17 % 5?'), String(17 % 5));
});

test('a program to read comes with its question, and each program’s question is learnt on its own', () => {
  const coded = QUESTION_BANKS.coding.filter((b) => b.code);
  const quiz = makeQuiz('coding', 3, QUESTION_BANKS.coding.length);
  const shown = quiz.questions.filter((ask) => ask.code);
  assert.equal(shown.length, coded.length);
  for (const ask of shown) assert.equal(ask.key, `${ask.q}\n${ask.code}`);
  assert.ok(makeQuiz('junior', 3, 5).questions.every((ask) => !ask.code && ask.key === ask.q), 'only the Coding Olympiad has programs');
  // The same words, a different program: learning one leaves the other.
  const [first, second] = coded;
  assert.equal(first.q, second.q);
  const book = cleanQuizBook({});
  for (let i = 0; i < LEARNT_AFTER; i++) fileQuizAnswer(book, 'coding', questionKey(first), true);
  assert.ok(isLearnt(book, 'coding', questionKey(first)));
  assert.ok(!isLearnt(book, 'coding', questionKey(second)));
  assert.deepEqual(cleanQuizBook(book).coding, { [questionKey(first)]: LEARNT_AFTER }, 'kept on the device as it is');
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
      const bank = QUESTION_BANKS[level].find((b) => questionKey(b) === ask.key);
      assert.ok(bank, `a question of the ${level} bank`);
      assert.equal(ask.q, bank.q);
      assert.equal(ask.code, bank.code);
      assert.equal(ask.choices[ask.answer], bank.a[0], 'where it says the right answer is, there it is');
      for (const choice of ask.choices) assert.ok(bank.a.includes(choice), 'no answer made up');
      assert.ok(!asked.has(ask.key), 'no question twice in one quiz');
      asked.add(ask.key);
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

test('every answer right pays a coin, two on the middle school and thinking-math quizzes, three on the high school ones and four on the Olympiads', () => {
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
  assert.equal(quizCoins(3, 'elementary1'), 3);
  assert.equal(quizCoins(3, 'elementary6'), 3);
  assert.equal(quizCoins(3, 'middle1'), 6);
  assert.equal(quizCoins(3, 'high3'), 9);
  assert.equal(quizCoins(3, 'olympiad'), 12);
  for (const key of ['science', 'logic', 'coding']) assert.equal(quizCoins(3, key), 12);
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
    for (const b of bank.slice(2)) book[level][questionKey(b)] = LEARNT_AFTER;
    for (let seed = 1; seed <= 20; seed++) {
      const quiz = makeQuiz(level, seed, 3, book);
      assert.deepEqual(quiz.questions.map((ask) => ask.key).sort(), [questionKey(bank[0]), questionKey(bank[1])].sort(), `${level}: only the questions left`);
    }
    assert.equal(makeQuiz(level, 4, 1, book).questions.length, 1);
    assert.deepEqual(quizProgress(book, level), { learnt: bank.length - 2, left: 2, total: bank.length });
    // A question on its way to learnt is still asked.
    book[level][questionKey(bank[0])] = LEARNT_AFTER - 1;
    assert.ok(makeQuiz(level, 2, 3, book).questions.some((ask) => ask.key === questionKey(bank[0])));
    // All learnt: nothing left to ask.
    for (const b of bank) book[level][questionKey(b)] = LEARNT_AFTER;
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
