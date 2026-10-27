// Typing, at any Computer (a piece of furniture, blocks.js) that is not
// showing someone's work (screens.js): ⌨️ Typing practice, a line of keys or
// words to copy, row by row from the home row up, with the next key lit on
// a keyboard and your speed and accuracy at the end; and 🌧️ Word Rain, a
// game where words fall from the top of the screen and typing one pops it
// before it reaches the bottom.
import { cellNear } from './arcade.js';
import { isComputer } from './screens.js';

// The computer to sit at nearest a body standing beside it: { x, y, z, key }
// of its cell, or null. It stands on a table, so up to a cell over your feet.
export const computerNear = (world, body, reach = 2.2) => cellNear(world, body, (id) => (isComputer(id) ? {} : null), reach, 1);

// The keyboard, row by row, as it is drawn (qwerty, letters only).
export const KEY_ROWS = ['qwertyuiop', 'asdfghjkl;', 'zxcvbnm,./'];

// Which finger types each key, 0 (left little finger) to 7 (right little
// finger), so the keyboard can colour each finger's keys alike; the
// thumbs have the space bar.
export const FINGER_OF = (() => {
  const out = { ' ': 8 };
  for (const row of KEY_ROWS) [...row].forEach((k, i) => (out[k] = i < 4 ? i : i === 4 ? 3 : i === 5 ? 4 : Math.min(7, i - 2)));
  return out;
})();

// Short, easy words children know, by length: Word Rain starts with the
// shortest and gets longer as you score.
const WORDS = [
  ['cat', 'dog', 'sun', 'sea', 'egg', 'hat', 'pig', 'cow', 'bee', 'owl', 'fox', 'bus', 'car', 'red', 'map', 'cup', 'box', 'ant', 'bat', 'hen', 'jam', 'pen', 'toy', 'zoo', 'run', 'fun', 'big', 'yes'],
  ['fish', 'frog', 'tree', 'star', 'moon', 'cake', 'bird', 'ship', 'rain', 'snow', 'book', 'ball', 'duck', 'bear', 'lion', 'milk', 'king', 'kite', 'boat', 'nest', 'rock', 'jump', 'play', 'sand', 'leaf', 'blue', 'pink', 'gold'],
  ['apple', 'happy', 'tiger', 'horse', 'house', 'pizza', 'river', 'cloud', 'sheep', 'mouse', 'train', 'beach', 'candy', 'smile', 'grass', 'lemon', 'piano', 'robot', 'green', 'shell', 'zebra', 'magic', 'water', 'party'],
  ['island', 'rabbit', 'monkey', 'turtle', 'dragon', 'flower', 'banana', 'cookie', 'garden', 'rocket', 'castle', 'pirate', 'friend', 'orange', 'purple', 'spider', 'window', 'yellow', 'puzzle', 'school', 'summer', 'winter'],
  ['dinosaur', 'elephant', 'rainbow', 'butterfly', 'penguin', 'dolphin', 'volcano', 'treasure', 'giraffe', 'kangaroo', 'pumpkin', 'unicorn', 'sandwich', 'sunflower', 'computer', 'blanket', 'chicken', 'mermaid'],
];

const pick = (list, rng) => list[Math.floor(rng() * list.length)];

// The lessons, in order: each a set of keys to practise on its own, or
// words to type. A key lesson's line is little groups of its keys.
export const LESSONS = [
  { key: 'home', icon: '🏠', name: 'Home row', keys: 'asdfjkl;', text: 'Rest your fingers on A S D F and J K L ; — the bumps on F and J help you find them.' },
  { key: 'home2', icon: '🏡', name: 'Home row and G H', keys: 'asdfghjkl', text: 'Your pointer fingers reach in for G and H.' },
  { key: 'top', icon: '⬆️', name: 'Top row', keys: 'qwertyuiop', text: 'Reach up from the home row, then come back home.' },
  { key: 'bottom', icon: '⬇️', name: 'Bottom row', keys: 'zxcvbnm', text: 'Curl your fingers down, then come back home.' },
  { key: 'short', icon: '🐱', name: 'Short words', words: [0, 1], text: 'Little words, with a space between them.' },
  { key: 'long', icon: '🦕', name: 'Long words', words: [2, 3, 4], text: 'Longer words — go slowly and get every letter right.' },
];

export const lessonOf = (key) => LESSONS.find((l) => l.key === key) ?? LESSONS[0];

// A line to copy for lesson `l`: about `len` characters, groups or words
// with single spaces, never ending in one.
export function lessonLine(l, rng = Math.random, len = 40) {
  const parts = [];
  let n = 0;
  while (n <= len) {
    let p;
    if (l.words) p = pick(WORDS[pick(l.words, rng)], rng);
    else {
      const size = 2 + Math.floor(rng() * 3);
      p = '';
      for (let i = 0; i < size; i++) p += pick(l.keys, rng);
    }
    parts.push(p);
    n += p.length + 1;
  }
  return parts.join(' ');
}

// How a try at copying `target` went, `typed` being what is in the box after
// `ms`: { right (characters typed right), wrong, done (all of it typed),
// accuracy (0-100), wpm (words a minute, a word being 5 characters right) }.
export function typingScore(target, typed, ms) {
  let right = 0;
  let wrong = 0;
  for (let i = 0; i < typed.length; i++) {
    if (typed[i] === target[i]) right++;
    else wrong++;
  }
  const min = Math.max(ms, 1000) / 60000;
  return {
    right,
    wrong,
    done: typed.length >= target.length,
    accuracy: typed.length ? Math.round((right / typed.length) * 100) : 100,
    wpm: Math.round(right / 5 / min),
  };
}

// 🌧️ Word Rain. Words fall from the top (y 0) to the ground (y 1); type one
// and it pops for a point, and every one that lands loses a heart. More
// points bring longer words, falling faster and more often.
export const RAIN_HEARTS = 3;

export class WordRain {
  constructor(rng = Math.random) {
    this.rng = rng;
    this.words = [];
    this.score = 0;
    this.hearts = RAIN_HEARTS;
    this.over = false;
    this.time = 0;
    this.next = 0;
    this.id = 0;
    // What happened since the page last looked: { kind: 'pop' | 'land', word }.
    this.events = [];
  }

  // How hard it is now: 0, 1, 2, ... every 5 points.
  get level() {
    return Math.floor(this.score / 5);
  }

  // How long a word takes to fall, in seconds, and the wait between words.
  get fallTime() {
    return Math.max(4, 11 - this.level * 0.8);
  }

  get gap() {
    return Math.max(1.1, 3 - this.level * 0.25);
  }

  spawn() {
    const len = Math.min(WORDS.length - 1, Math.floor(this.level / 2) + (this.rng() < 0.3 ? 1 : 0));
    const taken = new Set(this.words.map((w) => w.text));
    let text = pick(WORDS[len], this.rng);
    for (let i = 0; i < 5 && taken.has(text); i++) text = pick(WORDS[len], this.rng);
    if (taken.has(text)) return;
    this.words.push({ id: ++this.id, text, x: 0.1 + this.rng() * 0.8, y: 0, speed: 1 / this.fallTime });
  }

  // Time goes on by dt seconds.
  step(dt) {
    if (this.over) return;
    this.time += dt;
    this.next -= dt;
    if (this.next <= 0 || !this.words.length) {
      this.spawn();
      this.next = this.gap;
    }
    for (const w of this.words) w.y += w.speed * dt;
    for (const w of this.words.filter((w) => w.y >= 1)) {
      this.words.splice(this.words.indexOf(w), 1);
      this.hearts--;
      this.events.push({ kind: 'land', word: w });
    }
    if (this.hearts <= 0) {
      this.hearts = 0;
      this.over = true;
    }
  }

  // What is in the box: a falling word it spells pops (the lowest, if it
  // is there twice). True if one did, and the box should empty.
  type(text) {
    const t = text.trim().toLowerCase();
    if (this.over || !t) return false;
    const hits = this.words.filter((w) => w.text === t);
    if (!hits.length) return false;
    const w = hits.reduce((a, b) => (b.y > a.y ? b : a));
    this.words.splice(this.words.indexOf(w), 1);
    this.score++;
    this.events.push({ kind: 'pop', word: w });
    return true;
  }

  // The falling words what is typed so far is the start of, for lighting
  // them up as you go.
  matching(text) {
    const t = text.trim().toLowerCase();
    return t ? this.words.filter((w) => w.text.startsWith(t)) : [];
  }
}
