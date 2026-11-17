// Quizzes, asked in classes at school and as Adventure Isle's key quizzes
// — every school year from Year 1 of elementary school to Year 3 of high
// school, a thinking-math one of puzzles to work out, the Math Olympiad's
// hardest puzzles and English Words — each a few questions picked and
// shuffled out of a bank of them, with the right answer never where it was
// written; coins for the answers got right, and the counts and stickers
// they earn. A question answered right three times in a row is learnt, and
// never asked again.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { XP_FOR } from '../public/js/shared/levels.js';
import { cleanQuizBook, fileQuizAnswer, isLearnt, LEARNT_AFTER, makeQuiz, QUESTION_BANKS, QUIZ_LEVELS, QUIZ_SIZE, quizCoins, quizProgress, SCHOOLS } from '../public/js/shared/quiz.js';
import { STAT_KEYS, STICKERS } from '../public/js/shared/stickers.js';

test('a quiz for every school year, from elementary school to high school, and three more, each with questions to spare', () => {
  // The two that came first keep their keys, for the quiz books that have them.
  assert.deepEqual(Object.keys(QUIZ_LEVELS), ['elementary1', 'junior', 'elementary3', 'elementary4', 'elementary5', 'elementary6', 'middle1', 'middle2', 'senior', 'high1', 'high2', 'high3', 'thinker', 'olympiad', 'english']);
  assert.deepEqual(
    Object.values(QUIZ_LEVELS).map((l) => l.name),
    [
      ...[1, 2, 3, 4, 5, 6].map((n) => `Elementary School Year ${n}`),
      ...[1, 2, 3].map((n) => `Middle School Year ${n}`),
      ...[1, 2, 3].map((n) => `High School Year ${n}`),
      'Thinking Math',
      'Math Olympiad',
      'English Words',
    ],
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
  const others = Object.values(QUIZ_LEVELS).filter((l) => !l.school);
  assert.deepEqual(
    others.map((l) => l.key),
    ['thinker', 'olympiad', 'english'],
  );
  const colors = [...SCHOOLS, ...others].map((l) => l.color);
  assert.equal(new Set(colors).size, colors.length);
  assert.ok(!colors.includes('green'));
  // The banks the years and the Olympiad have had added, as big as the
  // others or bigger: learnt questions go, so a bank wants plenty.
  for (const key of ['elementary1', 'elementary3', 'elementary4', 'elementary5', 'elementary6', 'middle1', 'middle2', 'high1', 'high2', 'high3']) assert.ok(QUESTION_BANKS[key].length >= 39, `${key} has plenty of questions`);
  assert.ok(QUESTION_BANKS.olympiad.length >= 30);
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

test('every answer right pays a coin, two on the middle school and thinking-math quizzes, three on the high school ones and four on the Math Olympiad', () => {
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
