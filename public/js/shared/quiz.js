// Quizzes: a little school work, for every school year from Year 1 of
// elementary school to Year 3 of high school; the Olympiads, the hardest
// of all, like a contest's, in maths, science, logic, coding, chess, the
// world (geography and history) and English; a
// thinking-math one of puzzles to work out (patterns, logic, counting,
// shapes) in the style of Korea's thinking-math workbooks for young
// children; and English Words, each question with answers to pick from. They are asked in classes at school
// (school.js), for coins, and on Adventure Isle as key quizzes: one
// question, one try, for each camp you help free (a key to a treasure
// chest, treasure.js) and for each stage you help win (a golden key) —
// game.js offerKeyQuiz.
//
// The quizzes are each player's own, on their own page (the island has no
// hand in them, unlike the arcade's games), their questions picked and
// their answers shuffled out of a bank by chance (makeQuiz), so two quizzes
// are seldom the same.
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

// The schools, in order, and their years: a school year's quiz takes its
// icon, its buttons' colour and what an answer right pays from its school
// (a coin at elementary school, two at middle school, three at high
// school).
export const SCHOOLS = [
  { key: 'elementary', icon: '🎒', name: 'Elementary School', color: 'blue', coins: 1, years: 6 },
  { key: 'middle', icon: '🧑‍🎓', name: 'Middle School', color: 'pink', coins: 2, years: 3 },
  { key: 'high', icon: '📚', name: 'High School', color: 'teal', coins: 3, years: 3 },
];

// A school year's quiz, by its key (Year 2 of elementary school and Year 3
// of middle school keep the keys they had when they were the only two).
function yearQuiz(key, school, year) {
  const s = SCHOOLS.find((x) => x.key === school);
  const pays = s.coins === 1 ? 'a coin' : `${s.coins} coins`;
  return { key, school, year, icon: s.icon, name: `${s.name} Year ${year}`, how: `One question, like in Year ${year} of ${s.name.toLowerCase()}. Get it right for ${pays}!`, color: s.color, coins: s.coins };
}

// The Olympiads, the hardest quizzes of all, each a contest's puzzles in
// one subject, and each answer right worth four coins. Their buttons are
// the Olympiads' colour, each with its subject's icon.
export const OLYMPIADS = { icon: '🏆', name: 'Olympiads', color: 'orange', coins: 4 };

// An Olympiad's quiz, by its key (the Math Olympiad keeps the one it had
// when it was the only one).
function olympiadQuiz(key, icon, subject, how) {
  return { key, olympiad: true, short: subject, icon, name: `${subject} Olympiad`, how: `${how} Work one out for four coins!`, color: OLYMPIADS.color, coins: OLYMPIADS.coins };
}

// The quizzes, by their keys, in the order they are offered: the school
// years (school, year), the Olympiads (olympiad, and short: the subject),
// then the other quizzes. Each says what it is called, its button's colour
// and how many coins each answer right pays.
export const QUIZ_LEVELS = {
  elementary1: yearQuiz('elementary1', 'elementary', 1),
  junior: yearQuiz('junior', 'elementary', 2),
  elementary3: yearQuiz('elementary3', 'elementary', 3),
  elementary4: yearQuiz('elementary4', 'elementary', 4),
  elementary5: yearQuiz('elementary5', 'elementary', 5),
  elementary6: yearQuiz('elementary6', 'elementary', 6),
  middle1: yearQuiz('middle1', 'middle', 1),
  middle2: yearQuiz('middle2', 'middle', 2),
  senior: yearQuiz('senior', 'middle', 3),
  high1: yearQuiz('high1', 'high', 1),
  high2: yearQuiz('high2', 'high', 2),
  high3: yearQuiz('high3', 'high', 3),
  olympiad: olympiadQuiz('olympiad', '🧮', 'Math', 'The hardest maths puzzles, like in a maths contest.'),
  science: olympiadQuiz('science', '🔬', 'Science', 'Hard puzzles of physics, chemistry, life and space, like in a science contest.'),
  logic: olympiadQuiz('logic', '🧠', 'Logic', 'Brain-twisters: liars and truth-tellers, weighings, river crossings and tricky reasoning.'),
  coding: olympiadQuiz('coding', '💻', 'Coding', 'What a little program prints, binary, logic gates, stacks and queues, like in a coding contest.'),
  chess: olympiadQuiz('chess', '♟️', 'Chess', 'A chess position, and the move that is checkmate.'),
  world: olympiadQuiz('world', '🌏', 'World', 'The world’s lands, seas and cities, and its history and Korea’s, the hard parts.'),
  englisholympiad: olympiadQuiz('englisholympiad', '📝', 'English', 'Hard words, idioms, tricky grammar and word puzzles.'),
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

// How many questions a key quiz asks, out of its bank, and how long after
// the island is won the golden key's is offered (the fireworks get their
// moment first).
export const QUIZ_SIZE = 1;
export const WIN_OFFER_MS = 2600;

// A coin for each answer right on the elementary school quizzes and English
// Words, two on the middle school and thinking-math ones, that much harder,
// three on the high school ones and four on the Olympiads.
export const quizCoins = (right, level) => (Number.isFinite(right) && right > 0 ? Math.floor(right) * (QUIZ_LEVELS[level]?.coins ?? 1) : 0);

// The banks the questions come from. Each: { q: the question, a: its answers,
// the right one first, and pic: a picture to look at, code: a program to
// read or fen: a chess position, if it has one } — makeQuiz shuffles the
// answers, so where the right one lands is never where it was written. A picture is rows of tiles, split
// at the spaces: an emoji, a number or a sign each, · for an empty tile, |
// for a mirror and ❓ for the tile to work out. The English Words questions
// have three answers each, and word: the word asked about ({ word, emoji,
// ko }).
export const QUESTION_BANKS = {
  // Year 1 of elementary school: adding and taking away up to 20, numbers
  // to 100, tens and ones, counting on, shapes, longer and heavier, o'clock
  // and half past, days and seasons, and the world around you.
  elementary1: [
    { q: 'What is 3 + 4?', a: ['7', '6', '8', '34'] },
    { q: 'What is 9 − 5?', a: ['4', '5', '3', '14'] },
    { q: 'What is 6 + 6?', a: ['12', '11', '13', '66'] },
    { q: 'What is 10 − 3?', a: ['7', '6', '8', '13'] },
    { q: 'What is 8 + 5?', a: ['13', '12', '14', '3'] },
    { q: 'What is 15 − 4?', a: ['11', '19', '10', '12'] },
    { q: 'What is 2 + 2 + 2?', a: ['6', '4', '8', '222'] },
    { q: 'Which is the same as 10?', a: ['6 + 4', '6 + 3', '5 + 4', '7 + 4'] },
    { q: 'You have 5 candies and eat 2. How many are left?', a: ['3', '7', '2', '4'] },
    { q: 'There are 4 ducks on a pond, and 3 more swim over. How many ducks are there now?', a: ['7', '1', '6', '43'] },
    { q: 'Which number comes right after 39?', a: ['40', '30', '38', '49'] },
    { q: 'Which number comes just before 70?', a: ['69', '71', '60', '79'] },
    { q: 'Which number is the smallest?', a: ['19', '91', '29', '23'] },
    { q: 'How many tens are there in 50?', a: ['5', '50', '10', '0'] },
    { q: 'Which number is 3 tens and 4 ones?', a: ['34', '43', '7', '304'] },
    { q: 'Count by tens: 10, 20, 30, … what comes next?', a: ['40', '31', '50', '300'] },
    { q: 'Count by twos: 12, 14, 16, … what comes next?', a: ['18', '17', '20', '26'] },
    { q: 'How many apples are there?', pic: ['🍎 🍎 🍎', '🍎 🍎 🍎', '🍎 🍎 ·'], a: ['8', '9', '7', '6'] },
    { q: 'What comes next?', pic: ['🔴 🔵 🔴 🔵 🔴 ❓'], a: ['🔵', '🔴', '🟢', '🟡'] },
    { q: 'Which shape has no corners?', a: ['A circle', 'A triangle', 'A square', 'A rectangle'] },
    { q: 'How many corners does a triangle have?', a: ['3', '4', '0', '6'] },
    { q: 'Which of these rolls best?', a: ['A ball', 'A box', 'A book', 'A brick'] },
    { q: 'Which is the longest?', a: ['A bus', 'A pencil', 'A spoon', 'A shoe'] },
    { q: 'Which is the heaviest?', a: ['An elephant', 'A mouse', 'A cat', 'A rabbit'] },
    { q: 'The short hand points to 3 and the long hand to 12. What time is it?', a: ['3 o’clock', '12 o’clock', 'Half past 3', '3:12'] },
    { q: 'The short hand is between 7 and 8, and the long hand points to 6. What time is it?', a: ['Half past 7', 'Half past 8', '6 o’clock', '7 o’clock'] },
    { q: 'Which day comes after Tuesday?', a: ['Wednesday', 'Monday', 'Thursday', 'Sunday'] },
    { q: 'Which season is the hottest?', a: ['Summer', 'Winter', 'Spring', 'Autumn'] },
    { q: 'In which season do leaves turn red and yellow and fall?', a: ['Autumn', 'Spring', 'Summer', 'Winter'] },
    { q: 'What do we hear with?', a: ['Our ears', 'Our eyes', 'Our nose', 'Our hands'] },
    { q: 'How many fingers are there on two hands?', a: ['10', '5', '8', '20'] },
    { q: 'Which word is the opposite of “big”?', a: ['Small', 'Tall', 'Long', 'Round'] },
    { q: 'What colour is a ripe banana?', a: ['Yellow', 'Blue', 'Purple', 'Black'] },
    { q: 'Which animal lives in the sea?', a: ['A dolphin', 'A lion', 'A horse', 'A squirrel'] },
    { q: 'Which one is a fruit?', a: ['A grape', 'A carrot', 'A potato', 'An onion'] },
    { q: 'What do plants need to grow?', a: ['Water and sunlight', 'Candy and juice', 'Only darkness', 'Toys and games'] },
    { q: 'Which letter comes after C?', a: ['D', 'B', 'E', 'F'] },
    { q: 'How many wheels does a bicycle have?', a: ['2', '3', '4', '1'] },
    { q: 'Which coin is worth the most?', a: ['500 won', '100 won', '50 won', '10 won'] },
  ],
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
  // Year 4 of elementary school: big numbers, times and sharing by two
  // digits, fractions and decimals added and taken away, angles,
  // triangles, parallel and perpendicular lines, four-sided shapes and
  // number rules; springs, mixtures, volcanoes and fossils, water and its
  // states, shadows and mirrors; scale and contour lines on a map.
  elementary4: [
    { q: 'What is 325 × 14?', a: ['4,550', '4,450', '1,625', '4,560'] },
    { q: 'What is 864 ÷ 24?', a: ['36', '34', '38', '46'] },
    { q: 'What is 520 ÷ 13?', a: ['40', '4', '400', '41'] },
    { q: 'What is 15 × 40?', a: ['600', '60', '6,000', '550'] },
    { q: 'How many zeros does one million have?', a: ['6', '5', '7', '8'] },
    { q: 'Which number is ten thousand?', a: ['10,000', '1,000', '100,000', '1,000,000'] },
    { q: 'In 4,725,000, what is the 7 worth?', a: ['700,000', '7,000', '70,000', '7,000,000'] },
    { q: 'What is the largest number you can make with the cards 3, 8, 1 and 6, using each card once?', a: ['8,631', '8,613', '1,368', '8,361'] },
    { q: 'What is 3,847 rounded to the nearest hundred?', a: ['3,800', '3,900', '3,850', '4,000'] },
    { q: 'What is 2/7 + 3/7?', a: ['5/7', '5/14', '6/7', '1/7'] },
    { q: 'What is 1 − 3/8?', a: ['5/8', '3/8', '2/8', '4/8'] },
    { q: 'Which is the same as 1 and 2/5?', a: ['7/5', '12/5', '3/5', '5/7'] },
    { q: 'What is 0.45 + 0.3?', a: ['0.75', '0.48', '0.78', '7.5'] },
    { q: 'What is 3.2 − 1.45?', a: ['1.75', '2.25', '1.85', '2.75'] },
    { q: 'How many degrees is a right angle?', a: ['90°', '45°', '180°', '360°'] },
    { q: 'What kind of angle is 120°?', a: ['Obtuse', 'Acute', 'Right', 'Straight'] },
    { q: 'Two angles of a triangle are 50° and 60°. What is the third?', a: ['70°', '110°', '80°', '90°'] },
    { q: 'What is a triangle with all three sides the same length called?', a: ['Equilateral', 'Isosceles', 'Right-angled', 'Obtuse'] },
    { q: 'Which shape has exactly one pair of parallel sides?', a: ['A trapezoid', 'A parallelogram', 'A rectangle', 'A rhombus'] },
    { q: 'How many diagonals does a pentagon have?', a: ['5', '2', '10', '3'] },
    { q: 'What are lines that never meet, however far they go, called?', a: ['Parallel lines', 'Perpendicular lines', 'Crossing lines', 'Curved lines'] },
    { q: 'What are two lines that meet at a right angle called?', a: ['Perpendicular', 'Parallel', 'Curved', 'Equal'] },
    { q: 'The numbers go 2, 5, 8, 11, … What is the 10th number?', a: ['29', '30', '32', '26'] },
    { q: 'How many hours are 300 minutes?', a: ['5', '3', '30', '50'] },
    { q: 'A spring stretches 2 cm for every 10 g hung on it. How far does it stretch with 50 g?', a: ['10 cm', '5 cm', '25 cm', '52 cm'] },
    { q: 'Which of these can a magnet pull out of sand?', a: ['Iron filings', 'Salt', 'Sugar', 'Pebbles'] },
    { q: 'How can you get salt back out of salty water?', a: ['Let the water evaporate', 'Use a magnet', 'Freeze the salt', 'Shake it hard'] },
    { q: 'What comes out of an erupting volcano?', a: ['Lava, ash and gas', 'Only rain', 'Snow and ice', 'Sand and shells'] },
    { q: 'What are the remains of ancient plants and animals kept in rock called?', a: ['Fossils', 'Crystals', 'Pebbles', 'Lava'] },
    { q: 'Water slowly turning into water vapour from its surface is called…', a: ['Evaporation', 'Freezing', 'Melting', 'Condensation'] },
    { q: 'Where do the drops on the outside of a cold cup come from?', a: ['Water vapour in the air', 'Inside the cup', 'The table', 'The cup melting'] },
    { q: 'When water freezes into ice, its volume…', a: ['Gets bigger', 'Gets smaller', 'Stays the same', 'Disappears'] },
    { q: 'Why does a shadow form?', a: ['Light goes in straight lines and is blocked', 'Light bends round things', 'Light is heavy', 'Light is cold'] },
    { q: 'You raise your right hand in front of a mirror. Which hand does your reflection seem to raise?', a: ['Its left hand', 'Its right hand', 'Both hands', 'Neither hand'] },
    { q: 'Which part of a plant takes in water from the soil?', a: ['The roots', 'The leaves', 'The flowers', 'The seeds'] },
    { q: 'On a map where 1 cm stands for 1 km, two towns are 5 cm apart. How far apart are they really?', a: ['5 km', '1 km', '50 km', '500 m'] },
    { q: 'What do contour lines close together on a map show?', a: ['Steep ground', 'Flat ground', 'A lake', 'A road'] },
    { q: 'Which sentence is right?', a: ['She has two cats.', 'She have two cats.', 'She has two cat.', 'She haves two cats.'] },
    { q: 'What is the opposite of “early”?', a: ['Late', 'Fast', 'Soon', 'Slow'] },
  ],
  // Year 5 of elementary school: the order of operations, factors and
  // multiples, fractions in their lowest terms, added, taken away and
  // multiplied, decimals, areas, cuboids, symmetry, averages and chances;
  // heat, the solar system, dissolving, fungi, acids, the weather; Korea's
  // land and its history.
  elementary5: [
    { q: 'What is 8 + 12 ÷ 4 × 2?', a: ['14', '10', '9.5', '40'] },
    { q: 'What is (15 − 3) × 2 + 6?', a: ['30', '18', '24', '36'] },
    { q: 'What is the greatest common factor of 18 and 24?', a: ['6', '3', '12', '72'] },
    { q: 'What is the least common multiple of 4 and 6?', a: ['12', '24', '2', '10'] },
    { q: 'Which of these is a factor of 36?', a: ['9', '8', '5', '7'] },
    { q: 'How many factors does 12 have?', a: ['6', '4', '5', '12'] },
    { q: 'What is 12/18 in its lowest terms?', a: ['2/3', '4/6', '6/9', '3/4'] },
    { q: 'What is 1/2 + 1/3?', a: ['5/6', '2/5', '1/6', '2/6'] },
    { q: 'What is 3/4 − 1/6?', a: ['7/12', '2/10', '1/2', '5/12'] },
    { q: 'What is 2/3 × 9?', a: ['6', '18', '3', '27'] },
    { q: 'What is 3/5 × 5/6?', a: ['1/2', '8/11', '15/11', '18/25'] },
    { q: 'What is 4 × 1/6?', a: ['2/3', '4/24', '1/24', '5/6'] },
    { q: 'What is 1.2 × 0.4?', a: ['0.48', '4.8', '0.048', '0.8'] },
    { q: 'What is 2.46 rounded to one decimal place?', a: ['2.5', '2.4', '2.46', '3'] },
    { q: 'Which whole numbers are greater than 5 and at most 8?', a: ['6, 7 and 8', '5, 6, 7 and 8', '6 and 7', '5, 6 and 7'] },
    { q: 'A rectangle is 8 cm long and 5 cm wide. What is its area?', a: ['40 cm²', '26 cm²', '13 cm²', '80 cm²'] },
    { q: 'A triangle has a base of 10 cm and a height of 6 cm. What is its area?', a: ['30 cm²', '60 cm²', '16 cm²', '15 cm²'] },
    { q: 'A parallelogram has a base of 7 cm and a height of 4 cm. What is its area?', a: ['28 cm²', '14 cm²', '22 cm²', '11 cm²'] },
    { q: 'A trapezoid has parallel sides of 4 cm and 6 cm and a height of 5 cm. What is its area?', a: ['25 cm²', '50 cm²', '120 cm²', '15 cm²'] },
    { q: 'A rhombus has diagonals of 6 cm and 8 cm. What is its area?', a: ['24 cm²', '48 cm²', '14 cm²', '28 cm²'] },
    { q: 'A regular hexagon has sides of 5 cm. What is its perimeter?', a: ['30 cm', '25 cm', '35 cm', '60 cm'] },
    { q: 'How many faces does a cuboid have?', a: ['6', '8', '12', '4'] },
    { q: 'How many edges does a cube have?', a: ['12', '6', '8', '24'] },
    { q: 'Which shape looks the same after half a turn?', a: ['A parallelogram', 'An equilateral triangle', 'An isosceles triangle', 'A kite'] },
    { q: 'What is the average of 70, 80 and 90?', a: ['80', '240', '90', '75'] },
    { q: 'What is the chance that a tossed coin lands heads?', a: ['1/2', '1', '0', '1/4'] },
    { q: 'A car goes 150 km in 3 hours. What is its average speed?', a: ['50 km/h', '450 km/h', '30 km/h', '75 km/h'] },
    { q: 'Heat moving along a metal spoon from its hot end is called…', a: ['Conduction', 'Convection', 'Evaporation', 'Reflection'] },
    { q: 'Warm air rising and cool air sinking in a room is called…', a: ['Convection', 'Conduction', 'Condensation', 'Friction'] },
    { q: 'Which is the biggest planet in our solar system?', a: ['Jupiter', 'Saturn', 'Earth', 'Neptune'] },
    { q: 'Which of these is a star?', a: ['The Sun', 'The Moon', 'Mars', 'Venus'] },
    { q: 'Sugar stirred into water until you cannot see it has…', a: ['Dissolved', 'Melted', 'Evaporated', 'Frozen'] },
    { q: 'What are mould and mushrooms?', a: ['Fungi', 'Plants', 'Animals', 'Bacteria'] },
    { q: 'Which of these turns blue litmus paper red?', a: ['Vinegar', 'Soapy water', 'Baking soda water', 'Limewater'] },
    { q: 'On a sunny afternoon at the beach, which way does the wind usually blow?', a: ['From the sea to the land', 'From the land to the sea', 'Straight up', 'It never blows'] },
    { q: 'Which is Korea’s easternmost island?', a: ['Dokdo', 'Jejudo', 'Ganghwado', 'Geojedo'] },
    { q: 'In the old story, who founded Gojoseon, the first Korean kingdom?', a: ['Dangun', 'Jumong', 'King Sejong', 'Wang Geon'] },
    { q: 'Who founded the Goryeo dynasty?', a: ['Wang Geon', 'Yi Seong-gye', 'Jumong', 'Gung Ye'] },
    { q: 'What was made under King Sejong of Joseon to measure the rain?', a: ['The cheugugi', 'Cheomseongdae', 'The Jikji', 'Hwaseong Fortress'] },
  ],
  // Year 6 of elementary school: dividing fractions and decimals, ratios,
  // percentages and proportions, circles, volumes and surface areas,
  // prisms, pyramids and cones; day and night, the Moon and the seasons,
  // burning, plants, lenses and prisms, circuits and electromagnets, the
  // body; the world's continents and oceans, and how Korea is governed.
  elementary6: [
    { q: 'What is 3/4 ÷ 1/2?', a: ['1 1/2', '3/8', '2/3', '1/2'] },
    { q: 'What is 6 ÷ 2/3?', a: ['9', '4', '3', '18'] },
    { q: 'What is 5/6 ÷ 5?', a: ['1/6', '25/6', '1/5', '6'] },
    { q: 'What is 4.8 ÷ 0.6?', a: ['8', '0.8', '80', '2.88'] },
    { q: 'What is 2.4 ÷ 3?', a: ['0.8', '8', '0.08', '7.2'] },
    { q: 'What is 25% of 80?', a: ['20', '25', '32', '4'] },
    { q: 'What is 0.35 as a percentage?', a: ['35%', '3.5%', '0.35%', '350%'] },
    { q: 'A shirt costs 20,000 won with 30% off. What is the sale price?', a: ['14,000 won', '6,000 won', '17,000 won', '19,700 won'] },
    { q: 'What is the ratio 6 : 8 in its simplest form?', a: ['3 : 4', '6 : 8', '2 : 3', '4 : 3'] },
    { q: 'There are 20 children, boys and girls in the ratio 3 : 2. How many are girls?', a: ['8', '12', '10', '4'] },
    { q: 'Solve the proportion 3 : 4 = 9 : ☐', a: ['12', '10', '16', '7'] },
    { q: 'On a 1 : 50,000 map, two places are 4 cm apart. How far apart are they really?', a: ['2 km', '200 m', '20 km', '50 km'] },
    { q: 'A circle has a diameter of 10 cm. Taking π as 3.14, what is its circumference?', a: ['31.4 cm', '15.7 cm', '78.5 cm', '314 cm'] },
    { q: 'A circle has a radius of 10 cm. Taking π as 3.14, what is its area?', a: ['314 cm²', '62.8 cm²', '31.4 cm²', '100 cm²'] },
    { q: 'What is the volume of a cuboid 5 cm long, 4 cm wide and 3 cm high?', a: ['60 cm³', '12 cm³', '47 cm³', '94 cm³'] },
    { q: 'What is the surface area of a cube with 3 cm edges?', a: ['54 cm²', '27 cm²', '9 cm²', '36 cm²'] },
    { q: 'How many cm³ are there in 1 m³?', a: ['1,000,000', '100', '1,000', '10,000'] },
    { q: 'How many faces does a triangular prism have?', a: ['5', '6', '3', '9'] },
    { q: 'How many vertices does a square pyramid have?', a: ['5', '4', '8', '6'] },
    { q: 'How many flat faces does a cone have?', a: ['1', '2', '0', '3'] },
    { q: 'In a pie chart, how much of the circle does 25% take up?', a: ['A quarter', 'A half', 'A third', 'A tenth'] },
    { q: 'Why do we have day and night?', a: ['The Earth spins on its axis', 'The Sun goes round the Earth', 'The Moon blocks the Sun', 'Clouds cover the Sun'] },
    { q: 'About how long is it from one full moon to the next?', a: ['About 30 days', 'About 7 days', 'About 1 day', 'About 365 days'] },
    { q: 'Why are summers hot and winters cold?', a: ['The Earth’s axis is tilted', 'The Earth is nearer the Sun in summer', 'The Sun burns hotter in summer', 'The Moon blocks the Sun in winter'] },
    { q: 'Which gas helps things burn?', a: ['Oxygen', 'Carbon dioxide', 'Nitrogen', 'Helium'] },
    { q: 'Which gas turns limewater milky?', a: ['Carbon dioxide', 'Oxygen', 'Hydrogen', 'Nitrogen'] },
    { q: 'A jar put over a burning candle puts it out. What has the flame run out of?', a: ['Oxygen', 'Wax', 'Wick', 'Light'] },
    { q: 'Water leaving a plant through tiny holes in its leaves is called…', a: ['Transpiration', 'Photosynthesis', 'Respiration', 'Germination'] },
    { q: 'What can a convex lens do with sunlight?', a: ['Gather it to a bright point', 'Make it disappear', 'Turn it into sound', 'Make it heavier'] },
    { q: 'What does a prism split white light into?', a: ['Rainbow colours', 'Only red light', 'Darkness', 'Sound'] },
    { q: 'Two bulbs on one battery shine brighter when they are wired…', a: ['In parallel', 'In series', 'Either way, the same', 'Neither way: they never light'] },
    { q: 'What does an electromagnet need to work?', a: ['Electricity flowing through its coil', 'Sunlight', 'Water', 'A cold room'] },
    { q: 'Which organ pumps blood round the body?', a: ['The heart', 'The lungs', 'The stomach', 'The kidneys'] },
    { q: 'Which organs clean waste out of the blood?', a: ['The kidneys', 'The lungs', 'The heart', 'The bones'] },
    { q: 'Where is most food digested and taken into the body?', a: ['The small intestine', 'The mouth', 'The large intestine', 'The lungs'] },
    { q: 'Which is the largest continent?', a: ['Asia', 'Africa', 'Europe', 'Australia'] },
    { q: 'Which ocean lies between the Americas and Europe and Africa?', a: ['The Atlantic Ocean', 'The Pacific Ocean', 'The Indian Ocean', 'The Arctic Ocean'] },
    { q: 'In Korea, who makes the laws?', a: ['The National Assembly', 'The courts', 'The President', 'The police'] },
    { q: 'How long is a Korean President’s term?', a: ['5 years', '4 years', '6 years', '3 years'] },
  ],
  // Year 1 of middle school: primes, negative numbers, letters for numbers
  // and equations, proportion, the coordinate plane, angles of polygons,
  // sectors, solids and congruence, the mode and median; forces, gases and
  // their particles, changes of state, light and sound, rocks and the
  // kinds of living things.
  middle1: [
    { q: 'What is 72 as a product of primes?', a: ['2³ × 3²', '2² × 3³', '8 × 9', '2 × 36'] },
    { q: 'How many prime numbers are there between 1 and 20?', a: ['8', '9', '7', '10'] },
    { q: 'What is (−7) + (+3)?', a: ['−4', '4', '−10', '10'] },
    { q: 'What is (−5) − (−8)?', a: ['3', '−13', '−3', '13'] },
    { q: 'What is (−2)³?', a: ['−8', '8', '−6', '6'] },
    { q: 'What is (−12) ÷ (−3) × (−2)?', a: ['−8', '8', '−2', '2'] },
    { q: 'Which of these numbers is the biggest?', a: ['−1/3', '−1/2', '−3/4', '−1'] },
    { q: 'What is the absolute value of −6?', a: ['6', '−6', '0', '1/6'] },
    { q: 'Solve 4x − 7 = 13', a: ['5', '1.5', '20', '−5'] },
    { q: 'Solve 3(x + 2) = 2x + 9', a: ['3', '7', '1', '15'] },
    { q: 'If x = −2, what is x² − 3x?', a: ['10', '−2', '2', '−10'] },
    { q: 'Simplify 3a + 2b − a + 5b', a: ['2a + 7b', '4a + 7b', '2a + 3b', '9ab'] },
    { q: 'y is directly proportional to x, and y = 12 when x = 3. What is y when x = 5?', a: ['20', '15', '7.2', '14'] },
    { q: 'y is inversely proportional to x, and y = 6 when x = 4. What is y when x = 8?', a: ['3', '12', '2', '10'] },
    { q: 'Which quadrant is the point (−3, 2) in?', a: ['The second', 'The first', 'The third', 'The fourth'] },
    { q: 'What do the inside angles of a hexagon add up to?', a: ['720°', '540°', '1080°', '360°'] },
    { q: 'How big is each inside angle of a regular pentagon?', a: ['108°', '72°', '120°', '540°'] },
    { q: 'How many diagonals does a hexagon have?', a: ['9', '6', '12', '3'] },
    { q: 'A sector has a radius of 6 cm and an angle of 60°. What is its area?', a: ['6π cm²', '2π cm²', '12π cm²', '36π cm²'] },
    { q: 'How many faces does a regular octahedron have?', a: ['8', '6', '12', '4'] },
    { q: 'Which solid has 12 faces, each a regular pentagon?', a: ['A regular dodecahedron', 'A regular icosahedron', 'A cube', 'A regular octahedron'] },
    { q: 'Spinning a rectangle round one of its sides makes a…', a: ['Cylinder', 'Cone', 'Sphere', 'Cube'] },
    { q: 'Spinning a right-angled triangle round one of its shorter sides makes a…', a: ['Cone', 'Cylinder', 'Sphere', 'Pyramid'] },
    { q: 'Vertically opposite angles are always…', a: ['Equal', 'Supplementary', 'Right angles', 'Different'] },
    { q: 'Which of these does NOT prove two triangles congruent?', a: ['Three equal angles', 'Three equal sides', 'Two sides and the angle between them', 'Two angles and the side between them'] },
    { q: 'In a frequency table of 40 students, one group has 10 of them. What is its relative frequency?', a: ['0.25', '0.4', '4', '10'] },
    { q: 'What is the mode of 3, 5, 5, 7, 9?', a: ['5', '7', '9', '3'] },
    { q: 'What is the median of 2, 9, 4, 7, 5?', a: ['5', '4', '7', '9'] },
    { q: 'Which force pushes up on a boat floating on water?', a: ['Buoyancy', 'Gravity', 'Friction', 'Magnetism'] },
    { q: 'What does friction do?', a: ['Works against things sliding', 'Always speeds things up', 'Pulls things toward the Earth', 'Only works in space'] },
    { q: 'Your mass is 60 kg on Earth. What is your mass on the Moon?', a: ['60 kg', '10 kg', '360 kg', '0 kg'] },
    { q: 'A sealed syringe of air is pushed to half its volume, at the same temperature. What happens to the pressure?', a: ['It doubles', 'It halves', 'It stays the same', 'It drops to zero'] },
    { q: 'Why does a balloon get bigger when it is warmed?', a: ['Its gas particles move faster and spread out', 'Its gas particles grow bigger', 'More gas particles appear', 'Its gas particles stop moving'] },
    { q: 'Dry ice turning straight into gas, without melting first, is called…', a: ['Sublimation', 'Evaporation', 'Melting', 'Condensation'] },
    { q: 'When light bounces off a mirror, the angle of reflection is…', a: ['Equal to the angle of incidence', 'Twice the angle of incidence', 'Always 90°', 'Half the angle of incidence'] },
    { q: 'Why does a straw in a glass of water look bent?', a: ['Light refracts', 'Light reflects', 'Light stops', 'The water bends the straw'] },
    { q: 'A louder sound has a bigger…', a: ['Amplitude', 'Frequency', 'Speed', 'Pitch'] },
    { q: 'Which kind of rock forms when lava or magma cools?', a: ['Igneous rock', 'Sedimentary rock', 'Metamorphic rock', 'Limestone'] },
    { q: 'Which of these is a vertebrate?', a: ['A frog', 'A snail', 'An earthworm', 'A jellyfish'] },
  ],
  // Year 2 of middle school: repeating decimals, powers and polynomials,
  // inequalities, simultaneous equations, lines and their slopes, the
  // centres of a triangle, parallelograms, similar shapes, Pythagoras and
  // probability; atoms and ions, circuits, the planets, photosynthesis,
  // blood, digestion and breathing, density, heat and clouds.
  middle2: [
    { q: 'Which fraction makes a decimal that ends, rather than repeating?', a: ['3/8', '1/3', '2/7', '5/6'] },
    { q: 'What is 0.333… (with the 3 going on forever) as a fraction?', a: ['1/3', '3/10', '33/100', '1/30'] },
    { q: 'What is 2³ × 2⁴?', a: ['2⁷', '2¹²', '4⁷', '2¹'] },
    { q: 'What is (a²)³?', a: ['a⁶', 'a⁵', 'a⁸', '3a²'] },
    { q: 'What is x⁸ ÷ x²?', a: ['x⁶', 'x⁴', 'x¹⁰', 'x¹⁶'] },
    { q: 'Simplify 6x²y ÷ 2xy', a: ['3x', '3xy', '4x', '3x²'] },
    { q: 'Expand 2x(3x − 4)', a: ['6x² − 8x', '6x² − 4', '5x² − 8x', '6x − 8'] },
    { q: 'Solve 2x − 3 > 7', a: ['x > 5', 'x > 2', 'x < 5', 'x > 10'] },
    { q: 'Solve −3x ≤ 12', a: ['x ≥ −4', 'x ≤ −4', 'x ≥ 4', 'x ≤ 4'] },
    { q: 'x + y = 10 and x − y = 4. What is x?', a: ['7', '3', '6', '14'] },
    { q: '2x + y = 7 and x + y = 5. What is y?', a: ['3', '2', '5', '7'] },
    { q: 'What is the slope of the line through (1, 3) and (3, 7)?', a: ['2', '4', '1/2', '−2'] },
    { q: 'Where does y = 3x − 6 cross the x-axis?', a: ['(2, 0)', '(−6, 0)', '(0, −6)', '(3, 0)'] },
    { q: 'Which line is parallel to y = −2x + 5?', a: ['y = −2x − 1', 'y = 2x + 5', 'y = ½x + 5', 'y = −x + 5'] },
    { q: 'A triangle has two equal sides with a 40° angle between them. How big is each of its other angles?', a: ['70°', '40°', '140°', '50°'] },
    { q: 'Where the perpendicular bisectors of a triangle’s sides meet is its…', a: ['Circumcentre', 'Incentre', 'Centroid', 'Orthocentre'] },
    { q: 'A triangle’s incentre is the same distance from…', a: ['All three sides', 'All three corners', 'Two corners only', 'The longest side only'] },
    { q: 'The diagonals of a parallelogram always…', a: ['Cut each other in half', 'Have the same length', 'Meet at right angles', 'Miss each other'] },
    { q: 'Two similar triangles have sides in the ratio 2 : 3. What is the ratio of their areas?', a: ['4 : 9', '2 : 3', '8 : 27', '6 : 9'] },
    { q: 'A right-angled triangle has shorter sides of 6 and 8. How long is its longest side?', a: ['10', '14', '48', '100'] },
    { q: 'A line joins the midpoints of two sides of a triangle. Compared with the third side, it is parallel and…', a: ['Half as long', 'Twice as long', 'The same length', 'A third as long'] },
    { q: 'Two dice are rolled. In how many ways can they add up to 7?', a: ['6', '7', '5', '12'] },
    { q: 'Two coins are tossed. What is the probability of two heads?', a: ['1/4', '1/2', '1/3', '3/4'] },
    { q: 'A bag has 3 red and 5 blue marbles. What is the probability of picking a red one?', a: ['3/8', '3/5', '5/8', '1/3'] },
    { q: 'What is the chemical symbol for sodium?', a: ['Na', 'S', 'So', 'Sd'] },
    { q: 'What is the formula of water?', a: ['H₂O', 'HO₂', 'H₂O₂', 'OH'] },
    { q: 'An atom that loses an electron becomes a…', a: ['Positive ion', 'Negative ion', 'Neutral atom', 'Molecule'] },
    { q: 'A 6 V battery drives a current through a 3 Ω resistor. What is the current?', a: ['2 A', '18 A', '0.5 A', '3 A'] },
    { q: 'Rubbing a balloon on your hair gives it…', a: ['An electric charge', 'Magnetism', 'More mass', 'Light'] },
    { q: 'Which planet has the biggest, brightest rings?', a: ['Saturn', 'Mars', 'Venus', 'Mercury'] },
    { q: 'Besides glucose, what does photosynthesis make?', a: ['Oxygen', 'Carbon dioxide', 'Nitrogen', 'Salt'] },
    { q: 'Which part of the blood carries oxygen?', a: ['Red blood cells', 'White blood cells', 'Platelets', 'Plasma'] },
    { q: 'Which enzyme in saliva starts breaking down starch?', a: ['Amylase', 'Pepsin', 'Lipase', 'Trypsin'] },
    { q: 'What are the tiny air sacs in the lungs, where oxygen passes into the blood?', a: ['Alveoli', 'Villi', 'Nephrons', 'Bronchi'] },
    { q: 'A 20 g block has a volume of 10 cm³. What is its density?', a: ['2 g/cm³', '200 g/cm³', '0.5 g/cm³', '30 g/cm³'] },
    { q: 'Which of these floats on water?', a: ['Wood of density 0.6 g/cm³', 'Iron of density 7.9 g/cm³', 'Glass of density 2.5 g/cm³', 'Stone of density 2.7 g/cm³'] },
    { q: 'Hot water and cold water mixed together end up…', a: ['At a temperature in between', 'As hot as the hot water', 'As cold as the cold water', 'At 0 °C'] },
    { q: 'Which warms up most slowly in the sun, because of its high specific heat?', a: ['Water', 'Sand', 'Iron', 'Copper'] },
    { q: 'How do clouds form?', a: ['Rising air cools and its water vapour condenses', 'Warm air sinks and dries out', 'The wind blows dust together', 'The Sun makes water vapour glow'] },
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
  // Year 2 of high school: exponents and logarithms, trigonometry,
  // sequences and series, limits, derivatives and integrals of
  // polynomials; motion and energy, moles and pH, bonds and the periodic
  // table, immunity, cells and hormones, plates and stars; and English.
  high2: [
    { q: 'What is log₂ 32?', a: ['5', '16', '6', '4'] },
    { q: 'What is log₁₀ 1000?', a: ['3', '100', '30', '4'] },
    { q: 'What is log₃ 9 + log₃ 3?', a: ['3', '12', '2', '27'] },
    { q: 'What is 8 to the power of 2/3?', a: ['4', '16/3', '2', '64'] },
    { q: 'Solve 2ˣ = 16', a: ['4', '8', '3', '2'] },
    { q: 'What is sin 30°?', a: ['1/2', '√3/2', '1', '√2/2'] },
    { q: 'What is tan 45°?', a: ['1', '0', '√3', '1/2'] },
    { q: 'What is sin²θ + cos²θ?', a: ['1', '0', '2', 'tan θ'] },
    { q: 'What is the period of y = sin x?', a: ['2π', 'π', '1', 'π/2'] },
    { q: 'How many radians are there in 180°?', a: ['π', '2π', 'π/2', '180'] },
    { q: 'An arithmetic sequence goes 3, 7, 11, … What is its 10th term?', a: ['39', '43', '40', '37'] },
    { q: 'A geometric sequence goes 2, 6, 18, … What is its 5th term?', a: ['162', '54', '486', '30'] },
    { q: 'What is 1 + 2 + 3 + … + 100?', a: ['5,050', '5,000', '10,100', '4,950'] },
    { q: 'What is the limit of (x² − 1)/(x − 1) as x → 1?', a: ['2', '0', '1', 'There is none'] },
    { q: 'What is the derivative of x³?', a: ['3x²', 'x²', '3x³', 'x⁴/4'] },
    { q: 'f(x) = x² + 3x. What is f′(2)?', a: ['7', '10', '4', '5'] },
    { q: 'What is the slope of the tangent to y = x² at x = 3?', a: ['6', '9', '3', '2'] },
    { q: 'Where does f(x) = x² − 4x + 1 have its smallest value?', a: ['At x = 2', 'At x = −2', 'At x = 4', 'At x = 1'] },
    { q: 'What is ∫ 2x dx?', a: ['x² + C', '2x² + C', '2 + C', 'x + C'] },
    { q: 'What is the integral of 3x² from x = 0 to x = 2?', a: ['8', '12', '6', '4'] },
    { q: 'A car’s position is s(t) = t² + 2t metres. How fast is it going at t = 3 s?', a: ['8 m/s', '15 m/s', '5 m/s', '6 m/s'] },
    { q: 'A ball is dropped from rest. Ignoring the air, how fast is it falling after 2 s? (g = 10 m/s²)', a: ['20 m/s', '10 m/s', '40 m/s', '5 m/s'] },
    { q: 'What is the kinetic energy of a 2 kg ball moving at 3 m/s?', a: ['9 J', '6 J', '18 J', '3 J'] },
    { q: 'How much potential energy does a 5 kg box gain when it is lifted 2 m? (g = 10 m/s²)', a: ['100 J', '10 J', '50 J', '20 J'] },
    { q: 'In E = mc², what is c?', a: ['The speed of light', 'The speed of sound', 'An electric charge', 'A heat capacity'] },
    { q: 'Which wave can travel through empty space?', a: ['Light', 'Sound', 'A water wave', 'An earthquake wave'] },
    { q: 'How many moles are there in 36 g of water (18 g/mol)?', a: ['2', '18', '0.5', '36'] },
    { q: 'About how many particles are there in one mole?', a: ['6.02 × 10²³', '3.0 × 10⁸', '1.6 × 10⁻¹⁹', '1,000'] },
    { q: 'Balance it: 2H₂ + O₂ → ☐H₂O', a: ['2', '1', '3', '4'] },
    { q: 'A solution has a hydrogen ion concentration of 10⁻³ mol/L. What is its pH?', a: ['3', '−3', '11', '7'] },
    { q: 'Which bond shares a pair of electrons between two atoms?', a: ['A covalent bond', 'An ionic bond', 'A hydrogen bond', 'A metallic bond'] },
    { q: 'Going from left to right across a period of the periodic table, atoms generally get…', a: ['Smaller', 'Bigger', 'The same size', 'Radioactive'] },
    { q: 'Which cells make antibodies?', a: ['B cells', 'Red blood cells', 'Platelets', 'Nerve cells'] },
    { q: 'A human body cell has 46 chromosomes. How many does an egg cell have?', a: ['23', '46', '92', '22'] },
    { q: 'Which disease is caused by a virus?', a: ['Influenza', 'Tuberculosis', 'Cholera', 'Malaria'] },
    { q: 'Which hormone lowers the sugar in the blood?', a: ['Insulin', 'Glucagon', 'Adrenaline', 'Thyroxine'] },
    { q: 'What is the gap between two nerve cells called?', a: ['A synapse', 'A nephron', 'A neuron', 'An axon'] },
    { q: 'What kind of plate boundary makes new ocean floor at a mid-ocean ridge?', a: ['Divergent', 'Convergent', 'Transform', 'Collision'] },
    { q: 'Which element is most common in the Sun?', a: ['Hydrogen', 'Helium', 'Oxygen', 'Carbon'] },
    { q: 'Fill the gap: “Had I known, I ___ have come.”', a: ['would', 'will', 'had', 'am'] },
    { q: 'Which sentence uses the present perfect correctly?', a: ['I have lived here since 2020.', 'I have lived here in 2020.', 'I lived here since 2020.', 'I am living here since 2020.'] },
  ],
  // Year 3 of high school: derivatives of exponentials, logarithms and
  // sines, the chain and product rules, limits and series, integrals,
  // counting and the binomial theorem, conditional probability and
  // distributions, conic sections and vectors; fields, photons and
  // half-lives, catalysts, genes and evolution, the Moon and galaxies;
  // Korean history; and English as the college entrance exam asks it.
  high3: [
    { q: 'What is the derivative of eˣ?', a: ['eˣ', 'x·eˣ⁻¹', 'eˣ/x', 'ln x'] },
    { q: 'What is the derivative of ln x?', a: ['1/x', 'ln x / x', 'x', 'eˣ'] },
    { q: 'What is the derivative of sin x?', a: ['cos x', '−cos x', '−sin x', 'tan x'] },
    { q: 'What is the derivative of x·eˣ?', a: ['(x + 1)eˣ', 'eˣ', 'x·eˣ', 'x²eˣ'] },
    { q: 'What is the derivative of (2x + 1)³?', a: ['6(2x + 1)²', '3(2x + 1)²', '2(2x + 1)³', '6(2x + 1)³'] },
    { q: 'What is the limit of (1 + 1/n)ⁿ as n → ∞?', a: ['e', '1', '∞', '2'] },
    { q: 'What is the limit of sin x / x as x → 0?', a: ['1', '0', '∞', 'There is none'] },
    { q: 'What does 1 + 1/2 + 1/4 + 1/8 + … add up to, going on forever?', a: ['2', '1', '∞', '1.875'] },
    { q: 'What is the integral of sin x from 0 to π?', a: ['2', '0', '1', 'π'] },
    { q: 'What is ∫ 1/x dx, for x > 0?', a: ['ln x + C', '−1/x² + C', '1/x² + C', 'eˣ + C'] },
    { q: 'What is the coefficient of x² in (x + 2)⁵?', a: ['80', '10', '40', '32'] },
    { q: 'In how many ways can 3 different letters go into 2 postboxes?', a: ['8', '6', '9', '5'] },
    { q: 'In how many ways can the letters of AABB be arranged?', a: ['6', '24', '4', '12'] },
    { q: 'A and B are independent, with P(A) = 0.5 and P(B) = 0.4. What is P(A and B)?', a: ['0.2', '0.9', '0.1', '0.45'] },
    { q: 'P(A and B) = 0.12 and P(B) = 0.4. What is P(A | B)?', a: ['0.3', '0.048', '0.52', '0.28'] },
    { q: 'A fair coin is tossed 10 times. How many heads do you expect?', a: ['5', '10', '2.5', '1/2'] },
    { q: 'X follows the binomial distribution B(100, 1/2). What is its variance?', a: ['25', '50', '5', '100'] },
    { q: 'In a normal distribution, about how much lies within one standard deviation of the mean?', a: ['68%', '50%', '95%', '99.7%'] },
    { q: 'What curve is x²/9 + y²/4 = 1?', a: ['An ellipse', 'A hyperbola', 'A parabola', 'A circle'] },
    { q: 'Where is the focus of the parabola y² = 8x?', a: ['(2, 0)', '(8, 0)', '(4, 0)', '(0, 2)'] },
    { q: 'a = (1, 2) and b = (3, −1). What is the dot product a · b?', a: ['1', '5', '(3, −2)', '7'] },
    { q: 'Two vectors, neither of them zero, have a dot product of 0. They are…', a: ['Perpendicular', 'Parallel', 'Equal', 'Opposite'] },
    { q: 'A charge moves through a magnetic field. When is the force on it greatest?', a: ['Moving at right angles to the field', 'Moving along the field', 'Moving against the field', 'It is the same every way'] },
    { q: 'What does the photoelectric effect show about light?', a: ['It comes in packets of energy, photons', 'It is a sound wave', 'It carries no energy', 'It is slower than sound'] },
    { q: 'Doubling the frequency of light does what to the energy of each photon?', a: ['Doubles it', 'Halves it', 'Leaves it the same', 'Quadruples it'] },
    { q: 'What is a substance’s half-life?', a: ['The time for half of it to decay', 'Half the time it takes to decay completely', 'The time for it to double', 'Half its age'] },
    { q: 'A substance has a half-life of 5 years. How much of 80 g of it is left after 15 years?', a: ['10 g', '20 g', '40 g', '0 g'] },
    { q: 'What does a catalyst do?', a: ['Speeds up a reaction without being used up', 'Makes more product than is possible', 'Stops every reaction', 'Is always used up first'] },
    { q: 'DNA’s message is copied into which molecule, to take it to the ribosome?', a: ['mRNA', 'tRNA', 'A protein', 'A chromosome'] },
    { q: 'Which codon starts the making of a protein?', a: ['AUG', 'UAA', 'UGA', 'UAG'] },
    { q: 'In a population in Hardy–Weinberg balance, the allele frequency q is 0.3. How common is the qq genotype?', a: ['0.09', '0.3', '0.6', '0.49'] },
    { q: 'Why do we always see the same side of the Moon?', a: ['It spins once for each trip round the Earth', 'It does not spin at all', 'Its other side is always dark', 'The Earth blocks its other side'] },
    { q: 'Hubble found that galaxies further away are moving away…', a: ['Faster', 'Slower', 'At the same speed', 'Not at all'] },
    { q: 'Which king of Joseon built Hwaseong Fortress in Suwon?', a: ['King Jeongjo', 'King Sejong', 'King Yeongjo', 'King Taejo'] },
    { q: 'Which treaty of 1876 opened Korea’s ports to Japan?', a: ['The Treaty of Ganghwa', 'The Eulsa Treaty', 'The Treaty of Shimonoseki', 'The Treaty of Portsmouth'] },
    { q: 'In which year was the April 19 Revolution?', a: ['1960', '1980', '1987', '1950'] },
    { q: 'Fill the gap: “Not only ___ he sing, but he also dances.”', a: ['does', 'is', 'has', 'do'] },
    { q: 'Fill the gap: “She insisted on ___ the bill herself.”', a: ['paying', 'pay', 'to pay', 'paid'] },
    { q: 'Which word means “to make something less severe”?', a: ['Mitigate', 'Exacerbate', 'Proliferate', 'Fabricate'] },
    { q: 'Which word is the opposite of “scarce”?', a: ['Abundant', 'Rare', 'Sparse', 'Meagre'] },
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
  // The Math Olympiad, like a maths contest's: last digits and remainders,
  // divisors and primes, clever counting, areas and angles, chances, and
  // puzzles with a trick to them. Every answer is worked out again in
  // test/quiz.test.js.
  olympiad: [
    { q: 'What is the last digit of 7¹⁰⁰?', a: ['1', '7', '9', '3'] },
    { q: 'How many zeros are there at the end of 25! (25 factorial)?', a: ['6', '5', '2', '25'] },
    { q: 'What is the remainder when 2¹⁰ is divided by 7?', a: ['2', '1', '4', '3'] },
    { q: 'How many positive divisors does 360 have?', a: ['24', '12', '18', '36'] },
    { q: 'What do all the divisors of 28 add up to, 28 itself included?', a: ['56', '28', '27', '42'] },
    { q: 'What is the largest prime factor of 2024?', a: ['23', '11', '2', '253'] },
    { q: 'What is the smallest number bigger than 1 that leaves a remainder of 1 when divided by 2, 3, 4, 5 or 6?', a: ['61', '31', '121', '7'] },
    { q: 'In how many ways can you climb 6 stairs, taking 1 or 2 stairs at a time?', a: ['13', '8', '12', '21'] },
    { q: 'How many squares of any size are there on an 8 × 8 chessboard?', a: ['204', '64', '65', '140'] },
    { q: 'How many diagonals does a 10-sided polygon have?', a: ['35', '45', '40', '20'] },
    { q: 'With 23 people in a room, about how likely is it that two of them share a birthday?', a: ['About 50%', 'About 6%', 'About 23%', 'About 100%'] },
    { q: 'What is the angle between the hands of a clock at 3:30?', a: ['75°', '90°', '60°', '105°'] },
    { q: 'What is 1 + 3 + 5 + … + 99?', a: ['2,500', '2,450', '5,000', '2,550'] },
    { q: 'How many three-digit numbers have digits that add up to 5?', a: ['15', '10', '21', '12'] },
    { q: 'What is the area of a triangle with sides 13, 14 and 15?', a: ['84', '91', '42', '105'] },
    { q: 'A rectangle has a perimeter of 20 cm. What is the biggest area it can have?', a: ['25 cm²', '24 cm²', '20 cm²', '100 cm²'] },
    { q: 'What do the angles at the five tips of a five-pointed star add up to?', a: ['180°', '360°', '540°', '720°'] },
    { q: 'Three cards marked 1, 2 and 3 are shuffled into a row. What is the chance that no card is in its own place?', a: ['1/3', '1/6', '1/2', '2/3'] },
    { q: 'Which is bigger, 2¹⁰⁰ or 3⁶⁰?', a: ['2¹⁰⁰', '3⁶⁰', 'They are equal', 'You can’t tell'] },
    { q: 'How many times do you write the digit 7 when you write the numbers from 1 to 100?', a: ['20', '19', '10', '11'] },
    { q: 'Any two-digit number plus the number with its digits the other way round (like 47 + 74) always makes…', a: ['A multiple of 11', 'An even number', 'A square number', 'A prime number'] },
    { q: 'What is the units digit of 3¹ + 3² + 3³ + … + 3²⁰?', a: ['0', '3', '9', '1'] },
    { q: 'Two trains 200 km apart head toward each other at 60 km/h and 40 km/h. A bird flies back and forth between them at 100 km/h until they meet. How far does the bird fly?', a: ['200 km', '100 km', '120 km', '250 km'] },
    { q: 'Three fair coins are tossed. What is the chance of at least one head?', a: ['7/8', '1/2', '3/8', '3/4'] },
    { q: 'What is √(2 + √3) × √(2 − √3)?', a: ['1', '2', '√3', '4'] },
    { q: 'If x + 1/x = 3, what is x² + 1/x²?', a: ['7', '9', '11', '5'] },
    { q: 'What is the remainder when 1! + 2! + 3! + … + 100! is divided by 12?', a: ['9', '0', '3', '1'] },
    { q: 'In how many ways can 8 rooks be put on a chessboard so that no two attack each other?', a: ['40,320', '64', '2,048', '16,777,216'] },
    { q: 'A 3 × 3 × 3 cube painted on the outside is cut into 27 little cubes. How many of them have exactly two painted faces?', a: ['12', '8', '6', '24'] },
    { q: 'What is the 100th digit after the decimal point of 1/7?', a: ['8', '1', '4', '7'] },
    { q: 'Ann is twice as old as Ben was when Ann was as old as Ben is now. Ann is 24. How old is Ben?', a: ['18', '12', '16', '20'] },
    { q: 'What comes next: 1, 11, 21, 1211, 111221, …?', a: ['312211', '1112221', '122111', '311221'] },
    { q: 'How many whole numbers from 1 to 100 can be divided exactly by 3 or by 5?', a: ['47', '53', '46', '40'] },
    { q: 'What is the smallest whole number that has exactly 10 divisors?', a: ['48', '512', '80', '60'] },
    { q: 'In how many ways can you make 25¢ out of 1¢, 5¢ and 10¢ coins?', a: ['12', '10', '9', '15'] },
    { q: 'How many four-digit palindromes are there, numbers like 1221 that read the same both ways?', a: ['90', '100', '81', '900'] },
    { q: 'What is the greatest common factor of 2¹⁰ − 1 and 2⁶ − 1?', a: ['3', '1', '7', '63'] },
    { q: 'What is the remainder when 3¹⁰⁰ is divided by 5?', a: ['1', '3', '4', '2'] },
    { q: 'A circle just fits inside a square with sides of 2. What is the area inside the square but outside the circle?', a: ['4 − π', '2π − 4', 'π − 2', '4 − π/2'] },
    { q: 'In how many ways can 5 people sit round a round table, if turning the table does not count as a new way?', a: ['24', '120', '5', '60'] },
    { q: 'Moving only right or up along the lines of a 4 × 4 grid of squares, how many shortest paths go from one corner to the opposite one?', a: ['70', '16', '256', '35'] },
    { q: 'Five numbers average 10. One is taken away, and the other four average 9. What number was taken away?', a: ['14', '1', '10', '19'] },
    { q: 'What is 999 × 999?', a: ['998,001', '999,001', '998,999', '989,001'] },
    { q: 'Which is the biggest: 2⁵⁰, 3³³ or 5²¹?', a: ['3³³', '2⁵⁰', '5²¹', 'All three are equal'] },
    { q: 'In how many ways can a 2 × 5 board be covered with 1 × 2 dominoes?', a: ['8', '5', '10', '13'] },
    { q: 'Two cards are drawn from a shuffled pack of 52. What is the chance that both are aces?', a: ['1/221', '1/169', '1/26', '1/52'] },
    { q: 'What is the area of a regular hexagon with sides of 2?', a: ['6√3', '12', '4√3', '6'] },
    { q: 'What is 1 + 4 + 9 + 16 + … + 400, the first 20 square numbers added up?', a: ['2,870', '2,100', '8,000', '4,200'] },
    { q: 'What is the smallest number that leaves a remainder of 2 when divided by 3, 3 when divided by 4 and 4 when divided by 5?', a: ['59', '29', '119', '9'] },
  ],
  // The Science Olympiad: physics worked out (throws, swings, circuits,
  // lenses, waves, gases), chemistry (balancing, moles, oxidation, pH),
  // genetics by chance, and the Earth and the stars.
  science: [
    { q: 'A ball is thrown straight up at 20 m/s. How high does it go? (g = 10 m/s²)', a: ['20 m', '40 m', '10 m', '2 m'] },
    { q: 'A ball thrown straight up at 15 m/s comes back down to your hand after how long? (g = 10 m/s²)', a: ['3 s', '1.5 s', '15 s', '6 s'] },
    { q: 'A pendulum is let go 45 cm above its lowest point. How fast is it moving at the bottom? (g = 10 m/s²)', a: ['3 m/s', '9 m/s', '4.5 m/s', '30 m/s'] },
    { q: 'What do two 6 Ω resistors joined in parallel make?', a: ['3 Ω', '12 Ω', '6 Ω', '36 Ω'] },
    { q: 'A 2 Ω and a 3 Ω resistor are joined in series to a 10 V battery. What current flows?', a: ['2 A', '5 A', '0.5 A', '25 A'] },
    { q: 'How much power does a 12 V lamp use when 2 A flows through it?', a: ['24 W', '6 W', '14 W', '144 W'] },
    { q: 'An object stands 30 cm from a convex lens with a focal length of 10 cm. How far behind the lens is its image?', a: ['15 cm', '20 cm', '40 cm', '7.5 cm'] },
    { q: 'A wave has a frequency of 5 Hz and a wavelength of 2 m. How fast does it travel?', a: ['10 m/s', '2.5 m/s', '0.4 m/s', '7 m/s'] },
    { q: 'You shout at a cliff and hear the echo 2 s later. Sound travels at 340 m/s. How far away is the cliff?', a: ['340 m', '680 m', '170 m', '1,360 m'] },
    { q: 'About how much of a floating ice cube is under the water?', a: ['About 90%', 'About 50%', 'About 10%', 'All of it'] },
    { q: 'About how deep under water does the pressure grow by one more atmosphere?', a: ['About 10 m', 'About 1 m', 'About 100 m', 'About 1 km'] },
    { q: 'A 1,000 kg car going at 20 m/s brakes to a stop. How much of its energy turns into heat?', a: ['200,000 J', '20,000 J', '400,000 J', '10,000 J'] },
    { q: 'A 2 kg box is pulled with a force of 10 N against 4 N of friction. What is its acceleration?', a: ['3 m/s²', '5 m/s²', '7 m/s²', '2 m/s²'] },
    { q: 'Light inside water meets the surface at a very slanting angle, and none of it comes out. What is this called?', a: ['Total internal reflection', 'Diffraction', 'Absorption', 'Interference'] },
    { q: 'A planet goes round the Sun 4 times as far out as the Earth. How long is its year?', a: ['8 Earth years', '4 Earth years', '16 Earth years', '64 Earth years'] },
    { q: 'About how long does sunlight take to reach the Earth?', a: ['About 8 minutes', 'About 8 seconds', 'About 8 hours', 'About 1 second'] },
    { q: 'Which colour of light carries the most energy in each photon?', a: ['Violet', 'Red', 'Yellow', 'Green'] },
    { q: 'A transformer has 100 turns on its input coil and 500 on its output coil. 10 V goes in. What comes out?', a: ['50 V', '2 V', '10 V', '500 V'] },
    { q: 'A balloon holds 2 L of gas at 300 K. Warmed to 450 K at the same pressure, how big does it get?', a: ['3 L', '2 L', '4.5 L', '1.3 L'] },
    { q: 'Balance it: C₃H₈ + ☐O₂ → 3CO₂ + 4H₂O', a: ['5', '3', '7', '10'] },
    { q: 'What is the molar mass of CO₂? (C = 12, O = 16)', a: ['44 g/mol', '28 g/mol', '32 g/mol', '60 g/mol'] },
    { q: 'What is the oxidation number of manganese in KMnO₄?', a: ['+7', '+4', '+2', '−1'] },
    { q: 'How many grams of salt, NaCl, are there in 0.5 mol of it? (Na = 23, Cl = 35.5)', a: ['29.25 g', '58.5 g', '117 g', '14.6 g'] },
    { q: 'Which element pulls hardest on the electrons in a bond?', a: ['Fluorine', 'Oxygen', 'Chlorine', 'Sodium'] },
    { q: '100 mL of 0.1 M hydrochloric acid is mixed with 100 mL of 0.1 M sodium hydroxide. What is the pH now?', a: ['7', '1', '13', '0'] },
    { q: 'Which gas bubbles off when zinc is dropped into hydrochloric acid?', a: ['Hydrogen', 'Oxygen', 'Chlorine', 'Carbon dioxide'] },
    { q: 'What shape is a methane molecule, CH₄?', a: ['A tetrahedron', 'A flat square', 'A straight line', 'A triangle'] },
    { q: 'How many neutrons does an atom of carbon-14 have?', a: ['8', '6', '14', '12'] },
    { q: 'Two parents are both Aa. What is the chance that their child is aa?', a: ['1/4', '1/2', '3/4', '0'] },
    { q: 'Two plants, both AaBb, are crossed, the two genes sorting independently. What share of their young show both dominant traits?', a: ['9/16', '3/16', '1/16', '3/4'] },
    { q: 'A mother with blood type AO and a father with type BO have a child. What is the chance it is type O?', a: ['1/4', '1/2', '0', '3/4'] },
    { q: 'Colour blindness is carried on the X chromosome. A colour-blind father and a mother with no colour-blindness gene have a son. What is the chance he is colour-blind?', a: ['0', '1/2', '1/4', '1'] },
    { q: 'In a food chain, about how much of the energy at one level passes on to the next?', a: ['About 10%', 'About 50%', 'About 90%', 'All of it'] },
    { q: 'One strand of DNA reads ATGCCA. What does the strand paired with it read?', a: ['TACGGT', 'UACGGU', 'ATGCCA', 'GCATTG'] },
    { q: 'Why does the Moon show phases?', a: ['We see different amounts of its sunlit half as it goes round us', 'The Earth’s shadow covers part of it', 'Clouds hide part of it', 'Its own light flickers'] },
    { q: 'Which stars are the hottest?', a: ['Blue ones', 'Red ones', 'Yellow ones', 'Orange ones'] },
    { q: 'What does a light-year measure?', a: ['A distance', 'A time', 'A speed', 'A brightness'] },
    { q: 'If the Earth’s axis were not tilted, what would happen?', a: ['There would be no seasons', 'Days would last a year', 'The Moon would fall', 'Nothing at all'] },
    { q: 'Why is the sky blue?', a: ['Air scatters blue light more than red', 'The sea reflects onto it', 'Air is blue in colour', 'The Sun gives out only blue light'] },
  ],
  // The Logic Olympiad: knights who always tell the truth and knaves who
  // always lie, balances, river and bridge crossings, what follows from
  // what, sure-fire picks, tricky questions and puzzles of who sits where.
  // test/quiz.test.js tries out every way round the ones it can.
  logic: [
    { q: 'On an island, knights always tell the truth and knaves always lie. A says: “We are both knaves.” What are A and B?', a: ['A is a knave, B is a knight', 'Both are knaves', 'Both are knights', 'A is a knight, B is a knave'] },
    { q: 'Knights always tell the truth and knaves always lie. A says: “B is a knave.” B says: “A and I are the same kind.” What are they?', a: ['A is a knight, B is a knave', 'A is a knave, B is a knight', 'Both are knights', 'Both are knaves'] },
    { q: 'A says: “B is lying.” B says: “C is lying.” C says: “A and B are both lying.” Who is telling the truth?', a: ['Only B', 'Only A', 'Only C', 'A and C'] },
    { q: 'Gold is in one of three boxes. Box 1 says “The gold is here”, box 2 says “The gold is not here” and box 3 says “The gold is not in box 1”. Only one sign is true. Where is the gold?', a: ['Box 2', 'Box 1', 'Box 3', 'You can’t tell'] },
    { q: 'Three boxes are labelled “Apples”, “Oranges” and “Apples and oranges”, and every label is wrong. You may take one fruit out of one box. Which box should it be, to label them all right?', a: ['The one labelled “Apples and oranges”', 'The one labelled “Apples”', 'The one labelled “Oranges”', 'Any of them'] },
    { q: 'Nine coins look the same, but one is a little heavier. How few weighings on a balance always find it?', a: ['2', '3', '4', '8'] },
    { q: 'Twelve coins look the same, but one is fake: heavier or lighter. How few weighings on a balance always find it, and whether it is heavier or lighter?', a: ['3', '2', '4', '6'] },
    { q: 'A farmer takes a wolf, a goat and a cabbage across a river, one at a time in his boat. The wolf can’t be left with the goat, nor the goat with the cabbage. How many crossings does it take, at the fewest?', a: ['7', '5', '3', '9'] },
    { q: 'Four people cross a bridge at night with one torch. At most two cross at a time, at the slower one’s pace. They take 1, 2, 5 and 10 minutes. What is the shortest time for all of them to cross?', a: ['17 minutes', '19 minutes', '18 minutes', '15 minutes'] },
    { q: 'You pick one of three doors; a car is behind one of them. The host, who knows where it is, opens another door with a goat behind it and lets you switch. How often does switching win the car?', a: ['2 times in 3', '1 time in 2', '1 time in 3', 'Every time'] },
    { q: '“If it rains, the ground gets wet.” The ground is dry. What follows?', a: ['It did not rain', 'It rained', 'It will rain', 'Nothing follows'] },
    { q: 'All bloops are razzies, and all razzies are lazzies. Which must be true?', a: ['All bloops are lazzies', 'All lazzies are bloops', 'No lazzies are bloops', 'All razzies are bloops'] },
    { q: 'Some cats are black, and everything black is dark. Which must be true?', a: ['Some cats are dark', 'All cats are dark', 'No cats are dark', 'All dark things are cats'] },
    { q: 'Four cards show A, K, 4 and 7. The rule: “A card with a vowel on one side has an even number on the other.” Which cards must you turn over to check it?', a: ['A and 7', 'A and 4', 'Only A', 'A, 4 and 7'] },
    { q: 'If the day after tomorrow is Sunday, what day was the day before yesterday?', a: ['Wednesday', 'Thursday', 'Friday', 'Tuesday'] },
    { q: 'A dark drawer holds 10 black socks and 10 white ones. How many must you take out to be sure of a matching pair?', a: ['3', '2', '11', '21'] },
    { q: 'From a dark drawer of 10 black socks and 10 white ones, how many must you take out to be sure of two black ones?', a: ['12', '2', '3', '11'] },
    { q: 'A bat and a ball cost 1,100 won together. The bat costs 1,000 won more than the ball. How much is the ball?', a: ['50 won', '100 won', '10 won', '1,000 won'] },
    { q: '5 machines make 5 toys in 5 minutes. How long do 100 machines take to make 100 toys?', a: ['5 minutes', '100 minutes', '20 minutes', '1 minute'] },
    { q: 'Lily pads on a pond double every day and cover all of it on day 48. On which day did they cover half of it?', a: ['Day 47', 'Day 24', 'Day 46', 'Day 12'] },
    { q: 'In a race, you overtake the runner in second place. What place are you in now?', a: ['Second', 'First', 'Third', 'Last'] },
    { q: 'Two fathers and two sons go fishing. Each of them catches one fish, and they catch three in all. How can that be?', a: ['They are a grandfather, his son and his grandson', 'One of them lost his fish', 'One fish was caught twice', 'One of them did not fish'] },
    { q: 'A clock loses 5 minutes every hour. It is set right at noon. What does it show at 6 p.m.?', a: ['5:30', '5:55', '6:30', '5:00'] },
    { q: 'How many times a day are a clock’s hour and minute hands exactly on top of each other?', a: ['22', '24', '12', '23'] },
    { q: 'Three switches outside a shut room work three bulbs inside, and you may go in only once. How can you tell which switch works which bulb?', a: ['Turn one on for a while, turn it off, turn another on, then go in and feel the bulbs', 'You can’t', 'Turn them all on at once', 'Flick each switch many times'] },
    { q: 'Ann, Ben and Cal have a cat, a dog and a fish, one pet each. Ann is allergic to fur, and Ben’s pet does not bark. Who has the dog?', a: ['Cal', 'Ann', 'Ben', 'You can’t tell'] },
    { q: 'In a race of five, Cy beat Amy, Amy beat Bo, Bo beat Di, and Eve crossed the line just after Cy. Who came third?', a: ['Amy', 'Eve', 'Bo', 'Cy'] },
    { q: 'A, B, C and D sit in a row. D sits second from the left, C sits at one end, A is not next to B, and A sits somewhere to the left of B. Who sits at the left end?', a: ['A', 'B', 'C', 'D'] },
    { q: 'Each letter stands for a different digit, and AB + BA = 121. Which could AB be?', a: ['74', '75', '66', '85'] },
    { q: 'Which number does not belong: 3, 5, 7, 9, 11?', a: ['9', '3', '5', '11'] },
    { q: 'What letter comes next: O, T, T, F, F, S, S, E, …?', a: ['N', 'T', 'E', 'S'] },
    { q: 'What comes next: 2, 3, 5, 9, 17, …?', a: ['33', '25', '31', '34'] },
    { q: 'A rope ladder hangs over a ship’s side, its bottom rung just at the water. The tide comes in 60 cm. How many rungs are under the water now?', a: ['None: the ship rises with the tide', '1', '2', '6'] },
    { q: 'In a dark room you have one match, a candle, a gas lamp and a wood stove. What do you light first?', a: ['The match', 'The candle', 'The gas lamp', 'The wood stove'] },
    { q: 'A knight stands on a corner square of a chessboard. How many squares can it move to?', a: ['2', '3', '4', '8'] },
    { q: 'A man looks at a portrait and says: “Brothers and sisters I have none, but that man’s father is my father’s son.” Who is in the portrait?', a: ['His son', 'Himself', 'His father', 'His nephew'] },
  ],
  // The Coding Olympiad: what a little Python program prints (code: the
  // program, shown under the question), binary and hexadecimal, logic
  // gates, stacks, queues, sorting, searching and graphs.
  // test/quiz.test.js runs every program to check what it prints.
  coding: [
    { q: 'What is the binary number 1011 in decimal?', a: ['11', '1011', '13', '9'] },
    { q: 'What is 25 written in binary?', a: ['11001', '10011', '11010', '10101'] },
    { q: 'How many different values can one byte, 8 bits, hold?', a: ['256', '255', '8', '128'] },
    { q: 'What is the hexadecimal number FF in decimal?', a: ['255', '256', '1515', '240'] },
    { q: 'At most how many guesses does binary search need to find a name in a sorted list of 1,000 names?', a: ['10', '100', '500', '1,000'] },
    { q: 'Which of these grows fastest as n gets very big?', a: ['n²', 'n log n', 'n', 'log n'] },
    { q: 'An AND gate gets a 1 and a 0. What does it give out?', a: ['0', '1', '10', '2'] },
    { q: 'Which logic gate gives out 1 only when its two inputs are different?', a: ['XOR', 'AND', 'OR', 'NOT'] },
    { q: 'Bubble sort sorts [3, 1, 2] by swapping neighbours that are the wrong way round. How many swaps does it make?', a: ['2', '1', '3', '0'] },
    { q: 'A stack: push 1, push 2, push 3, pop, push 4, pop. What is on top now?', a: ['2', '4', '3', '1'] },
    { q: 'A queue: add A, add B, add C, take one out, add D. Which is at the front now?', a: ['B', 'A', 'C', 'D'] },
    { q: 'Which of these keeps things “first in, first out”?', a: ['A queue', 'A stack', 'A tree', 'A set'] },
    { q: 'A tree has 10 nodes. How many edges does it have?', a: ['9', '10', '11', '45'] },
    { q: 'Roads go A–B 4 km, B–C 3 km, A–C 9 km, C–D 2 km and B–D 7 km. How long is the shortest way from A to D?', a: ['9 km', '11 km', '13 km', '16 km'] },
    { q: 'How many bits are there in a kilobyte, taking 1 KB as 1,024 bytes?', a: ['8,192', '1,024', '8,000', '1,000'] },
    { q: 'In most programming languages, what is 17 % 5?', a: ['2', '3', '3.4', '12'] },
    { q: 'What does a compiler do?', a: ['Turns a program into instructions the computer can run', 'Finds pictures on the internet', 'Makes the computer run faster', 'Draws the screen'] },
    { q: 'Which of these is not a programming language?', a: ['HTML', 'Python', 'JavaScript', 'C'] },
    { q: 'What is a function that calls itself called?', a: ['Recursive', 'Iterative', 'Binary', 'Hidden'] },
    { q: 'Which sort is quickest on average for a long list?', a: ['Quicksort', 'Bubble sort', 'Insertion sort', 'Selection sort'] },
    { q: 'What does this program print?', code: 'x = 3\nx = x * 2 + 1\nprint(x)', a: ['7', '8', '6', '9'] },
    { q: 'What does this program print?', code: 'total = 0\nfor i in range(1, 6):\n    total += i\nprint(total)', a: ['15', '10', '21', '6'] },
    { q: 'What does this program print?', code: 'n = 10\nsteps = 0\nwhile n > 1:\n    n = n // 2\n    steps += 1\nprint(steps)', a: ['3', '4', '5', '10'] },
    { q: 'What does this program print?', code: 'a = [4, 8, 15, 16, 23, 42]\nprint(a[2] + len(a))', a: ['21', '14', '20', '23'] },
    { q: 'What does this program print?', code: "s = ''\nfor i in range(3):\n    s = str(i) + s\nprint(s)", a: ['210', '012', '3', '123'] },
    { q: 'What does this program print?', code: 'def f(n):\n    if n <= 1:\n        return n\n    return f(n - 1) + f(n - 2)\n\nprint(f(7))', a: ['13', '8', '21', '7'] },
    { q: 'What does this program print?', code: 'count = 0\nfor i in range(1, 101):\n    if i % 3 == 0 and i % 5 == 0:\n        count += 1\nprint(count)', a: ['6', '7', '47', '15'] },
    { q: 'What does this program print?', code: 'a, b = 5, 9\na, b = b, a\nprint(a - b)', a: ['4', '−4', '0', '14'] },
    { q: 'What does this program print?', code: "words = ['sun', 'moon', 'star']\nprint(sum(len(w) for w in words))", a: ['11', '3', '12', '10'] },
    { q: 'What does this program print?', code: 'x = 1\nfor i in range(10):\n    x *= 2\nprint(x)', a: ['1024', '20', '512', '2048'] },
    { q: 'What does this program print?', code: 'i = 0\ntotal = 0\nwhile total < 20:\n    i += 1\n    total += i\nprint(i)', a: ['6', '5', '21', '20'] },
    { q: 'What does this program print?', code: 'grid = [[1, 2], [3, 4]]\nprint(grid[1][0])', a: ['3', '2', '1', '4'] },
    { q: 'What does this program print?', code: "t = 'banana'\nprint(t.count('a'))", a: ['3', '2', '6', '1'] },
    { q: 'What does this program print?', code: 'def g(n):\n    if n == 0:\n        return 0\n    return n % 10 + g(n // 10)\n\nprint(g(2024))', a: ['8', '2024', '4', '6'] },
    { q: 'What does this program print?', code: 'x = 0\nfor i in range(4):\n    for j in range(i):\n        x += 1\nprint(x)', a: ['6', '16', '10', '4'] },
    { q: 'What does this program print?', code: 'nums = [3, 1, 4, 1, 5, 9, 2, 6]\nprint(max(nums) - min(nums))', a: ['8', '9', '5', '1'] },
    { q: 'What does this program print?', code: "s = 'kids world'\nprint(s[::-1][:4])", a: ['dlro', 'kids', 'sdik', 'worl'] },
    { q: 'What does this program print?', code: 'a = [1, 2, 3]\nb = a\nb.append(4)\nprint(len(a))', a: ['4', '3', '1', 'An error'] },
    { q: 'What does this program print?', code: 'print(7 // 2 + 7 % 2)', a: ['4', '3', '4.5', '7'] },
    { q: 'What does this program print?', code: 'total = 0\nfor n in range(1, 11):\n    if n % 2 == 0:\n        continue\n    total += n\nprint(total)', a: ['25', '30', '55', '5'] },
  ],
  // The Chess Olympiad: a position (fen: the board, as chess players write
  // it down) and the move that is checkmate, or that makes sure of mate on
  // the next move. The moves are written the chess way (K king, Q queen,
  // R rook, B bishop, N knight, nothing for a pawn, x for a capture), with
  // no + or # to give the answer away. test/quiz.test.js plays every move
  // out with chess.js.
  chess: [
    { q: 'White to move: which move is checkmate?', fen: '6k1/5ppp/8/8/8/8/8/3R2K1 w - - 0 1', a: ['Rd8', 'Rd7', 'Rd6', 'Kf2'] },
    { q: 'White to move: which move is checkmate?', fen: '6rk/6pp/8/6N1/8/8/8/6K1 w - - 0 1', a: ['Nf7', 'Nxh7', 'Ne6', 'Kg2'] },
    { q: 'White to move: which move is checkmate?', fen: '7k/R7/5N2/8/8/8/6K1/8 w - - 0 1', a: ['Rh7', 'Ra8', 'Ng4', 'Kh3'] },
    { q: 'White to move: which move is checkmate?', fen: '8/4N1pk/8/8/8/3R4/6K1/8 w - - 0 1', a: ['Rh3', 'Rd7', 'Nf5', 'Kg3'] },
    { q: 'White to move: which move is checkmate?', fen: 'r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4', a: ['Qxf7', 'Bxf7', 'Qxe5', 'Qxh7'] },
    { q: 'Black to move: which move is checkmate?', fen: 'rnbqkbnr/pppp1ppp/8/4p3/6P1/5P2/PPPPP2P/RNBQKBNR b KQkq g3 0 2', a: ['Qh4', 'Qg5', 'Bc5', 'Nf6'] },
    { q: 'White to move: which move is checkmate?', fen: '4k3/R7/8/8/8/8/8/1R4K1 w - - 0 1', a: ['Rb8', 'Ra8', 'Re7', 'Re1'] },
    { q: 'White to move: which move is checkmate?', fen: '3rkr2/8/8/8/2Q5/8/8/4K3 w - - 0 1', a: ['Qe6', 'Qc6', 'Qe4', 'Qb5'] },
    { q: 'White to move: which move is checkmate?', fen: 'r5k1/5p1p/8/5N2/3Q4/8/8/6K1 w - - 0 1', a: ['Qg7', 'Qd8', 'Ne7', 'Nh6'] },
    { q: 'Black to move: which move is checkmate?', fen: '1r4k1/8/8/8/8/8/5PPP/6K1 b - - 0 1', a: ['Rb1', 'Rb2', 'Rb7', 'Kf7'] },
    { q: 'White to move: which move is checkmate?', fen: '7k/7p/5N2/8/8/8/8/6RK w - - 0 1', a: ['Rg8', 'Rg7', 'Nxh7', 'Ne8'] },
    { q: 'White to move: which move is checkmate?', fen: 'k7/p1K5/1P6/8/8/8/8/8 w - - 0 1', a: ['b7', 'bxa7', 'Kc8', 'Kd7'] },
    { q: 'White to move: which move is checkmate?', fen: '6k1/5p1p/6pQ/8/8/8/1B6/6K1 w - - 0 1', a: ['Qg7', 'Qxh7', 'Qf8', 'Qxg6'] },
    { q: 'White to move: which move is checkmate?', fen: '4k3/5p2/8/6B1/8/8/8/3R2K1 w - - 0 1', a: ['Rd8', 'Rd7', 'Re1', 'Bf6'] },
    { q: 'White to move: which move is checkmate?', fen: '7k/8/6K1/8/8/8/8/R7 w - - 0 1', a: ['Ra8', 'Ra7', 'Rh1', 'Kf7'] },
    { q: 'Black to move: which move is checkmate?', fen: '6k1/8/8/8/6n1/8/6PP/6RK b - - 0 1', a: ['Nf2', 'Ne3', 'Nh6', 'Kf7'] },
    { q: 'White to move: which move is checkmate?', fen: '7k/1P4pp/8/8/8/8/8/6K1 w - - 0 1', a: ['b8=Q', 'b8=N', 'b8=B', 'Kf2'] },
    { q: 'White to move: which move is checkmate?', fen: '3r2k1/5ppp/8/8/8/8/3Q1PPP/3R2K1 w - - 0 1', a: ['Qxd8', 'Qd7', 'Qd5', 'h3'] },
    { q: 'White to move: which move is checkmate?', fen: '5rk1/5pp1/8/6NQ/8/8/8/6K1 w - - 0 1', a: ['Qh7', 'Qxf7', 'Qh8', 'Nxf7'] },
    { q: 'White to move: which move is checkmate?', fen: '2kr4/1p1n4/B7/8/5B2/8/8/1R4K1 w - - 0 1', a: ['Bxb7', 'Rxb7', 'Rc1', 'Bb5'] },
    { q: 'White to move: which move is checkmate?', fen: '5rk1/5ppp/8/8/8/3Q4/2B5/6RK w - - 0 1', a: ['Qxh7', 'Rxg7', 'Qd8', 'Bb3'] },
    { q: 'White to move: which move is checkmate?', fen: '7k/8/6K1/8/8/8/8/5Q2 w - - 0 1', a: ['Qf8', 'Qf7', 'Qa6', 'Qh3'] },
    { q: 'White to move: which move makes sure of checkmate on the next move?', fen: '4k3/8/8/8/8/8/1R6/R5K1 w - - 0 1', a: ['Ra7', 'Ra8', 'Rb8', 'Kf2'] },
  ],
  // The World Olympiad: the world's lands, seas, cities and clocks, and
  // its history and Korea's, the hard parts.
  world: [
    { q: 'What is the capital of Australia?', a: ['Canberra', 'Sydney', 'Melbourne', 'Perth'] },
    { q: 'What is the capital of Canada?', a: ['Ottawa', 'Toronto', 'Vancouver', 'Montreal'] },
    { q: 'What is the capital of Turkey?', a: ['Ankara', 'Istanbul', 'Izmir', 'Antalya'] },
    { q: 'What is the capital of Brazil?', a: ['Brasília', 'Rio de Janeiro', 'São Paulo', 'Salvador'] },
    { q: 'Which is the longest river in Asia?', a: ['The Yangtze', 'The Mekong', 'The Ganges', 'The Yellow River'] },
    { q: 'Which is the highest mountain in Africa?', a: ['Kilimanjaro', 'Mount Kenya', 'Mount Elbrus', 'Mont Blanc'] },
    { q: 'Which country has the most people today?', a: ['India', 'China', 'The United States', 'Indonesia'] },
    { q: 'Which is the largest country by area?', a: ['Russia', 'Canada', 'China', 'The United States'] },
    { q: 'Which is the smallest country in the world?', a: ['Vatican City', 'Monaco', 'San Marino', 'Liechtenstein'] },
    { q: 'Which is the largest hot desert?', a: ['The Sahara', 'The Gobi', 'The Kalahari', 'The Arabian Desert'] },
    { q: 'When it is noon in Seoul (UTC+9), what time is it in London (UTC+0) in winter?', a: ['3 a.m.', '9 p.m.', '9 a.m.', '6 a.m.'] },
    { q: 'Which strait lies between Korea and Japan?', a: ['The Korea Strait', 'The Strait of Gibraltar', 'The Bering Strait', 'The Strait of Malacca'] },
    { q: 'Which sea lies between Africa and Arabia?', a: ['The Red Sea', 'The Black Sea', 'The Caspian Sea', 'The Dead Sea'] },
    { q: 'Which mountains divide Europe from Asia?', a: ['The Urals', 'The Alps', 'The Himalayas', 'The Andes'] },
    { q: 'Which is the deepest lake in the world?', a: ['Lake Baikal', 'Lake Superior', 'Lake Victoria', 'Lake Titicaca'] },
    { q: 'Which country has the most time zones, counting its lands overseas?', a: ['France', 'Russia', 'The United States', 'China'] },
    { q: 'What is the highest mountain in South Korea?', a: ['Hallasan', 'Jirisan', 'Seoraksan', 'Bukhansan'] },
    { q: 'Which line of longitude runs through Greenwich in London?', a: ['The prime meridian', 'The equator', 'The International Date Line', 'The Tropic of Cancer'] },
    { q: 'In which year did the Berlin Wall fall?', a: ['1989', '1991', '1961', '1945'] },
    { q: 'Who was the first person to walk on the Moon?', a: ['Neil Armstrong', 'Buzz Aldrin', 'Yuri Gagarin', 'John Glenn'] },
    { q: 'Which empire built Machu Picchu in the Andes?', a: ['The Inca Empire', 'The Aztec Empire', 'The Maya', 'The Roman Empire'] },
    { q: 'Who painted the Mona Lisa?', a: ['Leonardo da Vinci', 'Michelangelo', 'Raphael', 'Botticelli'] },
    { q: 'Which of the Seven Wonders of the Ancient World still stands?', a: ['The Great Pyramid of Giza', 'The Colossus of Rhodes', 'The Hanging Gardens of Babylon', 'The Lighthouse of Alexandria'] },
    { q: 'In which year did the First World War begin?', a: ['1914', '1918', '1939', '1905'] },
    { q: 'Who wrote “On the Origin of Species”, about evolution by natural selection?', a: ['Charles Darwin', 'Gregor Mendel', 'Isaac Newton', 'Louis Pasteur'] },
    { q: 'Which country gave the Statue of Liberty to the United States?', a: ['France', 'Britain', 'Spain', 'Italy'] },
    { q: 'Which country first used paper money?', a: ['China', 'Egypt', 'Greece', 'England'] },
    { q: 'Around 1450, Johannes Gutenberg changed Europe with…', a: ['A printing press with movable type', 'The telescope', 'The steam engine', 'The compass'] },
    { q: 'The Silk Road linked China with…', a: ['The Mediterranean world', 'The Americas', 'Australia', 'Antarctica'] },
    { q: 'Which Korean kingdom lasted the longest?', a: ['Silla', 'Joseon', 'Goryeo', 'Goguryeo'] },
    { q: 'Which king of Goguryeo won it the most land, as a great stone stele tells?', a: ['Gwanggaeto the Great', 'King Jangsu', 'King Sosurim', 'King Dongmyeong'] },
    { q: 'Who led Joseon’s navy, and its turtle ships, against Japan in the Imjin War?', a: ['Admiral Yi Sun-sin', 'General Gang Gam-chan', 'General Eulji Mundeok', 'King Seonjo'] },
    { q: 'In which battle did General Eulji Mundeok of Goguryeo beat the Sui army in 612?', a: ['The Battle of Salsu', 'The Battle of Hansan Island', 'The Battle of Gwiju', 'The Battle of Haengju'] },
    { q: 'Which Korean book of 1377 is the oldest still-existing book printed with movable metal type?', a: ['Jikji', 'The Tripitaka Koreana', 'The Samguk Sagi', 'The Hunminjeongeum'] },
    { q: 'In which year did the fighting of the Korean War stop with an armistice?', a: ['1953', '1950', '1945', '1960'] },
    { q: 'Which city held the 1988 Summer Olympics?', a: ['Seoul', 'Tokyo', 'Beijing', 'Los Angeles'] },
    { q: 'Which Korean led the United Nations as its Secretary-General?', a: ['Ban Ki-moon', 'Kim Dae-jung', 'Roh Moo-hyun', 'Lee Myung-bak'] },
  ],
  // The English Olympiad: hard words, idioms, the grammar that trips
  // people up, spelling, and words played with.
  englisholympiad: [
    { q: 'Which word means “happening by a lucky chance”?', a: ['Serendipitous', 'Ubiquitous', 'Meticulous', 'Gregarious'] },
    { q: 'Which word means “found everywhere”?', a: ['Ubiquitous', 'Serendipitous', 'Ephemeral', 'Benevolent'] },
    { q: 'Which word means “lasting only a very short time”?', a: ['Ephemeral', 'Eternal', 'Perennial', 'Robust'] },
    { q: 'Which word means “very careful about every detail”?', a: ['Meticulous', 'Careless', 'Hasty', 'Vague'] },
    { q: 'Which word means “liking to be with other people”?', a: ['Gregarious', 'Reclusive', 'Timid', 'Aloof'] },
    { q: 'What does “benevolent” mean?', a: ['Kind and wanting to help', 'Cruel', 'Lazy', 'Proud'] },
    { q: 'Which word is the opposite of “frugal”?', a: ['Wasteful', 'Thrifty', 'Careful', 'Economical'] },
    { q: 'Which word is the opposite of “verbose”?', a: ['Concise', 'Wordy', 'Talkative', 'Long-winded'] },
    { q: 'What does “to procrastinate” mean?', a: ['To put things off until later', 'To work very fast', 'To plan ahead', 'To give up'] },
    { q: 'What does “ambiguous” mean?', a: ['Having more than one possible meaning', 'Very clear', 'Very large', 'Very old'] },
    { q: 'What do you call words that sound alike but mean different things, like “pair” and “pear”?', a: ['Homophones', 'Synonyms', 'Antonyms', 'Acronyms'] },
    { q: 'What do you call a word made from the first letters of other words, like NASA?', a: ['An acronym', 'A homophone', 'A palindrome', 'An idiom'] },
    { q: 'Which of these is a palindrome, the same read backwards?', a: ['Racecar', 'Rocket', 'Rotate', 'Reader'] },
    { q: 'Which word is an anagram of “listen”, the same letters mixed up?', a: ['Silent', 'Lessen', 'Listed', 'Glisten'] },
    { q: 'Which is spelled right?', a: ['Necessary', 'Neccessary', 'Necesary', 'Neccesary'] },
    { q: 'Which of these is spelled correctly?', a: ['Accommodate', 'Acommodate', 'Accomodate', 'Acomodate'] },
    { q: 'What does it mean to “break the ice”?', a: ['To start a friendly talk with someone new', 'To break something by accident', 'To feel very cold', 'To win a race'] },
    { q: 'What does “a piece of cake” mean?', a: ['Something very easy', 'A birthday treat', 'A small share', 'Something very sweet'] },
    { q: 'What does it mean to “hit the nail on the head”?', a: ['To say exactly the right thing', 'To hurt yourself', 'To build something', 'To make a big mistake'] },
    { q: 'What does “once in a blue moon” mean?', a: ['Very rarely', 'Every month', 'At night', 'Never'] },
    { q: 'What does it mean to feel “under the weather”?', a: ['To feel ill', 'To be out in the rain', 'To feel very happy', 'To be hiding'] },
    { q: 'Fill the gap: “Neither the teacher nor the students ___ ready.”', a: ['were', 'was', 'is', 'be'] },
    { q: 'Fill the gap: “I wish I ___ taller.”', a: ['were', 'am', 'will be', 'be'] },
    { q: 'Fill the gap: “By next year, she ___ here for ten years.”', a: ['will have lived', 'will live', 'has lived', 'lived'] },
    { q: 'Which sentence is correct?', a: ['Fewer people came than we hoped.', 'Less people came than we hoped.', 'Fewer water was left.', 'Less people was there.'] },
    { q: 'Fill the gap: “The book, ___ cover is torn, is mine.”', a: ['whose', 'who’s', 'which', 'that'] },
    { q: 'Fill the gap: “It was raining, ___ we stayed inside.”', a: ['so', 'because', 'although', 'unless'] },
    { q: 'What is the past participle of “swim”, as in “I have ___”?', a: ['swum', 'swam', 'swimmed', 'swimming'] },
    { q: 'What is the plural of “ox”?', a: ['Oxen', 'Oxes', 'Oxs', 'Oxi'] },
    { q: 'Which word is a conjunction, joining two parts of a sentence?', a: ['Although', 'Quickly', 'Beautiful', 'Table'] },
    { q: 'Which sentence uses the apostrophe correctly?', a: ['The dog wagged its tail.', 'The dog wagged it’s tail.', 'The dogs’ wagged tails.', 'The dog’s wagged it’s tail.'] },
    { q: 'What is the comparative of “bad”?', a: ['Worse', 'Badder', 'Worst', 'More bad'] },
    { q: 'How many letters of the English alphabet are vowels, not counting Y?', a: ['5', '6', '7', '4'] },
    { q: 'Which letter turns up most often in English writing?', a: ['E', 'A', 'T', 'S'] },
    { q: 'A pangram uses every letter of the alphabet. Which of these is one?', a: ['The quick brown fox jumps over the lazy dog', 'The lazy dog sleeps all day long', 'A big black bear sat on a bun', 'Every cat likes warm milk'] },
    { q: 'Which word has the most syllables?', a: ['Encyclopedia', 'Dictionary', 'Alphabet', 'Grammar'] },
    { q: 'What does the root “bio” mean, as in “biology”?', a: ['Life', 'Earth', 'Water', 'Book'] },
    { q: 'What does the root “tele” mean, as in “telephone”?', a: ['Far', 'Sound', 'Near', 'Write'] },
  ],
  // Every word's quiz, but a question two words ask alike (“What is a
  // diamond?” on diamond and on jewelry) only the first time.
  english: ENGLISH_WORDS.flatMap(({ word, emoji, ko, quiz }) => quiz.map(({ q, a }) => ({ q, a, word: { word, emoji, ko } }))).filter((b, i, all) => all.findIndex((o) => o.q === b.q) === i),
};

// How many times in a row a question must be answered right to be learnt:
// after that it is never asked of you again.
export const LEARNT_AFTER = 3;

// What tells one question from another, in the quiz book: its words, and
// its program or chess position for a question that shows one (the Coding
// Olympiad asks “What does this program print?” of many, and the Chess
// Olympiad which move is checkmate).
export const questionKey = ({ q, code, fen }) => [q, code, fen].filter(Boolean).join('\n');

// Each bank's questions, to know a question of it when one is filed.
const ASKED = Object.fromEntries(Object.entries(QUESTION_BANKS).map(([level, bank]) => [level, new Set(bank.map(questionKey))]));

// Your quiz book: each quiz's questions you have been getting right, with
// how many times in a row, and the ones learnt (LEARNT_AFTER times):
// { [level]: { [questionKey]: times right in a row } }. Kept on this
// device for whoever is playing (game.js, storage.js), like the Study
// Desk's notebook; a question no longer in its bank is let go.
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
  const learnt = bank.reduce((n, b) => n + (isLearnt(book, level, questionKey(b)) ? 1 : 0), 0);
  return { learnt, left: bank.length - learnt, total: bank.length };
}

// A quiz of a level, `size` questions picked out of the bank and shuffled, and
// each one's answers shuffled with them: { level, questions: [{ q, key,
// choices, answer }] }, answer the place in choices the right one landed. Never a
// question learnt in `book` (your quiz book), so a quiz of a level all
// learnt asks nothing, and one nearly so fewer than `size`. The same seed
// and book make the same quiz, so a page put right can say what was asked.
export function makeQuiz(level, seed = 1, size = QUIZ_SIZE, book = null) {
  const bank = QUESTION_BANKS[QUIZ_LEVELS[level]?.key];
  if (!bank) return { level, questions: [] };
  const rng = new Rng(seed);
  const picks = [];
  const left = [...bank.keys()].filter((i) => !isLearnt(book, level, questionKey(bank[i])));
  for (let i = 0, n = Math.min(size, left.length); i < n; i++) {
    const at = Math.floor(rng.next() * left.length);
    picks.push(bank[left.splice(at, 1)[0]]);
  }
  return {
    level,
    questions: picks.map(({ q, pic, code, fen, word, a }) => {
      const choices = [...a];
      // The answers go where they land, and the right one (written first)
      // remembers where that was.
      for (let i = choices.length - 1; i > 0; i--) {
        const j = Math.floor(rng.next() * (i + 1));
        [choices[i], choices[j]] = [choices[j], choices[i]];
      }
      return { q, key: questionKey({ q, code, fen }), ...(pic && { pic }), ...(code && { code }), ...(fen && { fen }), ...(word && { word }), choices, answer: choices.indexOf(a[0]) };
    }),
  };
}
