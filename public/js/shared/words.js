// Words for players: names (typed freely, or rolled from a friendly word and
// an animal), and talking: typed, or ready-made phrases and stickers. The
// host tidies and checks everything it receives.
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

// Invisible characters, all but what emoji are made of (see cleanChat).
const INVISIBLE = /(?![\u200d\u{e0020}-\u{e007f}])\p{C}/gu;

// An island's name: anything typed, up to ISLAND_NAME_MAX letters, numbers,
// signs, emoji and spaces, tidied as typed talk is. '' for nothing to see, or
// for too much.
export const ISLAND_NAME_MAX = 32;
export function cleanIslandName(raw) {
  if (typeof raw !== 'string') return '';
  const name = raw.normalize('NFC').replace(/\s+/gu, ' ').replace(INVISIBLE, '').replace(/ {2,}/g, ' ').trim();
  return /[\p{L}\p{N}\p{P}\p{S}]/u.test(name) && [...name].length <= ISLAND_NAME_MAX ? name : '';
}

// Typed talk: up to CHAT_MAX letters, numbers, signs, emoji and spaces, as
// typed but tidied (in NFC, any run of spaces or new lines one space), with
// nothing invisible kept but what emoji are made of: the joiners of 👨‍👩‍👧,
// and the tags of flags such as Scotland's. '' for nothing, or for too much.
export const CHAT_MAX = 120;
export function cleanChat(raw) {
  if (typeof raw !== 'string') return '';
  const text = raw.normalize('NFC').replace(/\s+/gu, ' ').replace(INVISIBLE, '').trim();
  return text && [...text].length <= CHAT_MAX ? text : '';
}

// Hangul in it: wrapped at spaces rather than between any two syllables (see .bubble:lang(ko)).
export const langOf = (text) => (/\p{Script=Hangul}/u.test(text) ? 'ko' : '');

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

// Who you can be: a kid, or one of the little animals. A kid has skin and
// hair (skin, hair, hairColor in the look) where an animal has fur.
export const KID = 'kid';
export const ANIMALS = [
  { key: KID, name: 'Kid', icon: '🧒', fur: 'tan' },
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

// A kid's skin, lightest to darkest, and the emoji skin tone for each.
export const SKIN_TONES = {
  fair: '#ffe2cf',
  light: '#f7cfae',
  golden: '#e9b98d',
  tan: '#d29c6c',
  brown: '#a66d47',
  deep: '#73492f',
};
const SKIN_EMOJI = { fair: '\u{1F3FB}', light: '\u{1F3FB}', golden: '\u{1F3FC}', tan: '\u{1F3FD}', brown: '\u{1F3FE}', deep: '\u{1F3FF}' };
export const HAIRS = [
  { key: 'short', name: 'Short' },
  { key: 'spiky', name: 'Spiky' },
  { key: 'curly', name: 'Curly' },
  { key: 'bob', name: 'Bob' },
  { key: 'long', name: 'Long' },
  { key: 'ponytail', name: 'Ponytail' },
  { key: 'pigtails', name: 'Pigtails' },
  { key: 'bun', name: 'Bun' },
];
export const HAIR_COLORS = {
  black: '#2f2b35',
  brown: '#6a4330',
  chestnut: '#9c5f37',
  blonde: '#f1cd6b',
  ginger: '#dc7a3c',
  silver: '#d9dbe4',
  pink: '#f59cc2',
  purple: '#a98ae8',
  blue: '#6cb2ee',
  green: '#7bd19f',
};
// What a kid is when nothing (or nothing that makes sense) says otherwise.
const KID_LOOK = { skin: 'golden', hair: 'short', hairColor: 'brown' };

// What friends see of you in a list: your animal, or a kid with your skin.
export function lookIcon(look) {
  if (look?.animal === KID) return `🧒${SKIN_EMOJI[look.skin] ?? ''}`;
  return ANIMALS.find((a) => a.key === look?.animal)?.icon ?? '🙂';
}

// An animal (or a kid), a T-shirt and a hat: three draws, whatever comes up.
function someLook(random) {
  const animal = pick(ANIMALS, random);
  return { animal: animal.key, fur: animal.fur, shirt: pick(SHIRT_COLORS, random), hat: pick(HATS, random).key };
}

export function randomLook(random = Math.random) {
  const look = someLook(random);
  if (look.animal !== KID) return look;
  return { ...look, skin: pick(Object.keys(SKIN_TONES), random), hair: pick(HAIRS, random).key, hairColor: pick(Object.keys(HAIR_COLORS), random) };
}

// A look as it may be shown: anything unknown in it replaced. A kid's skin
// and hair are kept only for a kid; a pet only when there is one.
export function cleanLook(look, random = Math.random) {
  const fallback = someLook(random);
  const animal = ANIMALS.some((a) => a.key === look?.animal) ? look.animal : fallback.animal;
  let clean = {
    animal,
    fur: Object.hasOwn(FUR_COLORS, look?.fur) ? look.fur : ANIMALS.find((a) => a.key === animal).fur,
    shirt: SHIRT_COLORS.includes(look?.shirt) ? look.shirt : fallback.shirt,
    hat: HATS.some((h) => h.key === look?.hat) ? look.hat : 'none',
  };
  if (animal === KID) {
    clean = {
      ...clean,
      skin: Object.hasOwn(SKIN_TONES, look?.skin) ? look.skin : KID_LOOK.skin,
      hair: HAIRS.some((h) => h.key === look?.hair) ? look.hair : KID_LOOK.hair,
      hairColor: Object.hasOwn(HAIR_COLORS, look?.hairColor) ? look.hairColor : KID_LOOK.hairColor,
    };
  }
  const pet = cleanPet(look?.pet);
  return pet ? { ...clean, pet } : clean;
}

// ---------------------------------------------------------------- pets

// A pet of your own, which goes everywhere you go (see pets.js): its kind,
// its coat and its name are part of your look, as look.pet (none without
// one), so friends see it and a login brings it along. The first coat and
// the first name are a kind's own, for one that came without them. A
// parrot and a baby dragon fly; the others walk, hop and swim.
export const PETS = [
  { key: 'puppy', name: 'Puppy', icon: '🐶', coats: ['tan', 'brown', 'cream', 'white', 'gray', 'charcoal'], names: ['Biscuit', 'Buddy', 'Waffles', 'Peanut', 'Coco', 'Bingo', 'Rolo', 'Noodle', 'Scout', 'Teddy'] },
  { key: 'kitten', name: 'Kitten', icon: '🐱', coats: ['orange', 'gray', 'white', 'charcoal', 'cream', 'brown'], names: ['Whiskers', 'Mittens', 'Luna', 'Tiger', 'Pumpkin', 'Socks', 'Muffin', 'Pebbles', 'Ginger', 'Mochi'] },
  { key: 'bunny', name: 'Bunny', icon: '🐰', coats: ['white', 'cream', 'brown', 'gray', 'charcoal', 'pink'], names: ['Thumper', 'Clover', 'Snowball', 'Cocoa', 'Nibbles', 'Honey', 'Pip', 'Marshmallow', 'Hopscotch', 'Daisy'] },
  { key: 'hamster', name: 'Hamster', icon: '🐹', coats: ['tan', 'orange', 'cream', 'white', 'gray', 'brown'], names: ['Nugget', 'Squeaky', 'Cheeks', 'Fuzzy', 'Acorn', 'Toffee', 'Crumbs', 'Popcorn', 'Sesame', 'Hazel'] },
  { key: 'piglet', name: 'Piglet', icon: '🐷', coats: ['pink', 'cream', 'brown', 'charcoal'], names: ['Truffle', 'Rosie', 'Snuffles', 'Bubblegum', 'Poppy', 'Dumpling', 'Petunia', 'Button', 'Oinky', 'Sprout'] },
  { key: 'duckling', name: 'Duckling', icon: '🐥', coats: ['yellow', 'cream', 'white', 'brown'], names: ['Puddles', 'Waddles', 'Quackers', 'Sunny', 'Dandelion', 'Pipsqueak', 'Ducky', 'Splash', 'Lemon', 'Bubbles'] },
  { key: 'parrot', name: 'Parrot', icon: '🦜', flies: true, coats: ['green', 'blue', 'red', 'yellow'], names: ['Polly', 'Kiwi', 'Mango', 'Rio', 'Captain', 'Pepper', 'Echo', 'Tango', 'Skye', 'Chatter'] },
  { key: 'dragon', name: 'Baby Dragon', icon: '🐲', flies: true, coats: ['green', 'lavender', 'sky', 'pink', 'orange', 'red'], names: ['Sparky', 'Ember', 'Puff', 'Blaze', 'Smudge', 'Toasty', 'Cinder', 'Twinkle', 'Ziggy', 'Scales'] },
];
export const PET_COATS = { ...FUR_COLORS, green: '#5cc96b', blue: '#4f9ff0', red: '#ef5b5b' };

export const petKind = (key) => PETS.find((p) => p.key === key) ?? null;

// A pet as it may be shown: { kind, coat, name }, or null for none. Any name,
// as a player's (up to NAME_MAX, nothing invisible); a coat its kind comes in.
export function cleanPet(raw) {
  const kind = petKind(raw?.kind);
  if (!kind) return null;
  const name = cleanName(raw.name);
  return {
    kind: kind.key,
    coat: kind.coats.includes(raw.coat) ? raw.coat : kind.coats[0],
    name: isValidName(name) && [...name].length <= NAME_MAX ? name : kind.names[0],
  };
}

// A name for a pet of this kind, other than the one it has now (but).
export function randomPetName(kind, random = Math.random, but = '') {
  const names = (petKind(kind) ?? PETS[0]).names.filter((n) => n !== but);
  return pick(names, random);
}
