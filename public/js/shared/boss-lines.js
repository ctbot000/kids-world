// What Adventure Isle's bosses say out loud: before a battle with one starts
// (before), after it ends (after) and, for an episode's last boss popped the
// first time, as it puffs itself up for a second go (again). Each in its own
// voice, the films' cast (scripts/films/cast.js: `cast` says which, the key if
// not), spoken once by scripts/films/boss-voices.mjs (npm run voices) into
// public/audio/voices/<key>-<when>.mp3 (voiceUrl), and shown under its name,
// icon and colour (boss-voice.js).
//
// Keyed by who says it: a boss's kind (bosses.js), a Big Bad's beast kind on
// Toon Isle (each hunts there once), Jinx, or a fright of the Land of Nod
// (nod/bosses.js). Short lines: a few words, said in two or three seconds.
export const BOSS_LINES = {
  // Episode 1: King Grumble's captains, and the King.
  clawbeard: { name: 'Captain Clawbeard', icon: '🦀', color: '#ff7a5a', before: 'Arr! Come and get me, ye landlubbers!', after: 'Arr, ye win! Take yer shiny shard.' },
  puffcap: { name: 'Old Puffcap', icon: '🍄', color: '#c9a0ff', before: 'Ahem! Get off my mushrooms, you rascals!', after: 'Oof! A fair bop. The shard is yours.' },
  frostfang: { name: 'Frostfang', icon: '❄️', color: '#a8e4ff', before: 'Brrr! I will freeze you solid!', after: 'Oh no, I’m all melty!' },
  gumbo: { name: 'Gumbo the Gummy Giant', icon: '🧸', color: '#ff9ad0', before: 'Gumbo… squash… you!', after: 'Gumbo… sorry.' },
  scarabold: { name: 'Sir Scarabold', icon: '🪲', color: '#ffd24a', before: 'Stop right there! None shall pass!', after: 'I yield! The shard is yours.' },
  bogmaw: { name: 'Bogmaw the Bog Toad', icon: '🐸', color: '#8fd16a', before: 'Ribbit! Into the bog with you!', after: 'Ribbit… you win.' },
  glimmershell: { name: 'Old Glimmershell', icon: '🐢', color: '#7fe0d0', before: 'Slowly… but surely… I will get you.', after: 'Well… done… young ones.' },
  baronboo: { name: 'Baron Boo', icon: '🎩', color: '#e0e0ff', before: 'Boo! Are you scared yet?', after: 'Boo hoo! You got me!' },
  moltok: { name: 'Moltok the Lava Golem', icon: '🌋', color: '#ff8a3d', before: 'Feel the heat! Here I come!', after: 'Phew… I’m cooling off.' },
  sprocket: { name: 'Big Sprocket', icon: '🤖', color: '#ffc861', before: 'Intruders detected. Begin stomping.', after: 'Power low. You win. Beep.' },
  nimbus: { name: 'Old Nimbus', icon: '🌩️', color: '#c8d6ff', before: 'Rumble rumble! Here comes the storm!', after: 'Oh… the sun is coming out.' },
  king: { name: 'King Grumble', icon: '👑', color: '#b18cff', cast: 'grumble', before: 'My captains lost? Then I will pop you myself!', again: 'Not so fast! I’m puffing up bigger!', after: 'Oh no, no, no! My Star!' },

  // Episode 2: Queen Grizzle's helpers, and the Queen.
  dotty: { name: 'Lady Dotty', icon: '🐞', color: '#ff6a6a', before: 'Spotted you! Now buzz off!', after: 'Oh dear, my spots are spinning!' },
  bushytail: { name: 'Duke Bushytail', icon: '🐿️', color: '#e8a060', before: 'Paws off my nuts, and my colour!', after: 'All right, all right! Take it!' },
  bumble: { name: 'Baroness Bumble', icon: '🐝', color: '#ffd84d', before: 'Bzzz! Nobody touches my honey!', after: 'Bzzz… fair is fair. Take the colour.' },
  blendalot: { name: 'Sir Blendalot', icon: '🦎', color: '#7ed67e', before: 'You can’t bop what you can’t see!', after: 'Oh! You found me!' },
  inkwell: { name: 'Admiral Inkwell', icon: '🐙', color: '#9c8cff', before: 'All hands on deck! Ink them!', after: 'Ink-credible. You win.' },
  mochi: { name: 'Mochi the Moon Rabbit', icon: '🐇', color: '#f4e8ff', before: 'Catch me if you can! Hop, hop!', after: 'You’re too quick for me!' },
  grizzle: { name: 'Queen Grizzle', icon: '👸', color: '#c4c4d4', before: 'Colours? Not on my watch! Hmph!', again: 'I’m not finished yet! Hmph!', after: 'My umbrella! Oh, bother!' },

  // Episode 3: the Wild Isle's biggest creatures, grumpy in the fog, and Old Murk.
  ironclaw: { name: 'Old Ironclaw', icon: '🦀', color: '#ff7a5a', before: 'Snip! Snap! Off my beach!', after: 'Snip… sorry. I was grumpy.' },
  bramblepaw: { name: 'Old Bramblepaw', icon: '🐻', color: '#c89060', before: 'Grrr! Who woke me up?', after: 'Grrr… I mean, thank you.' },
  gnasher: { name: 'Gnasher', icon: '🦫', color: '#d8a070', before: 'Chomp! Chomp! My dam, my stone!', after: 'Chomp… you can have it.' },
  curlhorn: { name: 'Old Curlhorn', icon: '🐏', color: '#f0e6d0', before: 'Butt out of my crag!', after: 'Ah… the fog is lifting.' },
  murk: { name: 'Old Murk', icon: '🐺', color: '#b8c4cc', before: 'Let the fog roll in… you will never find me.', again: 'The fog is coming back… thicker than ever!', after: 'No… my lovely fog…' },

  // Episode 4: Jinx the Magpie, at his last challenge.
  jinx: { name: 'Jinx the Magpie', icon: '🐦', color: '#9fd8ff', before: 'Fires? You’ll never dazzle me! Ha ha!', after: 'All right, all right, you caught me!' },

  // Episode 5: the Big Bads of Toon Isle, by their beasts, and Baron Bluster.
  hydra: { name: 'Old Snapjaw', icon: '🐉', color: '#7ed67e', cast: 'snapjaw', before: 'Snap! Snap! Snap! Three heads are better than one!', after: 'Snap… we give up.' },
  oak: { name: 'Thumpwood', icon: '🌳', color: '#a8d080', cast: 'thumpwood', before: 'Who goes there? Thump!', after: 'Timber…' },
  rex: { name: 'Rumbletooth', icon: '🦖', color: '#ff9a5a', cast: 'rumbletooth', before: 'Roar! I am the biggest!', after: 'Roar… you are bigger.' },
  cyclops: { name: 'Big Blink', icon: '👁️', color: '#9fd8ff', cast: 'blink', before: 'I see you! Blink, blink!', after: 'I didn’t see that coming!' },
  wizard: { name: 'Gusto', icon: '🧙', color: '#b8a8ff', cast: 'gusto', before: 'Whoosh! Away you blow!', after: 'My hat! My spells!' },
  bluster: { name: 'Baron Bluster', icon: '🎩', color: '#c0b4f0', before: 'Made it up here, did you? Ho ho! Catch me!', after: 'No! Not my top hat!' },

  // Episode 6: the frights at the end of each dream, and the Night Mare.
  rambunctious: { name: 'Rambunctious', icon: '🐏', color: '#ffb0c8', before: 'Out of my way! Charge!', after: 'I’m all sleepy now…' },
  munch: { name: 'Old Munch', icon: '🐛', color: '#9be36a', before: 'Munch, munch! Yummy dreams!', after: 'Burp! Too much dreaming.' },
  maestro: { name: 'Maestro Crescendo', icon: '🎼', color: '#ffd77a', before: 'Louder! Louder! Fortissimo!', after: 'Bravo… bravo. You win.' },
  tock: { name: 'Old Tock', icon: '🕰️', color: '#e8c890', before: 'Bong! Bong! Time to fight!', after: 'Tick… tock… sleepy time.' },
  mare: { name: 'The Night Mare', icon: '🐴', color: '#d0a8ff', before: 'Stay away! Please, stay away!', after: 'I’m not scared any more. Thank you.' },
};

// The moments a boss says something.
export const WHENS = ['before', 'again', 'after'];

// Where the sound of a line is, from the page.
export const voiceUrl = (who, when) => `audio/voices/${who}-${when}.mp3`;
