// Words for players: names (typed freely, or rolled from a friendly word and
// an animal), and the ready-made phrases and stickers talking is done with,
// which the host checks everything it receives against.
import { TOY_BRICKS } from './blocks.js';

export const NAME_WORDS = [
  'Happy', 'Sunny', 'Bouncy', 'Sparkly', 'Cozy', 'Jolly', 'Brave', 'Clever', 'Giggly', 'Fluffy',
  'Speedy', 'Sleepy', 'Silly', 'Lucky', 'Gentle', 'Cheery', 'Zippy', 'Bubbly', 'Starry', 'Merry',
  'Snuggly', 'Twinkly', 'Peppy', 'Friendly', 'Kind', 'Swift', 'Tiny', 'Mighty', 'Magic', 'Rosy',
  'Minty', 'Dreamy', 'Wiggly', 'Chirpy', 'Breezy', 'Dazzling', 'Curious', 'Daring', 'Frosty', 'Honey',
];
export const NAME_ANIMALS = [
  'Panda', 'Bunny', 'Kitten', 'Puppy', 'Otter', 'Koala', 'Penguin', 'Fox', 'Owl', 'Duckling',
  'Hedgehog', 'Unicorn', 'Dragon', 'Dolphin', 'Turtle', 'Bear', 'Lamb', 'Chick', 'Frog', 'Llama',
  'Robin', 'Star', 'Cloud', 'Rainbow', 'Cupcake', 'Muffin', 'Button', 'Comet', 'Seal', 'Squirrel',
  'Pony', 'Beaver', 'Hamster', 'Parrot', 'Whale', 'Tiger', 'Lion', 'Monkey', 'Raccoon', 'Moth',
];

const pick = (list, random) => list[Math.floor(random() * list.length)];

export function randomName(random = Math.random) {
  return `${pick(NAME_WORDS, random)} ${pick(NAME_ANIMALS, random)}`;
}

// A name rolled from the lists: "Sunny Otter", or "Sunny Otter 2" when two
// players on an island rolled the same one.
export function isMadeUpName(name) {
  if (typeof name !== 'string') return false;
  const m = /^([A-Z][a-z]+) ([A-Z][a-z]+)(?: ([2-9]))?$/.exec(name);
  return Boolean(m && NAME_WORDS.includes(m[1]) && NAME_ANIMALS.includes(m[2]));
}

// A player's name: anything typed, up to NAME_MAX letters, numbers, signs
// and spaces, as typed (in NFC, trimmed, spaces inside made one), with
// nothing invisible in it. An island adds " 2" when two players there have
// the same one, so two more are allowed.
export const NAME_MAX = 32;
export const cleanName = (v) => (typeof v === 'string' ? v.normalize('NFC').trim().replace(/\s+/gu, ' ') : '');

export function isValidName(name) {
  return typeof name === 'string' && name !== '' && name === cleanName(name) && [...name].length <= NAME_MAX + 2 && !/\p{C}/u.test(name);
}

export const ISLAND_WORDS = {
  sunny: ['Sunny', 'Sparkle', 'Cozy', 'Rainbow', 'Honey', 'Coconut', 'Clover', 'Blossom', 'Seashell', 'Starfish', 'Lemon', 'Maple'],
  snowy: ['Snowflake', 'Frosty', 'Mitten', 'Twinkle', 'Winter', 'Icicle', 'Cocoa', 'Snowball', 'Pinecone', 'Starlight', 'Snuggle', 'Aurora'],
  candy: ['Candy', 'Sugar', 'Gumdrop', 'Lollipop', 'Marshmallow', 'Cupcake', 'Sprinkle', 'Bubblegum', 'Toffee', 'Jellybean', 'Cookie', 'Sherbet'],
  flat: ['Builder', 'Brick', 'Meadow', 'Sunny', 'Happy', 'Grassy', 'Wide', 'Clover', 'Daisy', 'Breezy', 'Maple', 'Buttercup'],
};
export const ISLAND_PLACES = ['Island', 'Cove', 'Bay', 'Isle', 'Meadow', 'Hills', 'Harbor', 'Beach', 'Valley', 'Garden', 'Village', 'Park'];

export function randomIslandName(theme = 'sunny', random = Math.random) {
  const words = ISLAND_WORDS[theme] ?? ISLAND_WORDS.sunny;
  const place = theme === 'flat' ? pick(['Meadow', 'Park', 'Fields', 'Village', 'Plains'], random) : pick(ISLAND_PLACES, random);
  return `${pick(words, random)} ${place}`;
}

export function isValidIslandName(name) {
  if (typeof name !== 'string') return false;
  const m = /^([A-Z][a-z]+) ([A-Z][a-z]+)$/.exec(name);
  if (!m) return false;
  const words = Object.values(ISLAND_WORDS).flat();
  return words.includes(m[1]) && [...ISLAND_PLACES, 'Fields', 'Plains'].includes(m[2]);
}

// Things to say. The index is what travels over the network.
export const PHRASES = [
  'Hi!', 'Hello, friend!', 'Bye bye!', 'Thank you!', "You're welcome!", 'Yes!', 'No, thanks.', 'Wow!',
  'So cool!', 'I love it!', 'Good job!', "Let's build!", 'Come here!', 'Follow me!', 'Look at this!', 'Wait for me!',
  'Help, please!', 'Oops!', "Let's play!", 'Hooray!', 'Good morning!', 'Good night!', "Let's be friends!", 'Nice house!',
  'What should we build?', "Let's go swimming!", 'I found fruit!', 'Race you!', 'Ready?', 'High five!', 'Sorry!', 'Take a picture!',
];

export const STICKERS = ['😀', '😂', '😍', '🥰', '😮', '😴', '🤔', '😎', '👍', '👋', '❤️', '⭐', '🌈', '🎉', '🍎', '🌸', '🐰', '🏠', '🎵', '✨'];

export const EMOTES = [
  { key: 'wave', name: 'Wave', icon: '👋' },
  { key: 'dance', name: 'Dance', icon: '💃' },
  { key: 'cheer', name: 'Cheer', icon: '🙌' },
  { key: 'hearts', name: 'Love', icon: '💖' },
  { key: 'clap', name: 'Clap', icon: '👏' },
  { key: 'sleepy', name: 'Sleepy', icon: '😴' },
  { key: 'laugh', name: 'Giggle', icon: '😆' },
  { key: 'surprise', name: 'Surprise', icon: '😮' },
];
export const EMOTE_KEYS = EMOTES.map((e) => e.key);

// ---------------------------------------------------------------- looks

export const ANIMALS = [
  { key: 'bunny', name: 'Bunny', icon: '🐰', fur: 'white' },
  { key: 'cat', name: 'Cat', icon: '🐱', fur: 'orange' },
  { key: 'bear', name: 'Bear', icon: '🐻', fur: 'brown' },
  { key: 'puppy', name: 'Puppy', icon: '🐶', fur: 'tan' },
  { key: 'fox', name: 'Fox', icon: '🦊', fur: 'orange' },
  { key: 'panda', name: 'Panda', icon: '🐼', fur: 'white' },
  { key: 'frog', name: 'Frog', icon: '🐸', fur: 'mint' },
  { key: 'pig', name: 'Piggy', icon: '🐷', fur: 'pink' },
  { key: 'mouse', name: 'Mouse', icon: '🐭', fur: 'gray' },
  { key: 'koala', name: 'Koala', icon: '🐨', fur: 'gray' },
];
export const FUR_COLORS = {
  white: '#f8f4ee',
  cream: '#f5e3c3',
  tan: '#e0b986',
  orange: '#f0a04b',
  brown: '#a7714a',
  gray: '#b4b8c2',
  pink: '#f7b8c8',
  mint: '#98dca6',
  lavender: '#cbb5f0',
  sky: '#9fd4f5',
  yellow: '#f6dc74',
  charcoal: '#5b5f69',
};
export const SHIRT_COLORS = TOY_BRICKS.map((id, i) => i).filter((i) => i !== 13); // not charcoal
export const HATS = [
  { key: 'none', name: 'No hat', icon: '🙂' },
  { key: 'cap', name: 'Cap', icon: '🧢' },
  { key: 'flower', name: 'Flower', icon: '🌼' },
  { key: 'bow', name: 'Bow', icon: '🎀' },
  { key: 'party', name: 'Party hat', icon: '🥳' },
  { key: 'crown', name: 'Crown', icon: '👑' },
  { key: 'beanie', name: 'Beanie', icon: '🧶' },
  { key: 'sprout', name: 'Leaf', icon: '🌱' },
  { key: 'straw', name: 'Sun hat', icon: '👒' },
  { key: 'headphones', name: 'Headphones', icon: '🎧' },
];

export function randomLook(random = Math.random) {
  const animal = pick(ANIMALS, random);
  return { animal: animal.key, fur: animal.fur, shirt: pick(SHIRT_COLORS, random), hat: pick(HATS, random).key };
}

export function cleanLook(look, random = Math.random) {
  const fallback = randomLook(random);
  const animal = ANIMALS.some((a) => a.key === look?.animal) ? look.animal : fallback.animal;
  return {
    animal,
    fur: Object.hasOwn(FUR_COLORS, look?.fur) ? look.fur : ANIMALS.find((a) => a.key === animal).fur,
    shirt: SHIRT_COLORS.includes(look?.shirt) ? look.shirt : fallback.shirt,
    hat: HATS.some((h) => h.key === look?.hat) ? look.hat : 'none',
  };
}
