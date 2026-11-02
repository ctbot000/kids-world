// The story of Adventure Isle, the shared isle the dedicated server keeps
// (server/adventure.js): "The Star of Adventure Isle". King Grumble stole
// the Star from the top of the isle's lighthouse, broke it into seven Star
// Shards and hid them all over the isle, each with a gang of his monsters
// to keep it. Every stage is a chapter of the story, with a map of its own
// (isle-maps.js): a shore, a wood, a mountain pass, a candy canyon, a marsh,
// a volcano and, last of all, King Grumble's own castle. Each chapter's
// camps are freed one after another along the way, each one opening the
// way on to the next (a gate the monsters shut), and at the end of the way
// King Grumble waits in his lair. Popped, he drops a Star Shard and bounces
// away to the next chapter's corner of the isle — until the last chapter,
// where he is popped once and for all and the Star shines again.
//
// The chapters go round again after the last (stage 8 is the first one
// once more, as round 2), the monsters tougher each time round, as every
// stage is a little harder than the last (adventure.js).

// How many chapters the story has, and the Star Shards to win back.
export const SHARDS = 7;

export const STORY_TITLE = 'The Star of Adventure Isle';

// Each chapter: its key (which map, isle-maps.js), icon and name, the kind
// of island it is (for the sky, the sea and the weather), its camps' names
// in the order they are freed along the way, its lair, what is told on
// arriving, as each camp is freed (and the gate it opens), when King
// Grumble's bubble pops and when he is popped. guards: the chapter's own
// monsters, coming out first among each camp's guards after the mosquito
// (adventure.js guardKind); minion: the kind King Grumble calls to help him.
export const CHAPTERS = [
  {
    key: 'shore',
    icon: '🏝️',
    name: 'Shipwreck Shore',
    theme: 'sunny',
    camps: ['Seaside Village', 'Old Pier', 'Lighthouse Hill'],
    lair: 'Driftwood Fort',
    guards: ['snapper'],
    minion: 'snapper',
    intro:
      'A storm has washed your boat up on Adventure Isle! Its lighthouse has gone dark: King Grumble stole the Star from the top and broke it into seven Star Shards, and his monsters have taken Seaside Village. Free the village, then catch King Grumble in his Driftwood Fort out on Crab Point!',
    freed: [
      'Seaside Village is free! The villagers cheer from their windows and push the crates off the coast road.',
      'The Old Pier is free! The fishermen unlock the gate on the way up to the lighthouse.',
      'Lighthouse Hill is free! Down below, the bridge to Crab Point is open — King Grumble’s fort is over there!',
    ],
    won: 'Pop! King Grumble bounced right out of his fort and away over the trees to the Whispering Woods — and dropped the first Star Shard!',
  },
  {
    key: 'woods',
    icon: '🌲',
    name: 'Whispering Woods',
    theme: 'sunny',
    camps: ['Mushroom Ring', 'Old Mill', 'Spider Hollow'],
    lair: 'Hollow Tree Hideout',
    guards: ['shroom', 'spider'],
    minion: 'spider',
    intro:
      'The first Star Shard glows and points into the Whispering Woods, where the trees grow so tall it is dim at noon. King Grumble is hiding in the hollow of the oldest tree. Follow the old path — and keep away from the mushrooms that puff!',
    freed: [
      'The Mushroom Ring is free! The brambles across the old path shrivel away.',
      'The Old Mill is free! Its wheel turns again, and the bridge over the river opens.',
      'Spider Hollow is free! The webs across the path fall away: on to the Hollow Tree!',
    ],
    won: 'Pop! King Grumble shot out of the hollow tree like a cork and sailed all the way to the snowy mountains — and dropped the second Star Shard!',
  },
  {
    key: 'frost',
    icon: '🏔️',
    name: 'Frostpeak Pass',
    theme: 'snowy',
    camps: ['Frozen Lake', 'Halfway Ledge', 'Old Mine'],
    lair: 'Ice Palace',
    guards: ['yeti'],
    minion: 'blob',
    intro:
      'Two Star Shards! They point up to Frostpeak, the tallest mountain on the isle. The only way over is the icy pass, where little yetis stomp about. Climb up to King Grumble’s Ice Palace at the top — and jump when a yeti stomps!',
    freed: [
      'Frozen Lake is free! The wall of ice at the foot of the pass cracks and melts.',
      'Halfway Ledge is free! The snowdrift on the path above slides away.',
      'The Old Mine is free! The boards over its far end fall away — the summit is just ahead.',
    ],
    won: 'Pop! King Grumble slid all the way down the mountain on his tummy and into Candy Canyon — and dropped the third Star Shard!',
  },
  {
    key: 'candy',
    icon: '🍭',
    name: 'Candy Canyon',
    theme: 'candy',
    camps: ['Lollipop Lane', 'Cookie Mesa', 'Gumdrop Factory'],
    lair: 'Candy Castle',
    guards: ['gummy'],
    minion: 'cub',
    intro:
      'Down the far side of Frostpeak lies Candy Canyon, the sweetest place on the isle — but King Grumble’s gang has taken over the Gumdrop Factory, and it is making grumpy gummy bears! Pop a gummy bear and it splits into two little ones, so pop those too.',
    freed: [
      'Lollipop Lane is free! The wall of gummy across the canyon wobbles and melts away.',
      'Cookie Mesa is free! The candy cane bars on the bridge snap like sticks of rock.',
      'The Gumdrop Factory is free! No more grumpy gummies — and its back gate is open.',
    ],
    won: 'Pop! King Grumble bounced off the Candy Castle’s walls like a gumball, all the way to the marsh — and dropped the fourth Star Shard!',
  },
  {
    key: 'marsh',
    icon: '🦟',
    name: 'Misty Marsh',
    theme: 'sunny',
    camps: ['Reedy Pool', 'Stilt Village', 'Queen’s Nest'],
    lair: 'Bog Fort',
    guards: ['mosquito'],
    minion: 'mosquito',
    intro:
      'The Star Shards lead into Misty Marsh, where boardwalks wind between the pools and the mist hangs low. The Queen Mosquito herself keeps a nest here! Keep to the boardwalks, and pop her together.',
    freed: [
      'Reedy Pool is free! The frogs help lay new planks on the broken boardwalk.',
      'The Stilt Village is free! The villagers swing their log gate open.',
      'The Queen’s Nest is free! The mist lifts, and there is the Bog Fort.',
    ],
    won: 'Pop! King Grumble splashed out of the Bog Fort and paddled away towards the smoking mountain — and dropped the fifth Star Shard!',
  },
  {
    key: 'ember',
    icon: '🌋',
    name: 'Ember Mountain',
    theme: 'volcano',
    camps: ['Ash Fields', 'Lava Falls', 'Golem Gate'],
    lair: 'Fire Fort',
    guards: ['ghost', 'golem'],
    minion: 'ghost',
    intro:
      'The sixth Star Shard is up on Ember Mountain, the volcano. Rivers of lava run down its sides, Lava Ghosts drift over them and Stone Golems stand guard. Keep to the path and the bridges — lava is hot!',
    freed: [
      'The Ash Fields are free! The boulders on the path roll away.',
      'Lava Falls is free! The lava across the path cools into a stone bridge.',
      'The Golem Gate is free! Its great stone doors grind open.',
    ],
    won: 'Pop! King Grumble shot up out of the volcano in a puff of smoke and floated away to his own castle on Gloom Rock — and dropped the sixth Star Shard!',
  },
  {
    key: 'castle',
    icon: '🏰',
    name: 'Gloom Rock',
    theme: 'sunny',
    camps: ['Outer Camp', 'Castle Gate', 'Knights’ Yard'],
    lair: 'Throne Yard',
    guards: ['knight'],
    minion: 'spiky',
    intro:
      'Six Star Shards shine! The last one is in King Grumble’s own castle on Gloom Rock. Break through the castle gates, climb the great stairs and pop him once and for all!',
    freed: [
      'The Outer Camp is free! The portcullis of King Grumble’s castle creaks up.',
      'The Castle Gate is free! The inner gate swings open.',
      'The Knights’ Yard is free! The great stairs are open — King Grumble is at the top!',
    ],
    won: 'King Grumble is popped once and for all! All seven Star Shards fly home to the lighthouse, and the Star of Adventure Isle shines again. The whole isle cheers for you!',
  },
];

// The chapter of a stage of the isle, with which time round the story it
// is (round 1 the first time, 2 from stage 8, and so on) and how many Star
// Shards are back once it is won.
export function chapterOf(stage) {
  const s = Number.isInteger(stage) && stage >= 1 ? stage : 1;
  const i = (s - 1) % CHAPTERS.length;
  return { ...CHAPTERS[i], n: i + 1, round: Math.floor((s - 1) / CHAPTERS.length) + 1, shards: i + 1 };
}

// A camp's name on a stage (its id is its place along the way, the lair
// last), or null past the names the chapter has.
export function campName(stage, id, kind = 'camp') {
  const ch = chapterOf(stage);
  if (kind === 'castle') return ch.lair;
  return ch.camps[id - 1] ?? null;
}

// What is told on arriving: the chapter's own story, and from round 2 on,
// that King Grumble is back.
export function introOf(stage) {
  const ch = chapterOf(stage);
  if (ch.round === 1) return ch.intro;
  return `Round ${ch.round}! King Grumble puffed himself up again, grumpier than ever, and broke the Star all over again — and his monsters are tougher now. ${ch.intro}`;
}
