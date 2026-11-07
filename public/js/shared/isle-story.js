// The story of Adventure Isle, the shared isle the dedicated server keeps
// (server/adventure.js): "The Star of Adventure Isle". King Grumble stole
// the Star from the top of the isle's lighthouse, broke it into twelve Star
// Shards and gave eleven of them to his captains to keep, all over the isle,
// each with a gang of his monsters; the last he kept himself. Every stage is
// a chapter of the story, with a map of its own (isle-maps.js): a shore, a
// wood, a mountain pass, a candy canyon, the dunes, a marsh, the caverns under
// it, a haunted valley, a volcano, a clockwork city, the spires over the
// clouds and, last of all, King Grumble's own castle. Each chapter's camps are
// freed one after another along the way, each one opening the way on to the
// next (a gate the monsters shut), and at the end of the way the chapter's
// boss waits in its lair (bosses.js), each one with moves of its own. Popped,
// it drops its Star Shard — until the last chapter, where King Grumble
// himself, who knows all his captains' tricks, is popped once and for all and
// the Star shines again.
//
// That is the end of the story: the last stage, won, plays the ending (ui.js)
// and starts a new journey from stage 1 (server/adventure.js). The first
// arrival on the isle plays the opening. A chapter told on a later journey is
// its own map turned over (isle-maps.js mirror).

// How many chapters the story has, the stages there are to conquer and the
// Star Shards to win back.
export const SHARDS = 12;
export const STAGES = SHARDS;

export const STORY_TITLE = 'The Star of Adventure Isle';

// Each chapter: its key (which map, isle-maps.js), icon and name, the kind
// of island it is (for the sky, the sea and the ground), its camps' names
// in the order they are freed along the way, its lair and the boss there
// (bosses.js BOSSES, with the minions it calls to help it), what is told
// on arriving, as each camp is freed (and the gate it opens) and when the
// boss is popped. guards: the chapter's own monsters, coming out first among
// each camp's guards after the mosquito (adventure.js guardKind); champions: the
// beasts (beasts.js) that hold its camps from the second on, one each, as extra
// guards that do not come back (adventure.js championOf; on the very first stage,
// only the first of them). day: how its days go, if not as anywhere (env.js
// DAY_MODES); weather: the only weathers it ever has, if not as anywhere.
// hazard: what comes down on the way between its camps (adventure.js stepHazards).
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
    champions: ['rattle', 'stinger'],
    hazard: 'coconut',
    intro:
      'A storm has washed your boat up on Adventure Isle! Its lighthouse has gone dark: King Grumble stole the Star from the top, broke it into twelve Star Shards and gave them to his captains to keep. The first is with Captain Clawbeard, a giant pirate crab, in his Driftwood Fort out on Crab Point. Free Seaside Village and the rest of the shore, then go and get it back — and step aside when he charges!',
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
    champions: ['wolf', 'oak'],
    hazard: 'pod',
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
    champions: ['hawk', 'cyclops'],
    hazard: 'snowball',
    intro:
      'Two Star Shards! They point up to Frostpeak, the tallest mountain on the isle, where Frostfang, the biggest yeti there ever was, keeps the third shard in his Ice Palace at the top. The only way up is the icy pass, where little yetis stomp about and snowballs come rolling down — jump when a yeti stomps!',
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
    champions: ['mimic', 'wizard'],
    hazard: 'gumdrop',
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
    key: 'dunes',
    icon: '🏜️',
    name: 'Sunscorch Dunes',
    theme: 'dunes',
    camps: ['Palm Oasis', 'Scorpion Pit', 'Broken Obelisk', 'Sandstone Steps'],
    lair: 'Sunken Pyramid',
    boss: 'scarabold',
    guards: ['stinger', 'spiky'],
    champions: ['rattle', 'mimic', 'cyclops'],
    weather: ['clear', 'clear', 'cloudy'],
    hazard: 'sandball',
    intro:
      'Past the last of the candy, the sugar turns to sand: Sunscorch Dunes, the hottest corner of the isle. Sir Scarabold, a great golden beetle in polished armour, has rolled the fifth shard into his Sunken Pyramid and shut the stone doors behind it. Cross the dunes from oasis to obelisk — and when his balls of sand come down, get out of the way!',
    freed: [
      'The Palm Oasis is free! The camels drink again, and the sand across the old road slides away.',
      'The Scorpion Pit is free! The stone door in the mesa wall grinds open.',
      'The Broken Obelisk is free! Its sun-stone wakes, and the way on up the dunes opens.',
      'The Sandstone Steps are free! At the top, the doors of the Sunken Pyramid stand open.',
    ],
    won: 'Pop! Sir Scarabold rolled away down the tallest dune, over and over, polishing his armour all the way — and left the fifth Star Shard shining in the sand!',
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
    champions: ['stinger', 'hydra'],
    hazard: 'mud',
    intro:
      'The Star Shards lead into Misty Marsh, where boardwalks wind between the pools and the mist hangs low. Bogmaw the Bog Toad sits on the sixth shard in his Bog Fort — and the Queen Mosquito herself keeps a nest here! Keep to the boardwalks, and pop her together.',
    freed: [
      'Reedy Pool is free! The frogs help lay new planks on the broken boardwalk.',
      'The Stilt Village is free! The villagers swing their log gate open.',
      'The Queen’s Nest is free! The mist lifts, and there is the Bog Fort.',
    ],
    won: 'Pop! Bogmaw hopped into the deepest pool with a great big SPLOSH — and up bobbed the sixth Star Shard!',
  },
  {
    key: 'caverns',
    icon: '💎',
    name: 'Crystal Caverns',
    theme: 'crystal',
    day: 'night',
    weather: ['clear'],
    camps: ['Miners’ Camp', 'Glowing Gallery', 'Spider Bridge', 'Deep Diggings'],
    lair: 'Crystal Grotto',
    boss: 'glimmershell',
    guards: ['mole', 'spider'],
    champions: ['rattle', 'cyclops', 'hydra'],
    hazard: 'crystal',
    intro:
      'Under Misty Marsh the ground falls away into the Crystal Caverns, where crystals as big as houses light up the dark. Old Glimmershell, a tortoise older than the isle, sleeps on the seventh shard in his Crystal Grotto, and whoever wakes him is in for it. Follow the miners’ old road down — and mind your head: crystals fall from the roof!',
    freed: [
      'The Miners’ Camp is free! The miners lift their lamps and clear the rockfall from the road.',
      'The Glowing Gallery is free! The crystal doors at its far end swing wide.',
      'Spider Bridge is free! The webs across the chasm fall away.',
      'The Deep Diggings are free! The last wall of rock crumbles, and the Crystal Grotto shines through.',
    ],
    won: 'Pop! Old Glimmershell pulled in his head, spun round and round like a top and shot off down the darkest tunnel — and there, where he had sat for a thousand years, lay the seventh Star Shard!',
  },
  {
    key: 'hollow',
    icon: '👻',
    name: 'Haunted Hollow',
    theme: 'hollow',
    day: 'night',
    weather: ['clear', 'cloudy'],
    camps: ['Crooked Gate', 'Old Graveyard', 'Pumpkin Patch', 'Witch’s Well'],
    lair: 'Creaky Manor',
    boss: 'baronboo',
    guards: ['ghost', 'rattle'],
    champions: ['wolf', 'wizard', 'rattle'],
    hazard: 'pumpkin',
    intro:
      'The caverns come out in a valley where the sun never shines: Haunted Hollow. Baron Boo, the grandest ghost on the isle, floats about Creaky Manor in his top hat, with the eighth shard for a monocle. Hold on to your hat, keep together — and look behind you: he loves to pop up where you least expect him!',
    freed: [
      'The Crooked Gate is free! Its rusty bars creak open all by themselves.',
      'The Old Graveyard is free! The skeletons lie back down for a nap, and the iron fence swings wide.',
      'The Pumpkin Patch is free! The grinning pumpkins roll off the road.',
      'The Witch’s Well is free! The mist pours back down the well, and there is the door of Creaky Manor.',
    ],
    won: 'Boo! Pop! Baron Boo gave a great wail and went up the chimney of Creaky Manor, his top hat after him — and down the chimney rolled the eighth Star Shard!',
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
    champions: ['rattle', 'rex'],
    hazard: 'lava',
    intro:
      'The ninth Star Shard is up on Ember Mountain, the volcano, in the Fire Fort of Moltok the Lava Golem. Rivers of lava run down its sides, Lava Ghosts drift over them, Stone Golems stand guard and the mountain itself spits rocks at you. Keep to the path and the bridges — lava is hot!',
    freed: [
      'The Ash Fields are free! The boulders on the path roll away.',
      'Lava Falls is free! The lava across the path cools into a stone bridge.',
      'The Golem Gate is free! Its great stone doors grind open.',
    ],
    won: 'Pop! Moltok cooled down into a big, friendly rock — and out rolled the ninth Star Shard!',
  },
  {
    key: 'works',
    icon: '⚙️',
    name: 'Cogwheel City',
    theme: 'works',
    weather: ['clear', 'cloudy'],
    camps: ['Scrap Yard', 'Conveyor Row', 'Steam Works', 'Clock Tower'],
    lair: 'Mainspring Hall',
    boss: 'sprocket',
    guards: ['knight', 'mimic'],
    champions: ['mimic', 'cyclops', 'rex'],
    hazard: 'gear',
    intro:
      'Behind Ember Mountain, the lava drives the wheels of Cogwheel City, a town of brass and steam where King Grumble’s knights are made. Big Sprocket, a wind-up giant as tall as a house, keeps the tenth shard in Mainspring Hall, and he never, ever runs down. Run up the moving belts, keep clear of the falling gears — and turn his key if you can!',
    freed: [
      'The Scrap Yard is free! The great magnet drops its heap of junk off the road.',
      'Conveyor Row is free! The belts stop, and the steel shutter rolls up.',
      'The Steam Works is free! With a long hiss, the boiler-room doors unlock.',
      'The Clock Tower is free! It strikes twelve, and the doors of Mainspring Hall swing open.',
    ],
    won: 'Ping! Pop! Big Sprocket’s spring went TWANG, and off he hopped down the street in bits, his key spinning behind him — and out of his chest fell the tenth Star Shard!',
  },
  {
    key: 'spires',
    icon: '🌩️',
    name: 'Stormcloud Spires',
    theme: 'spires',
    weather: ['clear', 'cloudy'],
    camps: ['Rainbow Landing', 'Windy Arch', 'Hawk’s Perch', 'Thunder Steps'],
    lair: 'Thunderhead Temple',
    boss: 'nimbus',
    guards: ['hawk', 'mosquito'],
    champions: ['wizard', 'hawk', 'rex'],
    hazard: 'bolt',
    intro:
      'From the top of the tallest chimney in Cogwheel City you can see them: the Stormcloud Spires, rocks so tall they poke through the clouds. Old Nimbus, a thundercloud with a terrible temper, keeps the eleventh shard in the Thunderhead Temple at the very top. Cross the rainbow bridges — do not look down — and run out of the red rings: that is where the lightning strikes!',
    freed: [
      'Rainbow Landing is free! The rainbow across to the next spire shines out solid.',
      'The Windy Arch is free! The wind drops, and the bridge beyond it stops swaying.',
      'Hawk’s Perch is free! The hawks fly home, and the way on opens.',
      'The Thunder Steps are free! The clouds part round the Thunderhead Temple.',
    ],
    won: 'Pop! Old Nimbus rained himself away to a tiny white puff, and floated off looking sorry — and the eleventh Star Shard fell out of the sky!',
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
    champions: ['wizard', 'cyclops'],
    hazard: 'bomb',
    intro:
      'Eleven Star Shards shine! The last one is with King Grumble himself, in his own castle on Gloom Rock — and he knows every one of his captains’ tricks. Break through the castle gates, climb the great stairs and pop him once and for all!',
    freed: [
      'The Outer Camp is free! The portcullis of King Grumble’s castle creaks up.',
      'The Castle Gate is free! The inner gate swings open.',
      'The Knights’ Yard is free! The great stairs are open — King Grumble is at the top!',
    ],
    won: 'King Grumble is popped once and for all! All twelve Star Shards fly home to the lighthouse, and the Star of Adventure Isle shines again. The whole isle cheers for you!',
  },
];

// The chapter of a stage of the isle, and how many Star Shards are back once
// it is won. final: it is the last, the end of the story. A stage past the last
// (never on the isle) is the last.
export function chapterOf(stage) {
  const s = Number.isInteger(stage) && stage >= 1 ? stage : 1;
  const i = Math.min(s, CHAPTERS.length) - 1;
  return { ...CHAPTERS[i], n: i + 1, shards: i + 1, final: i === CHAPTERS.length - 1 };
}

// A camp's name on a stage (its id is its place along the way, the lair
// last), or null past the names the chapter has.
export function campName(stage, id, kind = 'camp') {
  const ch = chapterOf(stage);
  if (kind === 'castle') return ch.lair;
  return ch.camps[id - 1] ?? null;
}

// What is told on arriving: the chapter's own story, and on a journey after
// the first, that King Grumble is back.
export function introOf(stage, journey = 1) {
  const ch = chapterOf(stage);
  if (!(journey > 1)) return ch.intro;
  return `Journey ${journey}! King Grumble puffed himself up again, grumpier than ever, broke the Star all over again and gave the shards back to his captains — and the isle has turned itself about, so the way goes round the other side. ${ch.intro}`;
}
