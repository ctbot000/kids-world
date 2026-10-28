// Extra-credit quizzes: an adventure island conquered, the fireworks still
// going, offers everyone who freed it a little school work for extra credit —
// three quizzes to pick from, one at elementary school second-year level,
// one at middle school third-year level, and a thinking-math one of puzzles
// to work out (patterns, logic, counting, shapes) in the style of Korea's
// thinking-math workbooks for young children, each a single question with
// answers to pick from. An answer got right is extra credit: coins, XP and the
// counts that earn stickers (stickers.js), on top of what freeing the island
// already gave.
//
// The quizzes are each player's own, on their own page (the island has no
// hand in them, unlike the arcade's games): the island says it is won
// (game.js islandWon), and whoever was there is offered the quizzes for as
// long as they stay on the island — the 🎓 by the castle flag opens them —
// until they have done them all. Each quiz taken once, its question picked and its
// answers shuffled out of a bank by chance (makeQuiz), so two quizzes are
// seldom the same. A class at school (school.js) asks from the same banks.
import { Rng } from './rng.js';

// The quizzes, by their keys: what each is called, its button's colour and
// how many coins each answer right pays.
export const QUIZ_LEVELS = {
  junior: {
    key: 'junior',
    icon: '🧒',
    name: 'Elementary School Year 2',
    how: 'One little question, like in Year 2 of elementary school. Get it right for a coin!',
    color: 'blue',
    coins: 1,
  },
  senior: {
    key: 'senior',
    icon: '🧑‍🎓',
    name: 'Middle School Year 3',
    how: 'One harder question, like in Year 3 of middle school. Get it right for two coins!',
    color: 'pink',
    coins: 2,
  },
  thinker: {
    key: 'thinker',
    icon: '🐂',
    name: 'Thinking Math',
    how: 'One puzzle to think through: patterns, logic, counting and shapes. Work it out for two coins!',
    color: 'yellow',
    coins: 2,
  },
};

// How many questions a quiz asks, out of its bank, and how long after the
// island is won that it is offered (the fireworks get their moment first).
export const QUIZ_SIZE = 1;
export const WIN_OFFER_MS = 2600;

// A coin for each answer right on the elementary quiz, two on the middle
// school and thinking-math ones, that much harder.
export const quizCoins = (right, level) => (Number.isFinite(right) && right > 0 ? Math.floor(right) * (QUIZ_LEVELS[level]?.coins ?? 1) : 0);

// The banks the questions come from. Each: { q: the question, a: its answers,
// the right one first } — makeQuiz shuffles the answers, so where the right
// one lands is never where it was written.
export const QUESTION_BANKS = {
  junior: [
    { q: 'What is 7 + 8?', a: ['15', '13', '14', '16'] },
    { q: 'What is 12 − 5?', a: ['7', '6', '8', '5'] },
    { q: 'How many legs does a spider have?', a: ['8', '6', '4', '10'] },
    { q: 'Which word rhymes with “cat”?', a: ['hat', 'dog', 'sun', 'cup'] },
    { q: 'Which shape has three sides?', a: ['A triangle', 'A square', 'A circle', 'A rectangle'] },
    { q: 'How many days are there in a week?', a: ['7', '5', '6', '10'] },
    { q: 'What do bees make?', a: ['Honey', 'Milk', 'Bread', 'Butter'] },
    { q: 'What colour do blue and yellow make together?', a: ['Green', 'Purple', 'Orange', 'Pink'] },
    { q: 'Count by twos: 2, 4, 6, … what comes next?', a: ['8', '7', '9', '10'] },
    { q: 'Which animal says “moo”?', a: ['A cow', 'A sheep', 'A duck', 'A horse'] },
    { q: 'How many sides does a square have?', a: ['4', '3', '5', '6'] },
    { q: 'Which season comes after winter?', a: ['Spring', 'Summer', 'Autumn', 'Winter again'] },
    { q: 'What is half of 10?', a: ['5', '4', '6', '2'] },
    { q: 'Which number is the biggest?', a: ['21', '12', '18', '9'] },
    { q: 'What is 10 + 10?', a: ['20', '11', '100', '19'] },
    { q: 'What is 9 − 3?', a: ['6', '5', '7', '12'] },
    { q: 'What is 5 + 6?', a: ['11', '10', '12', '56'] },
    { q: 'How many months are there in a year?', a: ['12', '10', '7', '24'] },
    { q: 'Which is the opposite of “hot”?', a: ['Cold', 'Warm', 'Big', 'Wet'] },
    { q: 'What is 3 × 2?', a: ['6', '5', '9', '32'] },
    { q: 'Which animal can fly?', a: ['A bird', 'A fish', 'A pig', 'A dog'] },
    { q: 'What do we call a baby cat?', a: ['A kitten', 'A puppy', 'A calf', 'A chick'] },
    { q: 'How many minutes are there in an hour?', a: ['60', '100', '30', '24'] },
    { q: 'Which word starts with the letter B?', a: ['Ball', 'Apple', 'Cat', 'Duck'] },
    { q: 'Count by fives: 5, 10, 15, … what comes next?', a: ['20', '16', '25', '18'] },
  ],
  senior: [
    { q: 'Solve for x: 3x = 27', a: ['9', '3', '6', '81'] },
    { q: 'What is the square root of 144?', a: ['12', '14', '24', '72'] },
    { q: 'What is the chemical symbol for iron?', a: ['Fe', 'Ir', 'In', 'Fr'] },
    { q: 'Which planet is closest to the Sun?', a: ['Mercury', 'Venus', 'Earth', 'Mars'] },
    { q: 'In the Pythagorean theorem, a² + b² equals…', a: ['c²', '2c', 'a × b', 'a + b'] },
    { q: 'What is 15% of 200?', a: ['30', '15', '25', '35'] },
    { q: 'Which gas do plants take in for photosynthesis?', a: ['Carbon dioxide', 'Oxygen', 'Nitrogen', 'Hydrogen'] },
    { q: 'What is the slope of the line y = 2x + 3?', a: ['2', '3', '5', 'x'] },
    { q: 'Who wrote “Romeo and Juliet”?', a: ['William Shakespeare', 'Charles Dickens', 'Jane Austen', 'Mark Twain'] },
    { q: 'Solve: x² = 49, with x greater than 0', a: ['7', '49', '24.5', '14'] },
    { q: 'What is (x + 2)(x − 2)?', a: ['x² − 4', 'x² + 4', 'x² − 2x − 4', 'x² + 2x − 4'] },
    { q: 'Which is the largest ocean on Earth?', a: ['The Pacific Ocean', 'The Atlantic Ocean', 'The Indian Ocean', 'The Arctic Ocean'] },
    { q: 'What force pulls everything toward Earth?', a: ['Gravity', 'Magnetism', 'Friction', 'Electricity'] },
    { q: 'What is the value of π to two decimal places?', a: ['3.14', '3.41', '3.12', '3.31'] },
    { q: 'Which of these is a prime number?', a: ['17', '15', '21', '27'] },
    { q: 'What is −3 × −4?', a: ['12', '−12', '−7', '7'] },
    { q: 'What is the boiling point of water at sea level, in °C?', a: ['100', '90', '212', '50'] },
    { q: 'Which part of a cell holds its DNA?', a: ['The nucleus', 'The cell wall', 'The membrane', 'The vacuole'] },
    { q: 'What is 2 to the power of 5?', a: ['32', '10', '25', '64'] },
    { q: 'How many degrees are there in the angles of a triangle, added up?', a: ['180', '90', '360', '270'] },
    { q: 'Which is the smallest particle of an element that is still that element?', a: ['An atom', 'A molecule', 'A cell', 'A crystal'] },
    { q: 'Solve for x: 2x + 5 = 17', a: ['6', '11', '7', '8.5'] },
    { q: 'Which planet is known as the Red Planet?', a: ['Mars', 'Jupiter', 'Venus', 'Saturn'] },
    { q: 'What is the mean of 4, 6 and 8?', a: ['6', '18', '4', '8'] },
    { q: 'Light travels fastest through…', a: ['A vacuum', 'Water', 'Glass', 'Air'] },
  ],
  // Puzzles to think through rather than facts to remember: each takes a
  // step or two of reasoning, and the wrong answers are the slips a child
  // makes on the way (counting the gaps instead of the trees, and so on).
  thinker: [
    { q: 'Mia is taller than Leo, and Leo is taller than Sam. Who is the shortest?', a: ['Sam', 'Leo', 'Mia', 'You can’t tell'] },
    { q: 'What comes next: 1, 2, 4, 7, 11, …?', a: ['16', '15', '14', '18'] },
    { q: 'What comes next: 1, 1, 2, 3, 5, 8, …?', a: ['13', '11', '12', '16'] },
    { q: 'A frog is at the bottom of a 5 m well. Each day it climbs up 3 m, and each night it slips back 2 m. On which day does it get out?', a: ['Day 3', 'Day 5', 'Day 4', 'Day 2'] },
    { q: 'Cutting a log takes 3 minutes a cut. How long does it take to cut the log into 4 pieces?', a: ['9 minutes', '12 minutes', '3 minutes', '15 minutes'] },
    { q: 'Trees are planted 2 m apart along a 10 m path, one at each end too. How many trees are there?', a: ['6', '5', '10', '4'] },
    { q: 'In 3 years Jin will be 10. How old was Jin 3 years ago?', a: ['4', '7', '10', '13'] },
    { q: 'A yard has chickens and dogs: 5 heads and 14 legs in all. How many dogs are there?', a: ['2', '3', '4', '5'] },
    { q: 'Two numbers add up to 10, and one is 4 more than the other. What is the bigger one?', a: ['7', '6', '8', '14'] },
    { q: 'A square is cut once across and once down the middle. How many squares can you find, big ones too?', a: ['5', '4', '2', '6'] },
    { q: 'Today is Monday. What day will it be in 10 days?', a: ['Thursday', 'Wednesday', 'Friday', 'Tuesday'] },
    { q: 'Ben has 3 shirts and 2 pairs of pants. How many different outfits can he wear?', a: ['6', '5', '3', '9'] },
    { q: 'With the cards 1, 2 and 3, how many two-digit numbers can you make, using a card once in a number?', a: ['6', '9', '3', '4'] },
    { q: 'A clock rings 3 times at 3 o’clock, taking 2 seconds from the first ring to the last. How long does it take to ring 6 times at 6 o’clock?', a: ['5 seconds', '4 seconds', '6 seconds', '3 seconds'] },
    { q: 'Writing the numbers from 1 to 20, how many times do you write the digit 1?', a: ['12', '11', '10', '9'] },
    { q: 'Hana stands in a line with 4 children in front of her and 5 behind her. How many children are in the line?', a: ['10', '9', '11', '8'] },
    { q: 'Jun is 4th from the front and 4th from the back of a line. How many children are in the line?', a: ['7', '8', '9', '6'] },
    { q: 'Ari and Bo share 12 candies, and Ari gets 2 more than Bo. How many does Bo get?', a: ['5', '6', '7', '4'] },
    { q: 'The shapes go ○ △ □ ○ △ □ … over and over. What is the 14th shape?', a: ['△', '○', '□', '☆'] },
    { q: 'Four friends each shake hands with each other once. How many handshakes is that?', a: ['6', '4', '8', '12'] },
    { q: '□ + □ + □ = 15 and □ + △ = 9. What is △?', a: ['4', '5', '3', '9'] },
    { q: 'On a dice, opposite faces always add up to 7. Which number is opposite the 2?', a: ['5', '4', '6', '3'] },
    { q: 'You cut one corner off a rectangle with a straight cut. How many corners does the shape have now?', a: ['5', '3', '4', '6'] },
    { q: 'At a stop, 3 people got off a bus and 5 got on. Now there are 12 on the bus. How many were on it before the stop?', a: ['10', '14', '12', '4'] },
    { q: '2 apples weigh as much as 1 melon, and 1 melon weighs as much as 4 oranges. How many oranges weigh as much as 1 apple?', a: ['2', '4', '8', '1'] },
    { q: 'Which number does not belong: 2, 4, 7, 8, 10?', a: ['7', '2', '8', '10'] },
    { q: 'Fold a paper in half, then in half again, and punch one hole through all the layers. How many holes are there when you open it?', a: ['4', '2', '1', '8'] },
    { q: 'How many ways can you make 10¢ with only 5¢ and 1¢ coins?', a: ['3', '2', '4', '10'] },
    { q: 'Lily ate half of her cookies, then 1 more, and 3 were left. How many cookies did she have to begin with?', a: ['8', '6', '7', '10'] },
    { q: 'How many squares are there on a 3 by 3 board, counting the bigger ones too?', a: ['14', '9', '10', '13'] },
    { q: 'A triangle has a line drawn from one corner to the opposite side. How many triangles can you find?', a: ['3', '2', '4', '1'] },
    { q: 'A hen lays 1 egg a day. How many eggs do 3 hens lay in 3 days?', a: ['9', '3', '6', '1'] },
  ],
};

// A quiz of a level, `size` questions picked out of the bank and shuffled, and
// each one's answers shuffled with them: { level, questions: [{ q, choices,
// answer }] }, answer the place in choices the right one landed. The same
// seed makes the same quiz, so a page put right can say what was asked.
export function makeQuiz(level, seed = 1, size = QUIZ_SIZE) {
  const bank = QUESTION_BANKS[QUIZ_LEVELS[level]?.key];
  if (!bank) return { level, questions: [] };
  const rng = new Rng(seed);
  const picks = [];
  const left = [...bank.keys()];
  for (let i = 0; i < Math.min(size, bank.length); i++) {
    const at = Math.floor(rng.next() * left.length);
    picks.push(bank[left.splice(at, 1)[0]]);
  }
  return {
    level,
    questions: picks.map(({ q, a }) => {
      const choices = [...a];
      // The answers go where they land, and the right one (written first)
      // remembers where that was.
      for (let i = choices.length - 1; i > 0; i--) {
        const j = Math.floor(rng.next() * (i + 1));
        [choices[i], choices[j]] = [choices[j], choices[i]];
      }
      return { q, choices, answer: choices.indexOf(a[0]) };
    }),
  };
}
