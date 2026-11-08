// Extra-credit quizzes: a stage of Adventure Isle conquered, the fireworks still
// going, offers everyone who freed it a little school work for extra credit —
// quizzes to pick from, at elementary school second-year and third-year
// level, middle school third-year level and high school first-year level,
// a thinking-math one of puzzles to work out (patterns, logic, counting,
// shapes) in the style of Korea's thinking-math workbooks for young
// children, and English Words, each a single question with answers to pick
// from. An answer got right is extra credit: coins, XP and the counts that
// earn stickers (stickers.js), on top of what freeing the island already
// gave.
//
// The quizzes are each player's own, on their own page (the island has no
// hand in them, unlike the arcade's games): the island says it is won
// (game.js islandWon), and whoever was there is offered the quizzes for as
// long as they stay on the island — the 🎓 by the castle flag opens them —
// until they have done them all. Each quiz taken once, its question picked and its
// answers shuffled out of a bank by chance (makeQuiz), so two quizzes are
// seldom the same. A class at school (school.js) and a treasure chest's
// key quiz (treasure.js) ask from the same banks.
//
// Every answer is filed in your quiz book (cleanQuizBook): a question
// answered right LEARNT_AFTER times in a row, wherever it was asked, is
// learnt, and never asked of you again.
//
// The English Words quiz asks what words mean, out of the Kids Dictionary
// (english-words.js, brought in by scripts/dictionary.mjs): each question
// about one word, which the quiz shows with it, and its Korean meaning once
// it is answered.
import { ENGLISH_WORDS } from './english-words.js';
import { Rng } from './rng.js';

// The quizzes, by their keys, in the order they are offered: what each is
// called, its button's colour and how many coins each answer right pays.
export const QUIZ_LEVELS = {
  junior: {
    key: 'junior',
    icon: '🧒',
    name: 'Elementary School Year 2',
    how: 'One little question, like in Year 2 of elementary school. Get it right for a coin!',
    color: 'blue',
    coins: 1,
  },
  elementary3: {
    key: 'elementary3',
    icon: '🎒',
    name: 'Elementary School Year 3',
    how: 'One question, like in Year 3 of elementary school. Get it right for a coin!',
    color: 'orange',
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
  high1: {
    key: 'high1',
    icon: '📚',
    name: 'High School Year 1',
    how: 'One hard question, like in Year 1 of high school. Get it right for three coins!',
    color: 'teal',
    coins: 3,
  },
  thinker: {
    key: 'thinker',
    icon: '🐂',
    name: 'Thinking Math',
    how: 'One puzzle to think through: patterns, logic, counting and shapes. Work it out for two coins!',
    color: 'yellow',
    coins: 2,
  },
  english: {
    key: 'english',
    icon: '🔤',
    name: 'English Words',
    how: 'One question on what an English word means, from the Kids Dictionary. Get it right for a coin!',
    color: 'purple',
    coins: 1,
  },
};

// How many questions a quiz asks, out of its bank, and how long after the
// island is won that it is offered (the fireworks get their moment first).
export const QUIZ_SIZE = 1;
export const WIN_OFFER_MS = 2600;

// A coin for each answer right on the elementary school quizzes and English
// Words, two on the middle school and thinking-math ones, that much harder,
// and three on the high school one.
export const quizCoins = (right, level) => (Number.isFinite(right) && right > 0 ? Math.floor(right) * (QUIZ_LEVELS[level]?.coins ?? 1) : 0);

// The banks the questions come from. Each: { q: the question, a: its answers,
// the right one first, and pic: a picture to look at, if it has one } —
// makeQuiz shuffles the answers, so where the right one lands is never where
// it was written. A picture is rows of tiles, split at the spaces: an emoji,
// a number or a sign each, · for an empty tile, | for a mirror and ❓ for the
// tile to work out. The English Words questions have three answers each,
// and word: the word asked about ({ word, emoji, ko }).
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
  // Year 3 of elementary school: sums and take-aways into the hundreds,
  // times and sharing, remainders, fractions and tenths, lengths, time,
  // litres and grams; magnets, life cycles, solids, liquids and gases,
  // sound, the Earth and the Moon; a map's directions; and first English.
  elementary3: [
    { q: 'What is 356 + 278?', a: ['634', '624', '534', '644'] },
    { q: 'What is 503 − 248?', a: ['255', '355', '265', '345'] },
    { q: 'What is 24 × 3?', a: ['72', '62', '27', '612'] },
    { q: 'What is 56 ÷ 7?', a: ['8', '7', '9', '6'] },
    { q: 'What is 72 ÷ 3?', a: ['24', '23', '21', '26'] },
    { q: 'What is 125 × 4?', a: ['500', '400', '480', '520'] },
    { q: 'What is 23 × 12?', a: ['276', '266', '69', '286'] },
    { q: 'What is the remainder when 17 is divided by 5?', a: ['2', '3', '1', '12'] },
    { q: 'Which number has a 7 in the hundreds place?', a: ['4,723', '7,423', '4,273', '4,237'] },
    { q: '48 candies are shared equally among 6 children. How many does each child get?', a: ['8', '6', '42', '54'] },
    { q: 'A box holds 6 eggs. How many eggs are in 15 boxes?', a: ['90', '21', '80', '96'] },
    { q: 'What is 1/4 of 20?', a: ['5', '4', '16', '80'] },
    { q: 'Which fraction is the biggest?', a: ['1/3', '1/4', '1/5', '1/6'] },
    { q: 'A pizza is cut into 8 equal slices, and you eat 3 of them. What fraction of the pizza did you eat?', a: ['3/8', '5/8', '3/5', '1/8'] },
    { q: 'Which decimal is the same as 3/10?', a: ['0.3', '3.0', '0.03', '3.1'] },
    { q: 'Which decimal means 2 and 5 tenths?', a: ['2.5', '25', '0.25', '5.2'] },
    { q: 'How many millimetres are in 1 centimetre?', a: ['10', '100', '1000', '12'] },
    { q: 'How many metres are in 1 kilometre?', a: ['1000', '100', '10', '10000'] },
    { q: 'A ribbon is 1 m long, and you cut off 35 cm. How much is left?', a: ['65 cm', '75 cm', '35 cm', '1 m 35 cm'] },
    { q: 'A square’s sides are 7 cm each. How long are all four sides together?', a: ['28 cm', '21 cm', '49 cm', '14 cm'] },
    { q: 'A circle’s radius is 4 cm. How long is its diameter?', a: ['8 cm', '2 cm', '4 cm', '16 cm'] },
    { q: 'How many right angles does a rectangle have?', a: ['4', '2', '0', '1'] },
    { q: 'How many seconds is 1 minute 20 seconds?', a: ['80', '120', '70', '100'] },
    { q: 'What time is it 40 minutes after 2:30?', a: ['3:10', '2:70', '3:40', '2:10'] },
    { q: 'Ji-ho read from 1:50 to 3:15. How long did Ji-ho read?', a: ['1 hour 25 minutes', '1 hour 35 minutes', '2 hours 25 minutes', '1 hour 15 minutes'] },
    { q: 'How many millilitres are in 1 litre?', a: ['1000', '100', '10', '500'] },
    { q: 'How many grams are in 1 kilogram?', a: ['1000', '100', '10', '60'] },
    { q: 'Which tool tells you how heavy something is?', a: ['A scale', 'A ruler', 'A clock', 'A thermometer'] },
    { q: 'Which of these does a magnet pull?', a: ['An iron nail', 'A wooden pencil', 'A plastic cup', 'A rubber eraser'] },
    { q: 'What happens when you bring the N poles of two magnets close together?', a: ['They push each other away', 'They pull each other close', 'They melt', 'They change colour'] },
    { q: 'What does a caterpillar turn into?', a: ['A butterfly', 'A bee', 'A spider', 'A ladybug'] },
    { q: 'What is a baby frog called?', a: ['A tadpole', 'A cub', 'A chick', 'A calf'] },
    { q: 'Which of these animals hatches from an egg?', a: ['A turtle', 'A whale', 'A rabbit', 'A bat'] },
    { q: 'How many legs does an insect have?', a: ['6', '8', '4', '10'] },
    { q: 'Which of these keeps its own shape, whatever it is put in?', a: ['A stone', 'Water', 'Milk', 'Air'] },
    { q: 'Which of these is a gas?', a: ['The air in a balloon', 'An ice cube', 'Orange juice', 'A pebble'] },
    { q: 'Sound is made when something…', a: ['Shakes back and forth very fast', 'Gets very hot', 'Gets wet', 'Stays very still'] },
    { q: 'Which covers more of the Earth’s surface?', a: ['The sea', 'The land', 'Both the same', 'Ice'] },
    { q: 'Why can’t plants and animals live on the Moon?', a: ['It has no air or water', 'It is too small', 'It is made of cheese', 'It is too close to the Sun'] },
    { q: 'Rock worn into tiny bits by wind and running water becomes…', a: ['Sand and soil', 'Clouds', 'Ice', 'Air'] },
    { q: 'On most maps, which direction is at the top?', a: ['North', 'South', 'East', 'West'] },
    { q: 'You face north. Which direction is on your right?', a: ['East', 'West', 'South', 'North'] },
    { q: 'Which direction does the Sun rise in?', a: ['East', 'West', 'North', 'South'] },
    { q: 'What is the plural of “child”?', a: ['Children', 'Childs', 'Childes', 'Childrens'] },
    { q: 'Which word is a verb, a doing word?', a: ['Run', 'Table', 'Happy', 'Blue'] },
    { q: 'What is the past tense of “go”?', a: ['Went', 'Goed', 'Gone', 'Going'] },
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
  // Year 1 of high school: complex numbers, quadratics and their roots,
  // the remainder theorem and factoring, inequalities, counting, sets and
  // propositions, points, lines and circles, functions and their
  // inverses; forces and momentum, atoms and bonds, cells and DNA,
  // oxidation, acids and bases, ecosystems, energy and the universe;
  // Korean history; and English grammar.
  high1: [
    { q: 'What is i², where i is the imaginary unit?', a: ['−1', '1', 'i', '0'] },
    { q: 'What is (2 + i)(2 − i)?', a: ['5', '3', '4', '2i'] },
    { q: 'What is 1 ÷ i?', a: ['−i', 'i', '1', '−1'] },
    { q: 'Which equation has no real roots?', a: ['x² + x + 1 = 0', 'x² − 1 = 0', 'x² − 2x + 1 = 0', 'x² − 5x + 6 = 0'] },
    { q: 'The two roots of x² − 7x + 10 = 0 multiply to…', a: ['10', '7', '−7', '−10'] },
    { q: 'For which k does x² + 4x + k = 0 have just one root, a double root?', a: ['4', '2', '16', '−4'] },
    { q: 'Where is the vertex of y = (x − 3)² + 2?', a: ['(3, 2)', '(−3, 2)', '(3, −2)', '(2, 3)'] },
    { q: 'What is the largest value of y = −(x − 1)² + 5?', a: ['5', '1', '−5', '6'] },
    { q: 'What is the remainder when x³ − 2x + 5 is divided by x − 1?', a: ['4', '6', '5', '2'] },
    { q: 'Which is x³ − 8, factored?', a: ['(x − 2)(x² + 2x + 4)', '(x − 2)(x² − 2x + 4)', '(x − 2)³', '(x + 2)(x² − 2x + 4)'] },
    { q: 'What is (a + b)³, multiplied out?', a: ['a³ + 3a²b + 3ab² + b³', 'a³ + b³', 'a³ + 3ab + b³', 'a³ + a²b + ab² + b³'] },
    { q: 'Solve |x − 2| < 3', a: ['−1 < x < 5', 'x < 5', '−5 < x < 1', 'x < −1 or x > 5'] },
    { q: 'In how many ways can 4 runners come first, second and third?', a: ['24', '12', '4', '64'] },
    { q: 'In how many ways can you choose 2 of 5 students, if the order does not matter?', a: ['10', '20', '25', '7'] },
    { q: 'What is 5! (5 factorial)?', a: ['120', '25', '60', '15'] },
    { q: 'A = {1, 2, 3} and B = {2, 3, 4}. What is A ∩ B?', a: ['{2, 3}', '{1, 2, 3, 4}', '{1, 4}', '{1}'] },
    { q: 'How many subsets does the set {a, b, c} have?', a: ['8', '6', '3', '7'] },
    { q: 'What is the converse of “If it rains, the ground is wet”?', a: ['If the ground is wet, it rains', 'If it does not rain, the ground is not wet', 'If the ground is not wet, it does not rain', 'It rains and the ground is wet'] },
    { q: 'How far apart are the points (1, 2) and (4, 6)?', a: ['5', '7', '25', '√7'] },
    { q: 'What is the midpoint of (2, 3) and (6, 7)?', a: ['(4, 5)', '(8, 10)', '(2, 2)', '(3, 4)'] },
    { q: 'What is the radius of the circle x² + y² = 25?', a: ['5', '25', '12.5', '√5'] },
    { q: 'Where is the centre of the circle (x − 1)² + (y + 2)² = 9?', a: ['(1, −2)', '(−1, 2)', '(1, 2)', '(3, 3)'] },
    { q: 'Which line is perpendicular to y = 2x + 1?', a: ['y = −½x + 3', 'y = 2x − 3', 'y = −2x + 1', 'y = ½x + 1'] },
    { q: 'f(x) = 2x + 1 and g(x) = x². What is f(g(3))?', a: ['19', '49', '16', '7'] },
    { q: 'f(x) = 3x − 6. What is its inverse, f⁻¹(x)?', a: ['x/3 + 2', '3x + 6', 'x/3 − 2', '1/(3x − 6)'] },
    { q: 'A 2 kg cart is pushed with a force of 10 N. What is its acceleration?', a: ['5 m/s²', '20 m/s²', '12 m/s²', '0.2 m/s²'] },
    { q: 'Which of these is Newton’s third law?', a: ['Every action has an equal and opposite reaction', 'Force equals mass times acceleration', 'A body at rest stays at rest unless a force acts on it', 'Energy is never made or destroyed'] },
    { q: 'What is the momentum of a 3 kg ball moving at 4 m/s?', a: ['12 kg·m/s', '7 kg·m/s', '0.75 kg·m/s', '48 kg·m/s'] },
    { q: 'Why does an airbag make a crash less harmful?', a: ['It makes the stop take longer, so the force is smaller', 'It makes the car lighter', 'It makes the stop quicker', 'It speeds the car up'] },
    { q: 'What kind of bond holds sodium and chlorine together in table salt?', a: ['An ionic bond', 'A covalent bond', 'A metallic bond', 'A hydrogen bond'] },
    { q: 'How many electrons can an atom’s first shell hold?', a: ['2', '8', '1', '18'] },
    { q: 'Which element has the atomic number 6?', a: ['Carbon', 'Oxygen', 'Nitrogen', 'Helium'] },
    { q: 'In which group of the periodic table are the noble gases, like helium and neon?', a: ['Group 18', 'Group 1', 'Group 2', 'Group 17'] },
    { q: 'Which gas makes up most of the Earth’s air?', a: ['Nitrogen', 'Oxygen', 'Carbon dioxide', 'Argon'] },
    { q: 'In DNA, A pairs with T, and G pairs with…', a: ['C', 'A', 'T', 'U'] },
    { q: 'Where in a plant cell does photosynthesis happen?', a: ['In the chloroplasts', 'In the mitochondria', 'In the nucleus', 'In the cell wall'] },
    { q: 'Which part of a cell releases the energy in food?', a: ['The mitochondria', 'The chloroplasts', 'The ribosomes', 'The nucleus'] },
    { q: 'A substance that is oxidised…', a: ['Loses electrons', 'Gains electrons', 'Gains protons', 'Loses neutrons'] },
    { q: 'What is the pH of pure water at 25 °C?', a: ['7', '0', '1', '14'] },
    { q: 'An acid and a base react to make a salt and…', a: ['Water', 'Oxygen', 'Carbon dioxide', 'Hydrogen'] },
    { q: 'In the food chain grass → rabbit → fox, which is the producer?', a: ['The grass', 'The rabbit', 'The fox', 'The Sun'] },
    { q: 'Which of these makes electricity from a renewable source?', a: ['A wind turbine', 'A coal power station', 'An oil power station', 'A gas power station'] },
    { q: 'About how fast does light travel?', a: ['300,000 km a second', '300 km a second', '3,000 km a second', '30,000,000 km a second'] },
    { q: 'Which two elements did the Big Bang make most of?', a: ['Hydrogen and helium', 'Carbon and oxygen', 'Iron and nickel', 'Nitrogen and oxygen'] },
    { q: 'What forms where two continental plates push into each other?', a: ['High mountains, like the Himalayas', 'A mid-ocean ridge', 'A deep ocean trench', 'A rift valley'] },
    { q: 'In which year was Korea freed from Japanese rule?', a: ['1945', '1910', '1950', '1919'] },
    { q: 'Which kingdom first united most of the Korean Peninsula, in the 7th century?', a: ['Silla', 'Goguryeo', 'Baekje', 'Gaya'] },
    { q: 'Fill the gap: “If I ___ a bird, I would fly to you.”', a: ['were', 'am', 'will be', 'have been'] },
    { q: 'Which sentence is in the passive voice?', a: ['The cake was eaten by the dog.', 'The dog ate the cake.', 'The dog is eating the cake.', 'The dog has eaten the cake.'] },
    { q: 'Fill the gap: “This is the house ___ Jack built.”', a: ['that', 'who', 'what', 'where'] },
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
    // Puzzles in a picture: what fills the ❓, where a path ends, what a
    // mirror shows, how a pattern grows.
    { q: 'The beads go on in the same pattern. Which bead comes next?', pic: ['🔴 🔵 🔵 🔴 🔵 🔵 🔴 ❓'], a: ['🔵', '🔴', '🟡', '🟢'] },
    { q: 'The arrow keeps turning the same way. Which arrow comes next?', pic: ['⬆️ ➡️ ⬇️ ⬅️ ⬆️ ❓'], a: ['➡️', '⬅️', '⬇️', '⬆️'] },
    { q: 'Each row and each column has one of every shape. Which shape goes in the ❓?', pic: ['🔺 🟦 🟢 ⭐', '🟢 ⭐ 🔺 🟦', '🟦 🔺 ⭐ 🟢', '⭐ 🟢 🟦 ❓'], a: ['🔺', '🟦', '🟢', '⭐'] },
    { q: 'Which tile is missing from the pattern?', pic: ['🟥 🟨 🟥', '🟨 🟥 🟨', '🟥 🟨 ❓'], a: ['🟥', '🟨', '🟦', '🟩'] },
    { q: 'The line in the middle is a mirror. Which bead goes in the ❓?', pic: ['🔴 🟡 🔵 | 🔵 ❓ 🔴'], a: ['🟡', '🔴', '🔵', '🟢'] },
    { q: 'The line is a mirror. Which arrow do you see in it?', pic: ['↗️ | ❓'], a: ['↖️', '↗️', '↘️', '↙️'] },
    { q: 'Turn this arrow a quarter turn, the way a clock’s hands go. Which way does it point now?', pic: ['➡️'], a: ['⬇️', '⬆️', '⬅️', '➡️'] },
    { q: 'The clock shows the time now. What time will it be 5 hours from now?', pic: ['🕒'], a: ['8 o’clock', '7 o’clock', '9 o’clock', '5 o’clock'] },
    { q: 'Start on the 🐭. Go 2 right, 2 down, then 1 left. Where do you land?', pic: ['🐭 🍎 🍌', '🍇 🍓 🍒', '🥝 🍑 🍋'], a: ['🍑', '🍋', '🍓', '🍒'] },
    { q: 'How many more cats than dogs are there?', pic: ['🐱 🐶 🐱 🐱', '🐶 🐱 🐱 🐶', '🐱 🐱 🐶 🐱'], a: ['4', '8', '3', '12'] },
    { q: 'This staircase is 3 steps tall. How many blocks does a staircase 5 steps tall need?', pic: ['🟫 · ·', '🟫 🟫 ·', '🟫 🟫 🟫'], a: ['15', '10', '12', '25'] },
    { q: 'The squares of dots grow: 1, then 4, then 9. How many dots are in the next one?', pic: ['· · · · · 🔵 🔵 🔵', '· · 🔵 🔵 · 🔵 🔵 🔵', '🔵 · 🔵 🔵 · 🔵 🔵 🔵'], a: ['16', '12', '15', '25'] },
    { q: 'Both sides of each balance weigh the same. How many 🍌 weigh as much as two 🍍?', pic: ['🍌 🍌 🍌 = 🍍', '🍍 🍍 = ❓'], a: ['6', '5', '3', '9'] },
    { q: 'Each fruit stands for a number. What is 🍇?', pic: ['🍎 + 🍎 = 10', '🍎 + 🍌 = 8', '🍌 + 🍇 = 7'], a: ['4', '3', '5', '7'] },
    { q: 'Each number is the two under it added up. What goes in the ❓ at the top?', pic: ['· · ❓ · ·', '· 5 · 7 ·', '2 · 3 · 4'], a: ['12', '10', '14', '9'] },
    { q: 'The moon grows a little each night. Which comes next?', pic: ['🌑 🌒 🌓 🌔 ❓'], a: ['🌕', '🌑', '🌘', '🌗'] },
  ],
  // Every word's quiz, but a question two words ask alike (“What is a
  // diamond?” on diamond and on jewelry) only the first time.
  english: ENGLISH_WORDS.flatMap(({ word, emoji, ko, quiz }) => quiz.map(({ q, a }) => ({ q, a, word: { word, emoji, ko } }))).filter((b, i, all) => all.findIndex((o) => o.q === b.q) === i),
};

// How many times in a row a question must be answered right to be learnt:
// after that it is never asked of you again.
export const LEARNT_AFTER = 3;

// Each bank's questions, to know a question of it when one is filed.
const ASKED = Object.fromEntries(Object.entries(QUESTION_BANKS).map(([level, bank]) => [level, new Set(bank.map((b) => b.q))]));

// Your quiz book: each quiz's questions you have been getting right, with
// how many times in a row, and the ones learnt (LEARNT_AFTER times):
// { [level]: { [question]: times right in a row } }. Kept on this device
// for whoever is playing (game.js, storage.js), like the Study Desk's
// notebook; a question no longer in its bank is let go.
export function cleanQuizBook(raw) {
  const out = {};
  for (const level of Object.keys(QUIZ_LEVELS)) {
    const page = raw?.[level];
    out[level] = {};
    if (!page || typeof page !== 'object') continue;
    for (const [q, n] of Object.entries(page)) if (ASKED[level].has(q) && Number.isInteger(n) && n >= 1) out[level][q] = Math.min(n, LEARNT_AFTER);
  }
  return out;
}

// An answer filed in the quiz book: one more time right in a row, or, got
// wrong, back to none. Returns true when it was the answer that learnt
// the question.
export function fileQuizAnswer(book, level, q, right) {
  if (!ASKED[level]?.has(q)) return false;
  const page = (book[level] ??= {});
  const before = page[q] ?? 0;
  if (before >= LEARNT_AFTER) return false;
  if (!right) {
    delete page[q];
    return false;
  }
  page[q] = before + 1;
  return page[q] >= LEARNT_AFTER;
}

// Whether a question is learnt, never to be asked again.
export const isLearnt = (book, level, q) => (book?.[level]?.[q] ?? 0) >= LEARNT_AFTER;

// How far along a quiz is: { learnt, left, total } of its questions.
export function quizProgress(book, level) {
  const bank = QUESTION_BANKS[QUIZ_LEVELS[level]?.key] ?? [];
  const learnt = bank.reduce((n, b) => n + (isLearnt(book, level, b.q) ? 1 : 0), 0);
  return { learnt, left: bank.length - learnt, total: bank.length };
}

// A quiz of a level, `size` questions picked out of the bank and shuffled, and
// each one's answers shuffled with them: { level, questions: [{ q, choices,
// answer }] }, answer the place in choices the right one landed. Never a
// question learnt in `book` (your quiz book), so a quiz of a level all
// learnt asks nothing, and one nearly so fewer than `size`. The same seed
// and book make the same quiz, so a page put right can say what was asked.
export function makeQuiz(level, seed = 1, size = QUIZ_SIZE, book = null) {
  const bank = QUESTION_BANKS[QUIZ_LEVELS[level]?.key];
  if (!bank) return { level, questions: [] };
  const rng = new Rng(seed);
  const picks = [];
  const left = [...bank.keys()].filter((i) => !isLearnt(book, level, bank[i].q));
  for (let i = 0, n = Math.min(size, left.length); i < n; i++) {
    const at = Math.floor(rng.next() * left.length);
    picks.push(bank[left.splice(at, 1)[0]]);
  }
  return {
    level,
    questions: picks.map(({ q, pic, word, a }) => {
      const choices = [...a];
      // The answers go where they land, and the right one (written first)
      // remembers where that was.
      for (let i = choices.length - 1; i > 0; i--) {
        const j = Math.floor(rng.next() * (i + 1));
        [choices[i], choices[j]] = [choices[j], choices[i]];
      }
      return { q, ...(pic && { pic }), ...(word && { word }), choices, answer: choices.indexOf(a[0]) };
    }),
  };
}
