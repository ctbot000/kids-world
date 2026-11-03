// The story of Adventure Isle, the shared isle the dedicated server keeps
// (server/adventure.js): "The Star of Adventure Isle". King Grumble stole
// the Star from the top of the isle's lighthouse, broke it into seven Star
// Shards and gave six of them to his captains to keep, all over the isle,
// each with a gang of his monsters; the last he kept himself. Every stage is
// a chapter of the story, with a map of its own (isle-maps.js): a shore, a
// wood, a mountain pass, a candy canyon, a marsh, a volcano and, last of
// all, King Grumble's own castle. Each chapter's camps are freed one after
// another along the way, each one opening the way on to the next (a gate
// the monsters shut), and at the end of the way the chapter's boss waits in
// its lair (bosses.js), each one with moves of its own. Popped, it drops
// its Star Shard — until the last chapter, where King Grumble himself, who
// knows all his captains' tricks, is popped once and for all and the Star
// shines again.
//
// The chapters go round again after the last (stage 8 is the first one
// once more, as round 2), the monsters tougher each time round, as every
// stage is a little harder than the last (adventure.js).

// How many chapters the story has, and the Star Shards to win back.
export const SHARDS = 7;

export const STORY_TITLE = 'The Star of Adventure Isle';

// Each chapter: its key (which map, isle-maps.js), icon and name, the kind
// of island it is (for the sky, the sea and the weather), its camps' names
// in the order they are freed along the way, its lair and the boss there
// (bosses.js BOSSES, with the minions it calls to help it), what is told
// on arriving, as each camp is freed (and the gate it opens) and when the
// boss is popped. guards: the chapter's own monsters, coming out first among
// each camp's guards after the mosquito (adventure.js guardKind).
export const CHAPTERS = [
  {
    key: 'shore',
    icon: '🏝️',
    name: 'Shipwreck Shore',
    theme: 'sunny',
    camps: ['Seaside Village', 'Old Pier', 'Lighthouse Hill'],
    lair: 'Driftwood Fort',
    boss: 'clawbeard',
    guards: ['snapper'],
    intro:
      'A storm has washed your boat up on Adventure Isle! Its lighthouse has gone dark: King Grumble stole the Star from the top, broke it into seven Star Shards and gave them to his captains to keep. The first is with Captain Clawbeard, a giant pirate crab, in his Driftwood Fort out on Crab Point. Free Seaside Village and the rest of the shore, then go and get it back — and step aside when he charges!',
    freed: [
      'Seaside Village is free! The villagers cheer from their windows and push the crates off the coast road.',
      'The Old Pier is free! The fishermen unlock the gate on the way up to the lighthouse.',
      'Lighthouse Hill is free! Down below, the bridge to Crab Point is open — Captain Clawbeard’s fort is over there!',
    ],
    won: 'Pop! Captain Clawbeard scuttled off into the sea with his hat over his eyes — and left the first Star Shard behind!',
  },
  {
    key: 'woods',
    icon: '🌲',
    name: 'Whispering Woods',
    theme: 'sunny',
    camps: ['Mushroom Ring', 'Old Mill', 'Spider Hollow'],
    lair: 'Hollow Tree Hideout',
    boss: 'puffcap',
    guards: ['shroom', 'spider'],
    intro:
      'The first Star Shard glows and points into the Whispering Woods, where the trees grow so tall it is dim at noon. Old Puffcap, the grumpiest mushroom of them all, keeps the second shard in the hollow of the oldest tree. Follow the old path — and keep away from the mushrooms that puff!',
    freed: [
      'The Mushroom Ring is free! The brambles across the old path shrivel away.',
      'The Old Mill is free! Its wheel turns again, and the bridge over the river opens.',
      'Spider Hollow is free! The webs across the path fall away: on to the Hollow Tree!',
    ],
    won: 'Pop! Old Puffcap went off like a puffball in a great cloud of spores — and out of the cloud fell the second Star Shard!',
  },
  {
    key: 'frost',
    icon: '🏔️',
    name: 'Frostpeak Pass',
    theme: 'snowy',
    camps: ['Frozen Lake', 'Halfway Ledge', 'Old Mine'],
    lair: 'Ice Palace',
    boss: 'frostfang',
    guards: ['yeti'],
    intro:
      'Two Star Shards! They point up to Frostpeak, the tallest mountain on the isle, where Frostfang, the biggest yeti there ever was, keeps the third shard in his Ice Palace at the top. The only way up is the icy pass, where little yetis stomp about — jump when a yeti stomps!',
    freed: [
      'Frozen Lake is free! The wall of ice at the foot of the pass cracks and melts.',
      'Halfway Ledge is free! The snowdrift on the path above slides away.',
      'The Old Mine is free! The boards over its far end fall away — the summit is just ahead.',
    ],
    won: 'Pop! Frostfang slid all the way down the mountain on his tummy, into a big snowdrift — and dropped the third Star Shard!',
  },
  {
    key: 'candy',
    icon: '🍭',
    name: 'Candy Canyon',
    theme: 'candy',
    camps: ['Lollipop Lane', 'Cookie Mesa', 'Gumdrop Factory'],
    lair: 'Candy Castle',
    boss: 'gumbo',
    guards: ['gummy'],
    intro:
      'Down the far side of Frostpeak lies Candy Canyon, the sweetest place on the isle — but Gumbo the Gummy Giant has the fourth shard in his Candy Castle, and his gang has taken over the Gumdrop Factory to make grumpy gummy bears! Pop a gummy bear and it splits into two little ones, so pop those too.',
    freed: [
      'Lollipop Lane is free! The wall of gummy across the canyon wobbles and melts away.',
      'Cookie Mesa is free! The candy cane bars on the bridge snap like sticks of rock.',
      'The Gumdrop Factory is free! No more grumpy gummies — and its back gate is open.',
    ],
    won: 'Pop! Gumbo bounced off his castle walls like a gumball, boing, boing, all the way out of the canyon — and dropped the fourth Star Shard!',
  },
  {
    key: 'marsh',
    icon: '🦟',
    name: 'Misty Marsh',
    theme: 'sunny',
    camps: ['Reedy Pool', 'Stilt Village', 'Queen’s Nest'],
    lair: 'Bog Fort',
    boss: 'bogmaw',
    guards: ['mosquito'],
    intro:
      'The Star Shards lead into Misty Marsh, where boardwalks wind between the pools and the mist hangs low. Bogmaw the Bog Toad sits on the fifth shard in his Bog Fort — and the Queen Mosquito herself keeps a nest here! Keep to the boardwalks, and pop her together.',
    freed: [
      'Reedy Pool is free! The frogs help lay new planks on the broken boardwalk.',
      'The Stilt Village is free! The villagers swing their log gate open.',
      'The Queen’s Nest is free! The mist lifts, and there is the Bog Fort.',
    ],
    won: 'Pop! Bogmaw hopped into the deepest pool with a great big SPLOSH — and up bobbed the fifth Star Shard!',
  },
  {
    key: 'ember',
    icon: '🌋',
    name: 'Ember Mountain',
    theme: 'volcano',
    camps: ['Ash Fields', 'Lava Falls', 'Golem Gate'],
    lair: 'Fire Fort',
    boss: 'moltok',
    guards: ['ghost', 'golem'],
    intro:
      'The sixth Star Shard is up on Ember Mountain, the volcano, in the Fire Fort of Moltok the Lava Golem. Rivers of lava run down its sides, Lava Ghosts drift over them and Stone Golems stand guard. Keep to the path and the bridges — lava is hot!',
    freed: [
      'The Ash Fields are free! The boulders on the path roll away.',
      'Lava Falls is free! The lava across the path cools into a stone bridge.',
      'The Golem Gate is free! Its great stone doors grind open.',
    ],
    won: 'Pop! Moltok cooled down into a big, friendly rock — and out rolled the sixth Star Shard!',
  },
  {
    key: 'castle',
    icon: '🏰',
    name: 'Gloom Rock',
    theme: 'sunny',
    camps: ['Outer Camp', 'Castle Gate', 'Knights’ Yard'],
    lair: 'Throne Yard',
    boss: 'king',
    guards: ['knight'],
    intro:
      'Six Star Shards shine! The last one is with King Grumble himself, in his own castle on Gloom Rock — and he knows every one of his captains’ tricks. Break through the castle gates, climb the great stairs and pop him once and for all!',
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
  return `Round ${ch.round}! King Grumble puffed himself up again, grumpier than ever, broke the Star all over again and gave the shards back to his captains — and his monsters are tougher now. ${ch.intro}`;
}
