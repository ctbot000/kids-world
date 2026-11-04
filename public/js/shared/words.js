// Words for players: names (typed freely, or rolled from a friendly word and
// an animal), and talking: typed, or ready-made phrases and stickers. The
// host tidies and checks everything it receives.
import { TOY_BRICKS } from './blocks.js';
import { cleanLevel } from './levels.js';
import { outfitOf, shoesOf, skatesOf, weaponOf, wingsOf } from './shop.js';

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
  volcano: ['Ember', 'Cinder', 'Lava', 'Magma', 'Smoky', 'Ash', 'Pepper', 'Flame', 'Toasty', 'Crater', 'Ruby', 'Spark'],
  park: ['Funland', 'Jolly', 'Whirly', 'Carnival', 'Popcorn', 'Lollipop', 'Ticket', 'Giggle', 'Wonder', 'Rollercoaster', 'Confetti', 'Merry'],
  race: ['Speedy', 'Zoom', 'Turbo', 'Checkered', 'Vroom', 'Thunder', 'Rocket', 'Nitro', 'Racer', 'Pitstop', 'Swift', 'Dash'],
  escape: ['Mystery', 'Puzzle', 'Secret', 'Riddle', 'Hidden', 'Clue', 'Keyhole', 'Locked', 'Sneaky', 'Tricky', 'Puzzling', 'Treasure'],
  zoo: ['Safari', 'Jungle', 'Wild', 'Paws', 'Whisker', 'Pawprint', 'Roar', 'Tusk', 'Stripy', 'Spotty', 'Hoof', 'Feather'],
  flat: ['Builder', 'Brick', 'Meadow', 'Sunny', 'Happy', 'Grassy', 'Wide', 'Clover', 'Daisy', 'Breezy', 'Maple', 'Buttercup'],
};
export const ISLAND_PLACES = ['Island', 'Cove', 'Bay', 'Isle', 'Meadow', 'Hills', 'Harbor', 'Beach', 'Valley', 'Garden', 'Village', 'Park'];

export function randomIslandName(theme = 'sunny', random = Math.random) {
  const words = ISLAND_WORDS[theme] ?? ISLAND_WORDS.sunny;
  const place = theme === 'flat' ? pick(['Meadow', 'Park', 'Fields', 'Village', 'Plains'], random) : theme === 'park' ? pick(['Park', 'Island', 'Fair', 'Land', 'Pier', 'Isle'], random) : theme === 'race' ? pick(['Speedway', 'Raceway', 'Circuit', 'Island', 'Isle', 'Track'], random) : theme === 'zoo' ? pick(['Zoo', 'Safari', 'Island', 'Isle', 'Park', 'Gardens'], random) : theme === 'escape' ? pick(['Manor', 'House', 'Island', 'Isle', 'Mansion', 'Hall'], random) : pick(ISLAND_PLACES, random);
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
  'What should we build?', "Let's go swimming!", 'I found fruit!', 'Race you!', 'Ready?', 'High five!', 'Sorry!', 'Take a picture!', 'Tea time!', 'Happy birthday!', 'Make a wish!',
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

// Who you can be: a kid, a grown-up, or one of the little animals. A kid or
// a grown-up has skin and hair (skin, hair, hairColor in the look) where an
// animal has fur; a grown-up stands taller, and may have glasses or a beard
// (face in the look).
export const KID = 'kid';
export const GROWN_UP = 'grownup';
export const ANIMALS = [
  { key: KID, name: 'Kid', icon: '🧒', fur: 'tan' },
  { key: GROWN_UP, name: 'Grown-up', icon: '🧑', fur: 'tan' },
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
  { key: 'alien', name: 'Alien', icon: '👽', fur: 'lime' },
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
  lime: '#a6e070',
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

// Something extra to wear, free like a hat: sunglasses (only on a kid or a
// grown-up, who has a face for them), a necklace, a tie, a backpack or a
// watch (render/avatar.js).
export const ACCESSORIES = [
  { key: 'none', name: 'Nothing', icon: '🙂' },
  { key: 'sunglasses', name: 'Sunglasses', icon: '🕶️', person: true },
  { key: 'necklace', name: 'Necklace', icon: '📿' },
  { key: 'tie', name: 'Tie', icon: '👔' },
  { key: 'backpack', name: 'Backpack', icon: '🎒' },
  { key: 'watch', name: 'Watch', icon: '⌚' },
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
// What a grown-up has on their face, besides a smile.
export const FACES = [
  { key: 'none', name: 'Just me' },
  { key: 'glasses', name: 'Glasses' },
  { key: 'moustache', name: 'Moustache' },
  { key: 'beard', name: 'Beard' },
  { key: 'glasses-beard', name: 'Glasses and beard' },
];
// Whether a kid is a boy or a girl (a grown-up a man or a woman), shown in
// their face and their icon; a look from before there was a choice has none.
export const GENDERS = [
  { key: 'boy', name: 'Boy', grown: 'Man' },
  { key: 'girl', name: 'Girl', grown: 'Woman' },
];
// How tall you are, and how you are built: for everyone, an animal too. by:
// how much taller (or shorter) than the middle a kid and a grown-up stand,
// the whole body drawn that much bigger; a grown-up tall stays under a
// doorway two blocks high. width: how wide the body is built, and belly how
// far a sturdy tummy comes out (render/avatar.js).
export const HEIGHTS = [
  { key: 'short', name: 'Short', icon: '🐣', kid: -0.12, grown: -0.14 },
  { key: 'middle', name: 'Middle', icon: '🙂', kid: 0, grown: 0 },
  { key: 'tall', name: 'Tall', icon: '🦒', kid: 0.1, grown: 0.05 },
];
export const BODIES = [
  { key: 'slim', name: 'Slim', icon: '🌿', width: 0.84, belly: 0 },
  { key: 'medium', name: 'Medium', icon: '🙂', width: 1, belly: 0 },
  { key: 'sturdy', name: 'Sturdy', icon: '🐻', width: 1.2, belly: 0.03 },
];
// A person's face shape, from the eyes down: how long the jaw is, how much it
// narrows to the chin, how late it starts to (square: late), how much
// fuller the cheeks are (wide), and how far the chin comes forward, each
// times a kid's or a grown-up's own.
export const HEADS = [
  { key: 'oval', name: 'Oval', icon: '🥚', jaw: 1, narrow: 1, late: 1.6, wide: 0, chin: 1 },
  { key: 'round', name: 'Round', icon: '🌕', jaw: 0.84, narrow: 0.45, late: 1.6, wide: 0.1, chin: 0.6 },
  { key: 'long', name: 'Long', icon: '🥒', jaw: 1.22, narrow: 1.15, late: 1.6, wide: -0.07, chin: 1.1 },
  { key: 'square', name: 'Square', icon: '🟧', jaw: 1.02, narrow: 0.4, late: 4, wide: 0.07, chin: 1.15 },
]
export const heightOf = (look) => HEIGHTS.find((h) => h.key === look?.height) ?? HEIGHTS[1];
export const buildOf = (look) => BODIES.find((b) => b.key === look?.build) ?? BODIES[1];
export const headOf = (look) => (isPerson(look) && HEADS.find((h) => h.key === look.head)) || HEADS[0];
// What a kid is when nothing (or nothing that makes sense) says otherwise.
const KID_LOOK = { skin: 'golden', hair: 'short', hairColor: 'brown' };

// Whether a look has skin and hair: a kid or a grown-up.
export const isPerson = (look) => look?.animal === KID || look?.animal === GROWN_UP;
// A person's hair style, or '' for an animal.
export const lookHair = (look) => (isPerson(look) ? look.hair : '');
// How much taller a grown-up stands than a kid (or an animal), whose head
// top is KID_TALL up; how much taller than that someone stands, for their
// height too (see HEIGHTS); and how much bigger than a kid or a grown-up of
// the middle height they are drawn for it.
export const GROWN_TALL = 0.32;
export const KID_TALL = 1.41;
export const lookTall = (look) => (look?.animal === GROWN_UP ? GROWN_TALL + heightOf(look).grown : heightOf(look).kid);
export const lookScale = (look) => {
  const middle = KID_TALL + (look?.animal === GROWN_UP ? GROWN_TALL : 0);
  return (KID_TALL + lookTall(look)) / middle;
};

// What friends see of you in a list: your animal, or a kid or grown-up with your skin.
export function lookIcon(look) {
  const tone = SKIN_EMOJI[look?.skin] ?? '';
  const girl = look?.gender === 'girl';
  if (look?.animal === KID) return `${{ boy: '👦', girl: '👧' }[look.gender] ?? '🧒'}${tone}`;
  if (look?.animal === GROWN_UP && look.face?.includes('beard')) return `🧔${tone}${girl ? '\u200D\u2640\uFE0F' : ''}`;
  if (look?.animal === GROWN_UP) return `${{ boy: '👨', girl: '👩' }[look.gender] ?? '🧑'}${tone}`;
  return ANIMALS.find((a) => a.key === look?.animal)?.icon ?? '🙂';
}

// An animal (or a kid or a grown-up), a T-shirt and a hat: three draws, whatever comes up.
function someLook(random) {
  const animal = pick(ANIMALS, random);
  return { animal: animal.key, fur: animal.fur, shirt: pick(SHIRT_COLORS, random), hat: pick(HATS, random).key, height: pick(HEIGHTS, random).key, build: pick(BODIES, random).key };
}

export function randomLook(random = Math.random) {
  const look = someLook(random);
  if (!isPerson(look)) return look;
  const person = { ...look, gender: pick(GENDERS, random).key, skin: pick(Object.keys(SKIN_TONES), random), hair: pick(HAIRS, random).key, hairColor: pick(Object.keys(HAIR_COLORS), random), head: pick(HEADS, random).key };
  return look.animal === GROWN_UP ? { ...person, face: pick(FACES, random).key } : person;
}

// A look as it may be shown: anything unknown in it replaced. Skin and hair
// are kept only for a kid or a grown-up, a face only for a grown-up, and a
// pet only when there is one; a gender only when one was chosen.
export function cleanLook(look, random = Math.random) {
  const fallback = someLook(random);
  const animal = ANIMALS.some((a) => a.key === look?.animal) ? look.animal : fallback.animal;
  let clean = {
    animal,
    fur: Object.hasOwn(FUR_COLORS, look?.fur) ? look.fur : ANIMALS.find((a) => a.key === animal).fur,
    shirt: SHIRT_COLORS.includes(look?.shirt) ? look.shirt : fallback.shirt,
    hat: HATS.some((h) => h.key === look?.hat) ? look.hat : 'none',
  };
  // An accessory, only once chosen, and sunglasses only on a face.
  const acc = ACCESSORIES.find((a) => a.key === look?.acc && a.key !== 'none');
  if (acc && (!acc.person || isPerson({ animal }))) clean.acc = acc.key;
  // How tall and how built, only once chosen.
  if (HEIGHTS.some((h) => h.key === look?.height)) clean.height = look.height;
  if (BODIES.some((b) => b.key === look?.build)) clean.build = look.build;
  if (isPerson({ animal })) {
    clean = {
      ...clean,
      skin: Object.hasOwn(SKIN_TONES, look?.skin) ? look.skin : KID_LOOK.skin,
      hair: HAIRS.some((h) => h.key === look?.hair) ? look.hair : KID_LOOK.hair,
      hairColor: Object.hasOwn(HAIR_COLORS, look?.hairColor) ? look.hairColor : KID_LOOK.hairColor,
    };
    if (GENDERS.some((g) => g.key === look?.gender)) clean.gender = look.gender;
    if (HEADS.some((h) => h.key === look?.head)) clean.head = look.head;
  }
  if (animal === GROWN_UP) clean.face = FACES.some((f) => f.key === look?.face) ? look.face : 'none';
  // A toy weapon from the shop, in your hand (see shop.js).
  if (weaponOf(look?.weapon)) clean.weapon = look.weapon;
  // Clothes from the shop, over your t-shirt (see shop.js CLOTHES).
  if (outfitOf(look?.outfit)) clean.outfit = look.outfit;
  // Running shoes and flying gear from the shop, on your feet and your back.
  if (shoesOf(look?.shoes)) clean.shoes = look.shoes;
  if (wingsOf(look?.wings)) clean.wings = look.wings;
  // Or roller skates, in place of the shoes.
  if (skatesOf(look?.skates)) clean.skates = look.skates;
  // Your level, on your name tag (see levels.js).
  if (cleanLevel(look?.level)) clean.level = look.level;
  const pet = cleanPet(look?.pet);
  return pet ? { ...clean, pet } : clean;
}

// ---------------------------------------------------------------- pets

// A pet of your own, which goes everywhere you go (see pets.js): its kind,
// its coat and its name are part of your look, as look.pet (none without
// one), so friends see it and a login brings it along. The first coat and
// the first name are a kind's own, for one that came without them. A
// parrot, a long-tailed tit and a baby dragon fly; the others walk, hop
// and swim.
export const PETS = [
  { key: 'puppy', name: 'Puppy', icon: '🐶', coats: ['tan', 'brown', 'cream', 'white', 'gray', 'charcoal'], names: ['Biscuit', 'Buddy', 'Waffles', 'Peanut', 'Coco', 'Bingo', 'Rolo', 'Noodle', 'Scout', 'Teddy'] },
  { key: 'kitten', name: 'Kitten', icon: '🐱', coats: ['orange', 'gray', 'white', 'charcoal', 'cream', 'brown'], names: ['Whiskers', 'Mittens', 'Luna', 'Tiger', 'Pumpkin', 'Socks', 'Muffin', 'Pebbles', 'Ginger', 'Mochi'] },
  { key: 'bunny', name: 'Bunny', icon: '🐰', coats: ['white', 'cream', 'brown', 'gray', 'charcoal', 'pink'], names: ['Thumper', 'Clover', 'Snowball', 'Cocoa', 'Nibbles', 'Honey', 'Pip', 'Marshmallow', 'Hopscotch', 'Daisy'] },
  { key: 'hamster', name: 'Hamster', icon: '🐹', coats: ['tan', 'orange', 'cream', 'white', 'gray', 'brown'], names: ['Nugget', 'Squeaky', 'Cheeks', 'Fuzzy', 'Acorn', 'Toffee', 'Crumbs', 'Popcorn', 'Sesame', 'Hazel'] },
  { key: 'piglet', name: 'Piglet', icon: '🐷', coats: ['pink', 'cream', 'brown', 'charcoal'], names: ['Truffle', 'Rosie', 'Snuffles', 'Bubblegum', 'Poppy', 'Dumpling', 'Petunia', 'Button', 'Oinky', 'Sprout'] },
  { key: 'duckling', name: 'Duckling', icon: '🐥', coats: ['yellow', 'cream', 'white', 'brown'], names: ['Puddles', 'Waddles', 'Quackers', 'Sunny', 'Dandelion', 'Pipsqueak', 'Ducky', 'Splash', 'Lemon', 'Bubbles'] },
  { key: 'parrot', name: 'Parrot', icon: '🦜', flies: true, coats: ['green', 'blue', 'red', 'yellow'], names: ['Polly', 'Kiwi', 'Mango', 'Rio', 'Captain', 'Pepper', 'Echo', 'Tango', 'Skye', 'Chatter'] },
  { key: 'tit', name: 'Long-tailed Tit', icon: '🐦', flies: true, coats: ['white', 'pink', 'cream'], names: ['Mochi', 'Snowy', 'Cotton', 'Puffin', 'Dango', 'Fluff', 'Pebble', 'Button', 'Tinsel', 'Daisy'] },
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
