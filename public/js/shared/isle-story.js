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
// That is the end of the first episode: its last stage, won, plays its
// ending (ui.js), and the story goes on with the next (server/adventure.js).
//
// Episode 2, "The Rainbow of Adventure Isle": with the Star shining again, a
// rainbow stood over the isle every morning — until Queen Grizzle, King
// Grumble's big sister, who cannot bear bright colours, caught it in her great
// grey umbrella, shook its seven colours into seven jars and gave six of them
// to her helpers to hide in the Rainbow Lands on the far side of the isle; the
// last, violet, she kept herself. Without them the isle is fading to grey.
// Seven chapters, one for each colour: the Tulip Fields, Maple Ridge, the
// Honeycomb Hills, Tangle Jungle, Bubble Lagoon, Moonbeam Moor and Violet
// Vale, where Castle Drab stands. Each won brings its colour back.
//
// The last episode's last stage, won, starts a new journey from stage 1. The
// first arrival on an episode plays its opening. A chapter told on a later
// journey is its own map turned over (isle-maps.js mirror).

// How many Star Shards there are to win back in the first episode, one for
// each of its chapters.
export const SHARDS = 12;

export const STORY_TITLE = 'The Star of Adventure Isle';

// The colours of the rainbow, in their order: the second episode's chapters
// win them back one by one.
export const RAINBOW = [
  { name: 'red', color: '#e8453c' },
  { name: 'orange', color: '#f59331' },
  { name: 'yellow', color: '#fcd535' },
  { name: 'green', color: '#35a852' },
  { name: 'blue', color: '#3a73d8' },
  { name: 'indigo', color: '#4b3fb5' },
  { name: 'violet', color: '#9b4fd6' },
];

// The episodes of the isle's story, in their order: each its own tale with
// its own villain, its chapters one after another among the isle's stages
// (CHAPTERS, by their episode), an opening and an ending film (public/video
// isle-<name>.mp4, made by scripts/films; endingMs: about how long the ending
// is). token: what each chapter wins back (colours: drawn as dots of these,
// not as stars); again: what is told before a chapter on a journey after the
// first.
export const EPISODES = [
  {
    n: 1,
    key: 'star',
    icon: '🌟',
    title: STORY_TITLE,
    villain: 'King Grumble',
    token: { one: 'Star Shard', many: 'Star Shards' },
    films: { intro: 'intro', ending: 'ending', endingMs: 72000 },
    again: (journey) =>
      `Journey ${journey}! King Grumble puffed himself up again, grumpier than ever, broke the Star all over again and gave the shards back to his captains — and the isle has turned itself about, so the way goes round the other side.`,
  },
  {
    n: 2,
    key: 'rainbow',
    icon: '🌈',
    title: 'The Rainbow of Adventure Isle',
    villain: 'Queen Grizzle',
    token: { one: 'colour', many: 'colours of the rainbow', colours: RAINBOW },
    films: { intro: 'intro2', ending: 'ending2', endingMs: 44000 },
    again: (journey) =>
      `Journey ${journey}! Queen Grizzle is back with a bigger umbrella, caught the rainbow all over again and gave its colours back to her helpers — and the Rainbow Lands have turned themselves about, so the way goes round the other side.`,
  },
];

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
// episode: which episode it is a chapter of, if not the first; level: how hard
// it is, as a stage of the first episode is (adventure.js: its guards, its
// boss's hearts and all the rest), if not as hard as its place in its episode.
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
  // ------------------------------------------------ Episode 2: the rainbow
  {
    key: 'tulip',
    episode: 2,
    level: 7,
    icon: '🌷',
    name: 'Tulip Fields',
    theme: 'tulip',
    camps: ['Scarecrow Corner', 'Strawberry Patch', 'Old Windmill'],
    lair: 'Rose Bower',
    boss: 'dotty',
    guards: ['spiky', 'shroom'],
    champions: ['stinger', 'wolf'],
    hazard: 'berry',
    intro:
      'The Star shines again — and every morning its light painted a rainbow right over Adventure Isle. Not any more! Queen Grizzle, King Grumble’s big sister, cannot bear bright colours. She caught the rainbow in her great grey umbrella, shook its seven colours into seven jars and gave six of them to her helpers to hide in the Rainbow Lands, on the far side of the isle. Without them, everything is fading to grey! Red is nearest: Lady Dotty, a ladybird as big as a cart, keeps it in her Rose Bower at the top of the Tulip Fields. Free the fields — and step aside when she comes rolling!',
    freed: [
      'Scarecrow Corner is free! The scarecrows wave their arms, and the hay bales roll off the lane.',
      'The Strawberry Patch is free! The farmers push their cart out of the gateway.',
      'The Old Windmill is free! Its sails turn again, and the bramble hedge before the Rose Bower opens.',
    ],
    won: 'Pop! Lady Dotty flew off over the hedge, counting her spots to see that none had fallen off — and over went the red jar. Red is back: the tulips glow again!',
  },
  {
    key: 'maple',
    episode: 2,
    level: 8,
    icon: '🍁',
    name: 'Maple Ridge',
    theme: 'maple',
    camps: ['Leafy Lane', 'Acorn Store', 'Log Bridge', 'Bonfire Clearing'],
    lair: 'Nut Hoard',
    boss: 'bushytail',
    guards: ['mole', 'spider'],
    champions: ['wolf', 'oak', 'mimic'],
    hazard: 'acorn',
    intro:
      'Red is back, and it points the way: up Maple Ridge, where the leaves are orange all the year round — or were. Duke Bushytail, a squirrel as tall as a shed, has stuffed the orange jar into his Nut Hoard at the top, along with every acorn on the ridge. Climb from lane to bridge to clearing — and mind your head: he never misses with an acorn!',
    freed: [
      'Leafy Lane is free! The great heap of leaves across the path blows away.',
      'The Acorn Store is free! The squirrels roll their barrels off the steps.',
      'The Log Bridge is free! The fallen trunk across the way is rolled aside.',
      'Bonfire Clearing is free! The gate of the Nut Hoard swings open.',
    ],
    won: 'Pop! Duke Bushytail shot up the tallest maple with his tail in a twist — and out of his cheeks fell the orange jar. Orange is back: the maples blaze again!',
  },
  {
    key: 'honey',
    episode: 2,
    level: 9,
    icon: '🍯',
    name: 'Honeycomb Hills',
    theme: 'honey',
    weather: ['clear', 'clear', 'cloudy'],
    camps: ['Sunflower Gate', 'Clover Bank', 'Beekeeper’s Yard', 'Honey Falls'],
    lair: 'Golden Hive',
    boss: 'bumble',
    guards: ['gummy', 'spiky'],
    champions: ['stinger', 'hawk', 'mimic'],
    hazard: 'honey',
    intro:
      'Two colours shine again! Yellow is in the Honeycomb Hills, where the sunflowers grow as tall as houses and the cliffs are made of honeycomb. Baroness Bumble, the biggest, bossiest bee there ever was, keeps the yellow jar in her Golden Hive, and all the honey for herself. Go up through the sunflowers — and keep out of the red rings when her honey comes down!',
    freed: [
      'Sunflower Gate is free! The sunflowers turn their heads and lift their leaves off the path.',
      'Clover Bank is free! The wall of wax across the steps melts in the sun.',
      'The Beekeeper’s Yard is free! The beekeeper smokes the bees off the gate.',
      'Honey Falls is free! The honey stops pouring over the door of the Golden Hive.',
    ],
    won: 'Pop! Baroness Bumble buzzed off in a huff, round and round and out of sight — and left the yellow jar in the honey. Yellow is back: the sunflowers shine again!',
  },
  {
    key: 'jungle',
    episode: 2,
    level: 10,
    icon: '🌴',
    name: 'Tangle Jungle',
    theme: 'jungle',
    weather: ['clear', 'cloudy', 'rain'],
    camps: ['Parrot Landing', 'Vine Village', 'Monkey Bridge', 'Mossy Steps'],
    lair: 'Lost Temple',
    boss: 'blendalot',
    guards: ['spider', 'snapper'],
    champions: ['stinger', 'hydra', 'rex'],
    hazard: 'banana',
    intro:
      'Yellow is home! Green lives deep in Tangle Jungle, where the trees shut out the sky and the vines hang down like ropes. Sir Blendalot, a chameleon who can turn any colour he likes, has the green jar in the Lost Temple — if you can find him: he vanishes, and pops up somewhere else! Follow the old stone road up through the jungle, and keep your eyes peeled — he could be anywhere!',
    freed: [
      'Parrot Landing is free! The parrots pull the creepers off the jungle road.',
      'Vine Village is free! The villagers haul their log gate up out of the way.',
      'Monkey Bridge is free! The monkeys untie the knot of vines across the road.',
      'The Mossy Steps are free! The stone door of the Lost Temple rolls aside.',
    ],
    won: 'Pop! Sir Blendalot went red, then white, then spotty all over, and ran off up a tree — and there on the temple steps stood the green jar. Green is back: the jungle is green again!',
  },
  {
    key: 'lagoon',
    episode: 2,
    level: 11,
    icon: '🫧',
    name: 'Bubble Lagoon',
    theme: 'lagoon',
    weather: ['clear', 'clear', 'cloudy'],
    camps: ['Shell Beach', 'Coral Garden', 'Pearl Divers’ Rock', 'Whale Rock'],
    lair: 'Sunken Galleon',
    boss: 'inkwell',
    guards: ['snapper', 'spiky'],
    champions: ['rattle', 'hydra', 'mimic'],
    hazard: 'ink',
    intro:
      'Four colours shine! Blue is out in Bubble Lagoon, where the sea is so clear you can count the fish — but Admiral Inkwell, an octopus with an arm for every job, is squirting it grey from the wreck of the Sunken Galleon. Cross the piers from rock to rock, keep out of the ink, and get the blue jar back!',
    freed: [
      'Shell Beach is free! The crabs carry the driftwood off the pier.',
      'The Coral Garden is free! The giant clam across the pier yawns open.',
      'The Pearl Divers’ Rock is free! The divers haul their old net out of the way.',
      'Whale Rock is free! The tide goes out, and the way to the Sunken Galleon is open.',
    ],
    won: 'Pop! Admiral Inkwell squirted himself backwards right out of the lagoon, all eight arms waving — and up floated the blue jar. Blue is back: the sea and the sky are blue again!',
  },
  {
    key: 'moor',
    episode: 2,
    level: 12,
    icon: '🌙',
    name: 'Moonbeam Moor',
    theme: 'moor',
    day: 'night',
    weather: ['clear'],
    camps: ['Lantern Gate', 'Firefly Pond', 'Standing Stones', 'Stargazers’ Camp'],
    lair: 'Moon Mill',
    boss: 'mochi',
    guards: ['ghost', 'mole'],
    champions: ['wolf', 'wizard', 'hawk'],
    hazard: 'ricecake',
    intro:
      'Only two colours to go! Indigo, the colour of the night sky, is up on Moonbeam Moor, where it is always night and the moon hangs so low you could almost touch it. Mochi the Moon Rabbit came down from it with his great mallet to pound rice cakes at the Moon Mill — and Queen Grizzle gave him the indigo jar to mind. Follow the lanterns over the moor — and jump when his mallet comes down!',
    freed: [
      'Lantern Gate is free! Its lanterns light up, and the gate swings open.',
      'Firefly Pond is free! The fireflies show the way round the water.',
      'The Standing Stones are free! The great stone across the path rolls back.',
      'The Stargazers’ Camp is free! The stargazers swing their telescope aside, and the door of the Moon Mill opens.',
    ],
    won: 'Pop! Mochi hopped all the way back up to the moon in three great bounds, his mallet over his shoulder — and left the indigo jar beside his mortar. Indigo is back: the night sky is deep and starry again!',
  },
  {
    key: 'vale',
    episode: 2,
    level: 13,
    icon: '☂️',
    name: 'Violet Vale',
    theme: 'vale',
    weather: ['cloudy'],
    camps: ['Grey Garden', 'Drab Bridge', 'Umbrella Court'],
    lair: 'Castle Drab',
    boss: 'grizzle',
    guards: ['knight', 'golem'],
    champions: ['wizard', 'cyclops'],
    hazard: 'smudge',
    intro:
      'Six colours shine over the isle! The last, violet, is with Queen Grizzle herself, in Castle Drab at the head of Violet Vale — where the lavender once grew as far as you could see, and now everything is as grey as a rainy Monday. She knows all her helpers’ tricks, and she has her great grey umbrella. Cross the Grey Garden, storm the castle and pop her — and bring the rainbow home!',
    freed: [
      'The Grey Garden is free! A few violets peep out, and the garden gate creaks open.',
      'Drab Bridge is free! The drawbridge comes rattling down.',
      'Umbrella Court is free! The great grey umbrellas fold up — Queen Grizzle is in the yard behind!',
    ],
    won: 'Queen Grizzle is popped, umbrella and all! All seven colours fly up into the sky, and the rainbow stands over Adventure Isle again, brighter than ever. Even Queen Grizzle has to say it looks rather nice.',
  },
];

// The stages there are to conquer: a stage for each chapter, the episodes one
// after another.
export const STAGES = CHAPTERS.length;

// An episode by its number (the first, for none or nonsense), the stage its
// chapters start at, and how many it has.
export const episodeOf = (n) => EPISODES.find((e) => e.n === n) ?? EPISODES[0];
const numberOf = (ch) => ch.episode ?? 1;
export const firstStage = (episode) => CHAPTERS.findIndex((c) => numberOf(c) === episodeOf(episode).n) + 1;
export const stagesOf = (episode) => CHAPTERS.filter((c) => numberOf(c) === episodeOf(episode).n).length;

// The chapter of a stage of the isle. stage: the stage it is; episode: the
// episode it is a chapter of; n: which of its chapters, and of: of how many;
// shards: how many of the episode's Star Shards (or colours) are back once it
// is won; level: how hard it is (as a stage of the first episode); final: it
// is the last of its episode, the end of that tale; last: it is the last of
// them all, a new journey after it. A stage past the last (never on the isle)
// is the last.
export function chapterOf(stage) {
  const s = Number.isInteger(stage) && stage >= 1 ? stage : 1;
  const i = Math.min(s, CHAPTERS.length) - 1;
  const ch = CHAPTERS[i];
  const episode = episodeOf(numberOf(ch));
  const n = i + 2 - firstStage(episode.n);
  const of = stagesOf(episode.n);
  return { ...ch, stage: i + 1, episode, n, of, shards: n, level: ch.level ?? n, final: n === of, last: i === CHAPTERS.length - 1 };
}

// What a stage is called: "Stage 3 of 12", with its episode before it once
// it is not the first's ("Episode 2 · Stage 3 of 7"); short: without how many.
export function stageName(stage, short = false) {
  const ch = chapterOf(stage);
  return `${ch.episode.n > 1 ? `Episode ${ch.episode.n} · ` : ''}Stage ${ch.n}${short ? '' : ` of ${ch.of}`}`;
}

// What a chapter won has brought back so far, as a win says it: "3 of 12 Star
// Shards back!", or all of them.
export function tokensBack(story) {
  const { many } = story.episode.token;
  return story.shards >= story.of ? `All ${story.of} ${many}!` : `${story.shards} of ${story.of} ${many} back!`;
}

// A camp's name on a stage (its id is its place along the way, the lair
// last), or null past the names the chapter has.
export function campName(stage, id, kind = 'camp') {
  const ch = chapterOf(stage);
  if (kind === 'castle') return ch.lair;
  return ch.camps[id - 1] ?? null;
}

// What is told on arriving: the chapter's own story, and on a journey after
// the first, that its episode's villain is back.
export function introOf(stage, journey = 1) {
  const ch = chapterOf(stage);
  if (!(journey > 1)) return ch.intro;
  return `${ch.episode.again(journey)} ${ch.intro}`;
}
