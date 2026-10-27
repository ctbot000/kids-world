import assert from 'node:assert/strict';
import test from 'node:test';
import * as B from '../public/js/shared/blocks.js';
import { addProgress } from '../public/js/shared/keeper.js';
import { XP_FOR } from '../public/js/shared/levels.js';
import { STAT_KEYS, STICKERS } from '../public/js/shared/stickers.js';
import { computerNear, FINGER_OF, KEY_ROWS, LESSONS, lessonLine, RAIN_HEARTS, typingScore, WordRain } from '../public/js/shared/typing.js';
import { World } from '../public/js/shared/world.js';

// A steady stand-in for Math.random.
function rngOf(seed = 1) {
  let s = seed;
  return () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
}

test('typing: the computer beside you is found, on a table or the floor', () => {
  const world = new World(16, 16, 16);
  for (let x = 0; x < 16; x++) for (let z = 0; z < 16; z++) world.set(x, 0, z, B.STONE);
  world.set(5, 2, 5, B.turnedTo(B.COMPUTER, 1));
  assert.equal(computerNear(world, { x: 6.5, y: 1, z: 5.5 })?.key, '5,2,5');
  assert.equal(computerNear(world, { x: 12.5, y: 1, z: 5.5 }), null, 'too far');
  world.set(5, 2, 5, B.AIR);
  world.set(5, 1, 5, B.COMPUTER);
  assert.equal(computerNear(world, { x: 6.5, y: 1, z: 5.5 })?.key, '5,1,5');
});

test('typing: every key has a finger, and each lesson makes a line of only its keys', () => {
  for (const k of KEY_ROWS.join('') + ' ') assert.ok(Number.isInteger(FINGER_OF[k]), k);
  assert.equal(FINGER_OF.f, 3);
  assert.equal(FINGER_OF.j, 4);
  assert.equal(FINGER_OF.a, 0);
  assert.equal(FINGER_OF[';'], 7);
  const rng = rngOf(7);
  for (const l of LESSONS) {
    const line = lessonLine(l, rng);
    assert.ok(line.length >= 40 && line.length < 60, `${l.key}: ${line}`);
    assert.equal(line, line.trim());
    assert.ok(!line.includes('  '));
    if (l.keys) for (const c of line.replaceAll(' ', '')) assert.ok(l.keys.includes(c), `${l.key}: ${c}`);
    else assert.match(line, /^[a-z ]+$/);
  }
});

test('typing: speed and accuracy', () => {
  // 10 characters right in 6 seconds: 2 words in a tenth of a minute.
  assert.deepEqual(typingScore('asdf jkl;a', 'asdf jkl;a', 6000), { right: 10, wrong: 0, done: true, accuracy: 100, wpm: 20 });
  const s = typingScore('asdf', 'axd', 60000);
  assert.equal(s.right, 2);
  assert.equal(s.wrong, 1);
  assert.equal(s.done, false);
  assert.equal(s.accuracy, 67);
  assert.equal(typingScore('asdf', '', 0).accuracy, 100);
});

test('Word Rain: words fall, typing one pops it, and three landing end the game', () => {
  const rain = new WordRain(rngOf(3));
  rain.step(0.1);
  assert.equal(rain.words.length, 1);
  const word = rain.words[0];
  assert.ok(word.text.length === 3 || word.text.length === 4, 'short words first');
  assert.deepEqual(rain.matching(word.text.slice(0, 2)), [word]);
  assert.equal(rain.type('nope'), false);
  assert.equal(rain.type(` ${word.text.toUpperCase()} `), true);
  assert.equal(rain.score, 1);
  assert.deepEqual(rain.events.map((e) => e.kind), ['pop']);
  // Left alone, the words land one by one.
  for (let i = 0; i < 600 && !rain.over; i++) rain.step(0.1);
  assert.ok(rain.over);
  assert.equal(rain.hearts, 0);
  assert.equal(rain.events.filter((e) => e.kind === 'land').length, RAIN_HEARTS);
  rain.step(1);
  assert.equal(rain.type(rain.words[0]?.text ?? 'x'), false, 'nothing pops once it is over');
  // More points, faster and longer words.
  const hard = new WordRain(rngOf(5));
  hard.score = 30;
  assert.ok(hard.fallTime < new WordRain().fallTime);
  hard.step(0.1);
  assert.ok(hard.words[0].text.length >= 6, hard.words[0].text);
});

test('typing counts for XP and stickers, and the best kept from two devices is the higher', () => {
  for (const k of ['typed', 'typewpm', 'rainbest']) {
    assert.ok(STAT_KEYS.includes(k), k);
    assert.ok(XP_FOR[k], k);
  }
  const sticker = (key) => STICKERS.find((s) => s.key === key);
  assert.ok(!sticker('typist').test({ typed: 9 }) && sticker('typist').test({ typed: 10 }));
  assert.ok(sticker('speedy-fingers').test({ typewpm: 20 }));
  assert.ok(sticker('word-rain').test({ rainbest: 25 }));
  const stats = (s) => ({ name: 'a', stats: s });
  const got = addProgress(stats({ typed: 3, typewpm: 12, rainbest: 9 }), stats({ typed: 2, typewpm: 18, rainbest: 4 }));
  assert.equal(got.stats.typed, 5);
  assert.equal(got.stats.typewpm, 18);
  assert.equal(got.stats.rainbest, 9);
});
