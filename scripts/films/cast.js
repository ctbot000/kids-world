// Who speaks in Adventure Isle's films (films.js), and how: a Kokoro voice
// (voices.mjs says every line with it), how fast they talk (speed, 1 as the
// voice is), how much higher or lower than the voice they are (pitch: a ratio,
// 1 as it is, so 1.25 is a little one and 0.8 a big one), and what is done to
// the sound after (fx: 'robot', 'ghost', 'echo'). name, icon and color: how
// what they say is shown on screen (the storyteller's words have none).
//
// Plain data, read by the films in the browser and by voices.mjs in Node.

export const CAST = {
  // The storyteller, and you and your friends (the three kids in every film:
  // the boy in the cap, the girl in pigtails and the bunny).
  teller: { voice: 'af_heart', speed: 0.92 },
  boy: { icon: '🧢', color: '#5ab4ff', voice: 'am_puck', pitch: 1.2, speed: 1.02 },
  girl: { icon: '🎀', color: '#ff8fc4', voice: 'af_bella', pitch: 1.18, speed: 1.02 },
  bunny: { icon: '🐰', color: '#f2f2f2', voice: 'af_nova', pitch: 1.32, speed: 1.0 },

  // Episode 1: King Grumble and his eleven captains.
  grumble: { name: 'King Grumble', icon: '👑', color: '#b18cff', voice: 'bm_george', pitch: 0.84, speed: 0.92 },
  clawbeard: { name: 'Captain Clawbeard', icon: '🦀', color: '#ff7a5a', voice: 'am_michael', pitch: 0.86, speed: 1 },
  puffcap: { name: 'Old Puffcap', icon: '🍄', color: '#c9a0ff', voice: 'bm_daniel', pitch: 1.1, speed: 0.92 },
  frostfang: { name: 'Frostfang', icon: '❄️', color: '#a8e4ff', voice: 'am_fenrir', pitch: 0.84, speed: 0.95 },
  gumbo: { name: 'Gumbo the Gummy Giant', icon: '🧸', color: '#ff9ad0', voice: 'am_eric', pitch: 0.78, speed: 0.86 },
  scarabold: { name: 'Sir Scarabold', icon: '🪲', color: '#ffd24a', voice: 'bm_george', pitch: 1.08, speed: 1.02 },
  bogmaw: { name: 'Bogmaw the Bog Toad', icon: '🐸', color: '#8fd16a', voice: 'am_onyx', pitch: 0.86, speed: 0.92 },
  glimmershell: { name: 'Old Glimmershell', icon: '🐢', color: '#7fe0d0', voice: 'bm_daniel', pitch: 0.86, speed: 0.82 },
  baronboo: { name: 'Baron Boo', icon: '🎩', color: '#e0e0ff', voice: 'bm_lewis', pitch: 1.04, speed: 0.95, fx: 'ghost' },
  moltok: { name: 'Moltok the Lava Golem', icon: '🌋', color: '#ff8a3d', voice: 'am_onyx', pitch: 0.8, speed: 0.88, fx: 'echo' },
  sprocket: { name: 'Big Sprocket', icon: '🤖', color: '#ffc861', voice: 'am_echo', pitch: 0.96, speed: 0.95, fx: 'robot' },
  nimbus: { name: 'Old Nimbus', icon: '🌩️', color: '#c8d6ff', voice: 'bm_fable', pitch: 0.88, speed: 0.95 },

  // Episode 2: Queen Grizzle and her six helpers.
  grizzle: { name: 'Queen Grizzle', icon: '👸', color: '#c4c4d4', voice: 'bf_isabella', pitch: 0.94, speed: 0.92 },
  dotty: { name: 'Lady Dotty', icon: '🐞', color: '#ff6a6a', voice: 'bf_alice', pitch: 1.14, speed: 1.02 },
  bushytail: { name: 'Duke Bushytail', icon: '🐿️', color: '#e8a060', voice: 'am_liam', pitch: 1.2, speed: 1.1 },
  bumble: { name: 'Baroness Bumble', icon: '🐝', color: '#ffd84d', voice: 'bf_lily', pitch: 1.1, speed: 1.05 },
  blendalot: { name: 'Sir Blendalot', icon: '🦎', color: '#7ed67e', voice: 'bm_lewis', pitch: 1.02, speed: 0.98 },
  inkwell: { name: 'Admiral Inkwell', icon: '🐙', color: '#9c8cff', voice: 'bm_george', pitch: 0.92, speed: 0.95 },
  mochi: { name: 'Mochi the Moon Rabbit', icon: '🐇', color: '#f4e8ff', voice: 'af_kore', pitch: 1.28, speed: 1.05 },

  // Episode 3: Old Murk and the four biggest creatures of the Wild Isle.
  murk: { name: 'Old Murk', icon: '🐺', color: '#b8c4cc', voice: 'am_onyx', pitch: 0.8, speed: 0.84, fx: 'echo' },
  ironclaw: { name: 'Old Ironclaw', icon: '🦀', color: '#ff7a5a', voice: 'am_michael', pitch: 0.8, speed: 0.95 },
  bramblepaw: { name: 'Old Bramblepaw', icon: '🐻', color: '#c89060', voice: 'am_fenrir', pitch: 0.78, speed: 0.88 },
  gnasher: { name: 'Gnasher', icon: '🦫', color: '#d8a070', voice: 'am_puck', pitch: 1.02, speed: 1.08 },
  curlhorn: { name: 'Old Curlhorn', icon: '🐏', color: '#f0e6d0', voice: 'bm_daniel', pitch: 0.92, speed: 0.95 },

  // Episode 4: Jinx the Magpie.
  jinx: { name: 'Jinx the Magpie', icon: '🐦', color: '#9fd8ff', voice: 'bm_fable', pitch: 1.16, speed: 1.08 },

  // Episode 5: Baron Bluster (big and blustering, then a polite little cloud)
  // and the Big Bads of Toon Isle.
  bluster: { name: 'Baron Bluster', icon: '🎩', color: '#c0b4f0', voice: 'bm_lewis', pitch: 0.86, speed: 0.94 },
  puff: { name: 'Baron Bluster', icon: '☁️', color: '#ffffff', voice: 'bm_lewis', pitch: 1.34, speed: 1.02 },
  snapjaw: { name: 'Old Snapjaw', icon: '🐉', color: '#7ed67e', voice: 'am_fenrir', pitch: 0.82, speed: 1 },
  thumpwood: { name: 'Thumpwood', icon: '🌳', color: '#a8d080', voice: 'am_onyx', pitch: 0.8, speed: 0.86 },
  rumbletooth: { name: 'Rumbletooth', icon: '🦖', color: '#ff9a5a', voice: 'am_michael', pitch: 0.84, speed: 0.95 },
  blink: { name: 'Big Blink', icon: '👁️', color: '#9fd8ff', voice: 'am_eric', pitch: 0.86, speed: 0.95 },
  gusto: { name: 'Gusto', icon: '🧙', color: '#b8a8ff', voice: 'bm_daniel', pitch: 0.96, speed: 1 },

  // Episode 6: the Night Mare and the frights of the Land of Nod.
  mare: { name: 'The Night Mare', icon: '🐴', color: '#d0a8ff', voice: 'af_nicole', pitch: 1.08, speed: 0.9 },
  rambunctious: { name: 'Rambunctious', icon: '🐏', color: '#ffb0c8', voice: 'am_fenrir', pitch: 0.9, speed: 1.05 },
  munch: { name: 'Old Munch', icon: '🐛', color: '#9be36a', voice: 'bm_daniel', pitch: 0.9, speed: 0.9 },
  maestro: { name: 'Maestro Crescendo', icon: '🎼', color: '#ffd77a', voice: 'bm_lewis', pitch: 1.06, speed: 1.02 },
  tock: { name: 'Old Tock', icon: '🕰️', color: '#e8c890', voice: 'bm_george', pitch: 0.8, speed: 0.86, fx: 'echo' },
};

// What a line is called, wherever it is asked for: who says it, its words,
// and the longest it may take (it is said faster to fit, when it must).
export const lineId = (who, text, max) => `${who}|${max ?? ''}|${text}`;
