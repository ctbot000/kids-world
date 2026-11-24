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
// Episode 3, "The Wild Isle": where the rainbow ends, far out to sea, lies an
// island no map shows, and it is not made of bricks at all — its rocks are
// real rocks, its trees real trees and its waves real waves (render/real.js
// draws it so). Old Murk, the Fog Wolf, has stolen its five Sunstones and
// given them to the biggest creatures there to keep, and his fog has made
// every animal on it grumpy. Five chapters: Driftwood Bay, Deepwood Forest,
// Thunder Falls, Snowcap Ridge and Murk Fen, where his tower stands. Each won
// brings a Sunstone back.
//
// Episode 4, "The Golden Bells", is told another way altogether: no camps,
// no gates and no castle, and no monsters at all. Jinx the Magpie, the
// cheekiest bird on the seven seas, has carried off the five Golden Bells
// that ring the isle awake every morning (no magpie can leave anything shiny
// alone) and locked each in a cage on one of his Puzzle Isles, with a lock
// for every one of his challenges there: shinies to find, a golden key at
// the top of something tall, a monkey to catch, lost chicks or sheep to lead
// home, bonfires to light all at once, a tune of Singing Stones to sing back
// (isle-quests.js has the rules of each). The islands are open to roam, the
// challenges done in any order; the last of all, on his own island, is to
// catch Jinx himself. Five chapters: Bellbuoy Bay, Henhouse Hills, Topsy
// Gardens, Kite Cliffs and the Magpie's Nest. Each won rings a bell again.
//
// Episode 5, "Toon Isle": the biggest island on the seven seas, where
// everything looks like a cartoon — not bricks, not real rocks, but every
// rock, tree and wave drawn with a bold line round it, in colours brighter
// than paint (render/cartoon.js draws it so). Baron Bluster, a puffed-up
// storm cloud in a top hat, has blown out its five Sky Lanterns, pulled his
// Cloud Blanket over the whole island, so that nothing on it shows until
// someone gets there, and filled it with his Storm Gang. They keep no camps
// and no castle: they roam about in gangs, spring traps, storm beacons and
// hatch out of nests, and the Baron's Big Bads hunt anyone they find
// (isle-battles.js has the rules of each). Every battle won sends a spark to
// the Sky Lantern where everyone landed; with all of them it shines again.
// Five chapters: Lollipop Bay, Toadstool Woods, Rumble Canyon, Snowball
// Peaks and Thunder Top, where the Baron himself comes down to fight.
//
// Episode 6, "The Land of Nod", has no island in it at all. Baron Bluster, a
// polite little cloud these days, gave everyone the softest bit of himself, the
// Cloud Pillow, and whoever lies down on it sinks right through into the Land
// of Nod, where every dream is a sky of little worlds of any shape — moons of
// patchwork, a pumpkin as big as a hill, the inside of a music box — each with
// a down of its own, so you can walk right round every one (nod/ has them: no
// blocks anywhere). The Night Mare, a great black horse with a mane of smoke,
// has trampled five dreams into nightmares and carried off their Sweet Dreams.
// In a dream it is not how strong your weapon is that counts, but being brave
// at the right moment: her frights guard themselves, and each has a way in
// (nod/foes.js). Every nightmare over lights a lamp round the dream's
// night-light, and with all of them lit, the golden spring beside it flings you
// up to the boss's own little world. Five chapters: Pillow Moons, Pumpkin
// Skies, the Music Box, Tick-Tock Skies and the Dark Side, where the Night Mare
// herself is — who is only afraid of the dark.
//
// The last episode's last stage, won, starts a new journey from stage 1. The
// first arrival on an episode plays its opening. A chapter told on a later
// journey is its own map turned over (isle-maps.js mirror).
//
// An episode after the first is open only to those who hold its ticket, and
// the ticket is what the episode before it gives, told to its end: everyone
// on the island as its last boss goes pop gets one, to keep (ticketsHeld).

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
// icon: as that, not as stars); again: what is told before a chapter on a
// journey after the first; ticket: what lets someone into it, for every
// episode but the first; real: told on an island drawn as the real thing.
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
    ticket: { icon: '🎫', name: 'Rainbow Ticket' },
    films: { intro: 'intro2', ending: 'ending2', endingMs: 44000 },
    again: (journey) =>
      `Journey ${journey}! Queen Grizzle is back with a bigger umbrella, caught the rainbow all over again and gave its colours back to her helpers — and the Rainbow Lands have turned themselves about, so the way goes round the other side.`,
  },
  {
    n: 3,
    key: 'wild',
    icon: '🏞️',
    title: 'The Wild Isle',
    villain: 'Old Murk',
    // Drawn as the real thing, not of bricks (render/real.js), with real
    // animals in its camps (AdventureSim.guardKind).
    real: true,
    token: { one: 'Sunstone', many: 'Sunstones', icon: '☀️' },
    ticket: { icon: '🧭', name: 'Wild Isle Compass' },
    films: { intro: 'intro3', ending: 'ending3', endingMs: 44000 },
    again: (journey) =>
      `Journey ${journey}! Old Murk crept back out of the sea fog, greyer and grumpier than ever, and took the Sunstones all over again — and the Wild Isle has turned itself about, so the way goes round the other side.`,
  },
  {
    n: 4,
    key: 'bells',
    icon: '🔔',
    title: 'The Golden Bells',
    villain: 'Jinx the Magpie',
    // Told in challenges, not camps (isle-quests.js): each chapter's are in
    // its `quests`, and there is no boss to pop: Jinx is caught.
    quests: true,
    beaten: { verb: 'catch', ing: 'catching' },
    token: { one: 'Golden Bell', many: 'Golden Bells', icon: '🔔' },
    ticket: { icon: '🪶', name: 'Magpie Feather' },
    films: { intro: 'intro4', ending: 'ending4', endingMs: 44000 },
    again: (journey) =>
      `Journey ${journey}! Jinx the Magpie never could keep away from anything shiny for long: he carried off the Golden Bells all over again — and the Puzzle Isles have turned themselves about, so everything is round the other side.`,
  },
  {
    n: 5,
    key: 'toon',
    icon: '☁️',
    title: 'Toon Isle',
    villain: 'Baron Bluster',
    // Drawn as a cartoon (render/cartoon.js), on islands far bigger than any
    // before, hidden under clouds until someone gets there, and told in
    // battles, not camps (isle-battles.js): each chapter's are in its
    // `battles`.
    cartoon: true,
    battles: true,
    // Each of its islands twice as far across as any before, four times the
    // land (isle-maps.js ISLE_SIDE).
    side: 256,
    token: { one: 'Sky Lantern', many: 'Sky Lanterns', icon: '🏮' },
    ticket: { icon: '🗺️', name: 'Toon Isle Map' },
    films: { intro: 'intro5', ending: 'ending5', endingMs: 44000 },
    again: (journey) =>
      `Journey ${journey}! Baron Bluster huffed and puffed himself back up out of the sea mist, blew the Sky Lanterns out all over again and pulled his Cloud Blanket back over Toon Isle — and the island has turned itself about, so everything is round the other side.`,
  },
  {
    n: 6,
    key: 'nod',
    icon: '🌙',
    title: 'The Land of Nod',
    villain: 'the Night Mare',
    // No island, and no blocks: skies of little worlds of any shape (nod/),
    // told in nightmares, not camps: each chapter's are in its `nightmares`.
    nod: true,
    beaten: { verb: 'calm', ing: 'calming' },
    token: { one: 'Sweet Dream', many: 'Sweet Dreams', icon: '💤' },
    ticket: { icon: '🛏️', name: 'Cloud Pillow' },
    films: { intro: 'intro6', ending: 'ending6', endingMs: 44000 },
    again: (journey) =>
      `Journey ${journey}! One night the Night Mare’s night-light went out, and off she bolted again, in a worse fright than ever, trampling every dream in the Land of Nod as she went — and her frights have learnt a thing or two since last time.`,
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
// quests: in place of camps, a lair and a boss, the challenges of a chapter of
// the fourth episode (isle-quests.js), each { kind, name, hint (what to do),
// done (what is told once it is), animal (what is caught or led home, for
// those that have one), who (its name, for a monkey to catch), after (open
// only once every other is done) }, its map
// laying each out in the same order (isle-bells.js).
// nightmares: in place of camps, a lair and a boss, the nightmares of a chapter
// of the sixth episode (nod/dream.js), each { name, icon, hint (what to do), done
// (what is told once it is over) }, its world having each in the same order
// (nod/worlds), and the last of all its boss's.
// battles: in place of camps, a lair and a boss, the battles of a chapter of
// the fifth episode (isle-battles.js), each { kind, name, hint (what to do),
// done (what is told once it is won), beast and who (for a hunt: which
// beast it is, beasts.js, and its name), after (open only once every other
// is won) }, its map laying each out in the same order (isle-toon.js); gang:
// the monsters its roaming gangs are made of, the first the most of them.
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
  // ------------------------------------------------ Episode 3: the Wild Isle
  {
    key: 'cove',
    episode: 3,
    level: 9,
    icon: '🌊',
    name: 'Driftwood Bay',
    theme: 'wildcoast',
    weather: ['clear', 'clear', 'cloudy'],
    camps: ['Driftwood Beach', 'Tide Pools', 'Lighthouse Point'],
    lair: 'Old Sea Fort',
    boss: 'ironclaw',
    guards: ['snapper', 'fox'],
    champions: ['boar', 'wolf'],
    hazard: 'nut',
    intro:
      'The rainbow’s end points far out to sea — and there, where no map shows anything at all, lies the Wild Isle. It is not made of bricks: its rocks are real rocks, its trees are real trees and its waves are real waves. But a cold grey fog hangs over it. Old Murk, the Fog Wolf, has stolen its five Sunstones and given them to the biggest creatures on the island to keep, and his fog has made every animal there grumpy. The first Sunstone is with Old Ironclaw, a coconut crab as big as a rowing boat, in the Old Sea Fort out on the point. Free the bay, then go and get it back — and watch out for coconuts!',
    freed: [
      'Driftwood Beach is free! The crabs scuttle off sideways into the waves, and the driftwood across the path rolls away.',
      'The Tide Pools are free! The rocks that fell across the cliff path are rolled aside.',
      'Lighthouse Point is free! The brambles before the Old Sea Fort wither away — Old Ironclaw is waiting inside!',
    ],
    won: 'Pop! The fog blew out of Old Ironclaw’s ears, and he scuttled off into the surf, waving his claws as friendly as you like — and left the first Sunstone shining on the sand!',
  },
  {
    key: 'deepwood',
    episode: 3,
    level: 10,
    icon: '🌲',
    name: 'Deepwood Forest',
    theme: 'wildwood',
    weather: ['clear', 'cloudy', 'cloudy'],
    camps: ['Fern Hollow', 'Mossy Bridge', 'Woodcutters’ Camp', 'Old Oak'],
    lair: 'Bear’s Den',
    boss: 'bramblepaw',
    guards: ['fox', 'boar'],
    champions: ['wolf', 'boar', 'wolf'],
    hazard: 'pinecone',
    intro:
      'One Sunstone shines again, and its light points inland, into Deepwood Forest, where the pines grow so tall that their tops are lost in the fog. Old Bramblepaw, the biggest brown bear on the Wild Isle, keeps the second Sunstone in his den at the far end of the forest — and Old Murk’s fog has made him the grumpiest bear there ever was. Follow the old woodcutters’ path, and mind the pine cones!',
    freed: [
      'Fern Hollow is free! The foxes trot off into the ferns, and the logs across the path are rolled away.',
      'Mossy Bridge is free! The brambles over the stream wither, and the path on is open.',
      'The Woodcutters’ Camp is free! The fallen pine across the path is sawn through and pushed aside.',
      'The Old Oak is free! The rocks before the Bear’s Den are rolled away — Old Bramblepaw is waiting!',
    ],
    won: 'Pop! Old Bramblepaw sneezed the fog right out of his nose, sat down with a great thump and scratched his back on a pine — and there in the moss lay the second Sunstone!',
  },
  {
    key: 'falls',
    episode: 3,
    level: 11,
    icon: '💦',
    name: 'Thunder Falls',
    theme: 'wildfalls',
    weather: ['clear', 'clear', 'cloudy'],
    camps: ['Riverbend', 'Otter Pools', 'Misty Steps'],
    lair: 'Great Dam',
    boss: 'gnasher',
    guards: ['boar', 'snapper'],
    champions: ['wolf', 'boar'],
    hazard: 'stick',
    intro:
      'Two Sunstones! They point up the river, to Thunder Falls, where the water roars down over the cliffs. Up at the top, Gnasher, a beaver as big as a hay cart, has built the Great Dam out of whole trees, with the third Sunstone inside it — and when he slaps his tail, the whole valley shakes. Climb up beside the falls — and jump when he slaps!',
    freed: [
      'Riverbend is free! The logs across the river path are washed away.',
      'The Otter Pools are free! The rockfall by the pools is rolled aside, and the path up the cliff is open.',
      'The Misty Steps are free! The tangle of sticks before the Great Dam falls apart — Gnasher is waiting at the top!',
    ],
    won: 'Pop! Gnasher’s grumpy fog went off like a sneeze, and he swam off down the river on his back, nibbling a twig — and out of the dam floated the third Sunstone!',
  },
  {
    key: 'ridge',
    episode: 3,
    level: 12,
    icon: '🏔️',
    name: 'Snowcap Ridge',
    theme: 'wildpeak',
    weather: ['clear', 'clear', 'cloudy'],
    camps: ['Shepherds’ Hut', 'Glacier Lake', 'Windy Saddle'],
    lair: 'Eagle Crag',
    boss: 'curlhorn',
    guards: ['fox', 'boar'],
    champions: ['wolf', 'wolf'],
    hazard: 'rock',
    intro:
      'Three Sunstones, and the fog is thinning! The fourth is up on Snowcap Ridge, the highest place on the Wild Isle, with Old Curlhorn, a mountain ram with horns like cart wheels, who charges at anything that moves. The path climbs from the meadows past a glacier lake to Eagle Crag at the top. Step aside when he charges — and look out for rocks rolling down!',
    freed: [
      'The Shepherds’ Hut is free! The boulders across the mountain path are rolled away.',
      'Glacier Lake is free! The logs across the path by the lake are lifted aside.',
      'The Windy Saddle is free! The last rocks before Eagle Crag tumble down the slope — Old Curlhorn is waiting at the top!',
    ],
    won: 'Pop! Old Curlhorn shook his great horns, the fog flew out of his wool, and off he skipped down the mountain like a lamb — and on the crag lay the fourth Sunstone!',
  },
  {
    key: 'fen',
    episode: 3,
    level: 13,
    icon: '🌫️',
    name: 'Murk Fen',
    theme: 'wildfen',
    weather: ['cloudy'],
    camps: ['Reed Bank', 'Sunken Causeway', 'Hermit’s Hut'],
    lair: 'Murk Tower',
    boss: 'murk',
    guards: ['fox', 'snapper'],
    champions: ['wolf', 'wolf'],
    hazard: 'fog',
    intro:
      'Four Sunstones shine together, and their light points into Murk Fen, where the fog is thickest of all. That is where Old Murk lives, in the ruins of an old stone tower, with the last Sunstone. He is the biggest, greyest wolf there ever was: he leaps, he howls for his pack, and he breathes his grumpy fog all round him. Cross the fen — and pop him once and for all, so the sun can shine on the Wild Isle again!',
    freed: [
      'The Reed Bank is free! The logs across the boardwalk are pulled away.',
      'The Sunken Causeway is free! The brambles over the old causeway wither away.',
      'The Hermit’s Hut is free! The rocks before Murk Tower are rolled aside — Old Murk is waiting!',
    ],
    won: 'Old Murk is popped, fog and all! His fog blows away over the sea, and all five Sunstones fly up together, and the sun shines on the Wild Isle as it has not shone for a hundred years. Old Murk curls up in a sunny spot — it turns out he was only ever cold.',
  },
  // ------------------------------------------------ Episode 4: the Golden Bells
  {
    key: 'bellbuoy',
    episode: 4,
    level: 10,
    icon: '🏖️',
    name: 'Bellbuoy Bay',
    theme: 'sunny',
    weather: ['clear', 'clear', 'cloudy'],
    quests: [
      { kind: 'finds', name: 'Shinies on the Beach', hint: 'Jinx dropped five shinies as he flew over the bay. They glint! Walk into each one to pick it up.', done: 'Every shiny on the beach is found! Click — a lock on the cage springs open.' },
      { kind: 'climb', name: 'The Crow’s Nest', hint: 'A golden key glints at the very top of the old wreck’s mast. Climb up and grab it!', done: 'You grabbed the golden key from the crow’s nest! Click — a lock on the cage springs open.' },
      { kind: 'chase', animal: 'monkey', who: 'Coco', name: 'Catch Coco', hint: 'Coco the monkey ran off with a golden key! Run after him and touch him — he is quick, but he soon runs out of puff.', done: 'Caught! Coco giggles and hands over the golden key. Click — a lock on the cage springs open.' },
    ],
    intro:
      'Home from the Wild Isle, the sun shines and the sea is calm — but the old bell tower on the hill is silent. Its five Golden Bells rang the isle awake every morning, until Jinx the Magpie, the cheekiest bird on the seven seas, carried them all off in the night (no magpie can leave anything shiny alone!) and left a feather behind with a note: “Catch me if you can!” He has locked each bell in a cage on one of his Puzzle Isles, with a lock for every one of his challenges. No monsters this time: Jinx does not fight, he plays tricks — and every island is yours to roam, so beat his challenges in any order you like. The first bell is here in Bellbuoy Bay: find the shinies he dropped, climb to the crow’s nest of the old wreck, and catch Coco, his cheeky monkey!',
    won: 'Ding, dong! The cage swings open and the first Golden Bell rings out over the bay. Up on the cage, Jinx ruffles his feathers: “Beginner’s luck! You will never get the next one!” — and off he flies.',
  },
  {
    key: 'henhouse',
    episode: 4,
    level: 11,
    icon: '🐔',
    name: 'Henhouse Hills',
    theme: 'honey',
    weather: ['clear', 'clear', 'cloudy'],
    quests: [
      { kind: 'lead', animal: 'chick', name: 'Lost Chicks', hint: 'Jinx scared the chicks out of their coop and all over the hills. Walk up to one and it follows you — lead it back into the coop!', done: 'Every chick is home, snug in the coop! Click — a lock on the cage springs open.' },
      { kind: 'fires', name: 'Bonfire Hills', hint: 'Stand by a bonfire to light it. Each soon burns out, so all three must burn at once — friends make it easy!', done: 'All three bonfires blaze at once, and the farmers come home! Click — a lock on the cage springs open.' },
      { kind: 'finds', name: 'Golden Eggs', hint: 'Jinx swapped the hens’ eggs for golden ones and hid six of them in the hay and the fields. They glint!', done: 'Every golden egg is found! Click — a lock on the cage springs open.' },
    ],
    intro:
      'One Golden Bell rings again — and its echo comes back from Henhouse Hills, where the plumpest hens on the isle live. Jinx has been busy here too: he scared the chicks out of their coop and all over the hills, put out the bonfires the farmers light to call each other home, and swapped the hens’ eggs for golden ones and hid those. Lead the chicks home, light every bonfire on the hilltops at once, and find the golden eggs!',
    won: 'Ding, dong! The second Golden Bell rings out over Henhouse Hills, and every hen on the farm clucks along. “Pfff, easy games,” says Jinx from the windmill. “Wait till you see my garden!”',
  },
  {
    key: 'topsy',
    episode: 4,
    level: 12,
    icon: '⛲',
    name: 'Topsy Gardens',
    theme: 'tulip',
    weather: ['clear', 'clear', 'cloudy'],
    quests: [
      { kind: 'stones', name: 'The Singing Stones', hint: 'Step into the middle of the ring and listen: the stones sing a tune, one after another. Then step on them in the very same order!', done: 'The Singing Stones sing their whole tune with you! Click — a lock on the cage springs open.' },
      { kind: 'finds', name: 'The Hedge Maze', hint: 'Five shinies are lost somewhere in the hedge maze. Find your way to every one!', done: 'Every shiny in the maze is found! Click — a lock on the cage springs open.' },
      { kind: 'chase', animal: 'monkey', who: 'Kiki', name: 'Catch Kiki', hint: 'Kiki the monkey is even quicker than Coco — and she has to be caught twice!', done: 'Caught again! Kiki hands over the gardener’s golden key. Click — a lock on the cage springs open.' },
      { kind: 'climb', name: 'The Teapot Tower', hint: 'A golden key sits on the lid of the Teapot Tower. Up the spout and round the handle!', done: 'You grabbed the golden key off the teapot’s lid! Click — a lock on the cage springs open.' },
    ],
    intro:
      'Two bells ring together! The third is in Topsy Gardens, the grandest garden on the isle, with its hedge maze, its fountain and its Singing Stones, which hum a note when you step on them. Jinx has made a game of all of it: his shinies are lost in the maze, Kiki the monkey has the gardener’s golden key, the stones will only open their lock for whoever sings their tune back, and another key sits on the lid of the Teapot Tower.',
    won: 'Ding, dong! The third Golden Bell rings out, and every flower in Topsy Gardens turns to listen. Jinx shakes his tail feathers: “Three?! Well, you will never get up Kite Cliffs!”',
  },
  {
    key: 'kite',
    episode: 4,
    level: 13,
    icon: '🪁',
    name: 'Kite Cliffs',
    theme: 'maple',
    weather: ['clear', 'cloudy'],
    quests: [
      { kind: 'climb', name: 'Kite Peak', hint: 'The highest golden key of all hangs at the very top of Kite Peak. Up you go, step by step — and mind the edges!', done: 'You reached the top of Kite Peak and grabbed the key! Click — a lock on the cage springs open.' },
      { kind: 'fires', name: 'The Cliff Beacons', hint: 'Four beacons stand along the clifftops. Stand by each to light it — and all four must burn at once!', done: 'All four beacons blaze along the cliffs! Click — a lock on the cage springs open.' },
      { kind: 'stones', name: 'The Wind Stones', hint: 'Up here the stones sing longer tunes. Step into the middle, listen carefully, then step on them in the same order!', done: 'The Wind Stones sing their whole long tune with you! Click — a lock on the cage springs open.' },
      { kind: 'lead', animal: 'sheep', name: 'Lost Sheep', hint: 'The wind blew the shepherd’s sheep all over the clifftops. Walk up to one and it follows you — lead it back into the fold!', done: 'Every sheep is back in the fold! Click — a lock on the cage springs open.' },
    ],
    intro:
      'Three bells! The fourth is up on Kite Cliffs, where the wind blows so hard that everyone flies kites — and Jinx flies best of all. He has hung a golden key at the very top of Kite Peak, put out the beacons along the cliffs, taught the Wind Stones a long, tricky tune — and the wind has blown the shepherd’s sheep all over the clifftops. Mind the edges!',
    won: 'Ding, dong! The fourth Golden Bell rings out so loud that the kites dance. Jinx has had enough: “Fine! But the last bell is in MY nest — and nobody has ever caught ME!”',
  },
  {
    key: 'nest',
    episode: 4,
    level: 14,
    icon: '✨',
    name: 'The Magpie’s Nest',
    theme: 'moor',
    weather: ['clear', 'cloudy'],
    quests: [
      { kind: 'finds', name: 'Jinx’s Hoard', hint: 'Six of Jinx’s shinies are scattered all round his island. They glint!', done: 'You found all of Jinx’s hoard! Click — a lock on the cage springs open.' },
      { kind: 'chase', animal: 'monkey', who: 'Bobo', name: 'Catch Bobo', hint: 'Bobo is the quickest monkey of them all — and he has to be caught three times!', done: 'Caught for the third time! Bobo flops down, puffed out, and hands over his golden key. Click — a lock on the cage springs open.' },
      { kind: 'climb', name: 'The Nest Tree', hint: 'Climb the great tree, branch by branch, to the golden key at the top.', done: 'You grabbed the golden key from the top of the Nest Tree! Click — a lock on the cage springs open.' },
      { kind: 'jinx', after: true, name: 'Catch Jinx!', hint: 'Jinx sits up on his nest, out of reach. Light every beacon round it at once: he tumbles down, dazzled — catch him before he flies back up! Three times!', done: 'Jinx is caught, fair and square!' },
    ],
    intro:
      'Four Golden Bells ring together, so loud they are heard far out to sea — all the way to a rocky island with an enormous nest on top: Jinx’s own, built of every shiny thing he ever took. The last bell is in a cage beside it. Find his hoard, catch Bobo, the quickest monkey of them all, climb the Nest Tree — and then catch Jinx himself! He sits too high to reach, but no magpie can stand a bright light: light every beacon round his nest at once and down he will tumble, dazzled. Catch him before he flies back up!',
    won: 'Jinx is caught, fair and square! He gives a great sigh, fluffs up his feathers — and gives back every Golden Bell. All he ever wanted was someone to play with. Now all five Golden Bells ring the isle awake every morning again, and Jinx perches on the bell tower to listen, as good as gold. Well — almost.',
  },
  // ------------------------------------------------ Episode 5: Toon Isle
  {
    key: 'lollipop',
    episode: 5,
    level: 12,
    icon: '🍭',
    name: 'Lollipop Bay',
    theme: 'toonbay',
    weather: ['clear', 'clear', 'cloudy'],
    gang: ['snapper', 'blob', 'spiky', 'big'],
    battles: [
      { kind: 'ambush', name: 'The Shipwreck', hint: 'A Lantern Spark glitters in the old shipwreck on the beach — but it is a trap! Walk up to it and a ring of thorns springs up all round you, and the Storm Gang comes at you, wave after wave. Pop every last one to break the ring. Friends inside the ring with you make it easier!', done: 'The last wave is popped and the thorns crumble away: the Lantern Spark is yours!' },
      { kind: 'siege', name: 'The Lighthouse Beacon', hint: 'Stand by the beacon at the top of the lighthouse cliff to light it, then keep it burning: the Storm Gang rushes at it from every side to put it out. Keep them off it until the bar runs out!', done: 'The beacon blazed on till the Storm Gang gave up and ran!' },
      { kind: 'hunt', beast: 'hydra', who: 'Old Snapjaw', name: 'Hunt Old Snapjaw', hint: 'Old Snapjaw, a Swamp Hydra with three grumpy heads, roams about the bay. Find him! Hurt him and he runs off to lick his wounds somewhere else — follow his tracks and finish him off before he gets his hearts back.', done: 'Old Snapjaw is popped, all three heads at once!' },
    ],
    intro:
      'Jinx was so sorry for all his tricks that he gave you the best thing in his whole nest: an old sea chart of Toon Isle, the biggest island on the seven seas, where everything looks like a cartoon — every rock, tree and wave drawn with a bold line round it, in colours brighter than paint. But the middle of the chart is blank, and when your boat gets there you see why. Baron Bluster, a puffed-up storm cloud in a top hat, has blown out the five Sky Lanterns that kept the clouds away and pulled his Cloud Blanket over the whole island, so thick that nobody can see what is under it. Wherever you go, the clouds roll back — for everyone. And under them waits his Storm Gang, who keep no camps and no castle: they roam about in gangs, spring traps, storm beacons and hunt. Win every battle on Lollipop Bay: each one sends a spark to the Sky Lantern where you landed, and with all of them it shines again!',
    won: 'Whoosh! The last spark flies into the Sky Lantern: it blazes up and floats high over Lollipop Bay — and the clouds there blow away like dandelion fluff. Far off, Baron Bluster shakes his fist: “One lantern! I have four more, and my Big Bads are bigger than ever!”',
  },
  {
    key: 'toadstool',
    episode: 5,
    level: 13,
    icon: '🍄',
    name: 'Toadstool Woods',
    theme: 'toonwood',
    weather: ['clear', 'cloudy', 'cloudy'],
    gang: ['shroom', 'spider', 'blob', 'big'],
    battles: [
      { kind: 'hunt', beast: 'oak', who: 'Thumpwood', name: 'Hunt Thumpwood', hint: 'Thumpwood, a Grumble Oak as tall as a house, stomps about the woods. Find him under the clouds, and keep after him when he runs: he gets his hearts back if you let him rest!', done: 'Thumpwood is popped, leaves and all!' },
      { kind: 'nest', name: 'The Storm Nests', hint: 'Storm Nests sit in a glade among the giant toadstools, each hatching a monster every few seconds. Bop the nests till they burst — the monsters keep coming until every nest is gone!', done: 'The last Storm Nest bursts like a soap bubble!' },
      { kind: 'ambush', name: 'The Fairy Ring', hint: 'A Lantern Spark floats in the middle of a ring of toadstools. Take it — if you dare: thorns spring up round the ring and the Storm Gang comes at you, wave after wave!', done: 'Every wave is popped, and the Fairy Ring is a happy place again!' },
      { kind: 'siege', name: 'The Woodcutters’ Beacon', hint: 'Light the old woodcutters’ beacon on the hill, then keep it burning till the bar runs out, whatever the Storm Gang throws at it!', done: 'The woodcutters’ beacon burned bright, and the Storm Gang ran off into the woods!' },
    ],
    intro:
      'One Sky Lantern shines again, and the clouds have rolled back off Lollipop Bay! Its light points inland, to Toadstool Woods, where the mushrooms grow as big as houses and the trees are as round as lollipops. Thumpwood, the grumpiest Grumble Oak there ever was, stomps about under the clouds; the Storm Gang has built nests in the glades, set a trap in the Fairy Ring and is out to put out the woodcutters’ beacon. Find every battle — mind the gangs on the paths!',
    won: 'Whoosh! The second Sky Lantern floats up over Toadstool Woods, and every mushroom glows. “Two?!” huffs Baron Bluster. “You will never get through Rumble Canyon!”',
  },
  {
    key: 'rumble',
    episode: 5,
    level: 14,
    icon: '🏜️',
    name: 'Rumble Canyon',
    theme: 'tooncanyon',
    weather: ['clear', 'clear', 'cloudy'],
    gang: ['mummy', 'spiky', 'knight', 'golem'],
    battles: [
      { kind: 'hunt', beast: 'rex', who: 'Rumbletooth', name: 'Hunt Rumbletooth', hint: 'Rumbletooth, a Rumble Rex so big that his roar knocks the dust off the mesas, hunts up and down the canyon. Track him down, and do not let him get away to rest!', done: 'Rumbletooth is popped with one last ROAR!' },
      { kind: 'siege', name: 'The Mesa Beacon', hint: 'Light the beacon on top of the big mesa and keep it burning till the bar runs out: the Storm Gang comes up from the canyon on every side!', done: 'The Mesa Beacon blazed all the way through, and the Storm Gang tumbled back down the canyon!' },
      { kind: 'ambush', name: 'The Fossil Pit', hint: 'A Lantern Spark lies among the giant bones in the Fossil Pit. Grab it and the trap springs: thorns all round and wave after wave of the Storm Gang!', done: 'The last wave is popped, and the old bones rattle with joy!' },
      { kind: 'nest', name: 'The Thunder Nests', hint: 'Thunder Nests crackle in the canyon, hatching monsters as fast as you pop them. Burst every nest!', done: 'The last Thunder Nest goes off with a fizzle!' },
    ],
    intro:
      'Two lanterns shine! The third is lost in Rumble Canyon, where the rocks are striped like candy and the cacti wave their arms at you. Rumbletooth, a Rumble Rex so big that his roar knocks the dust off the mesas, hunts up and down it, and the Storm Gang has nests, a trap and a beacon to fight over. The canyon is a maze — follow the paths, and mind the edges!',
    won: 'Whoosh! The third Sky Lantern floats up over Rumble Canyon, and the stripes on the rocks shine like a rainbow. “Grrr!” rumbles Baron Bluster. “Nobody has ever climbed Snowball Peaks!”',
  },
  {
    key: 'snowball',
    episode: 5,
    level: 15,
    icon: '⛄',
    name: 'Snowball Peaks',
    theme: 'toonpeak',
    weather: ['clear', 'cloudy', 'snow'],
    gang: ['yeti', 'knight', 'spiky', 'golem'],
    battles: [
      { kind: 'hunt', beast: 'cyclops', who: 'Big Blink', name: 'Hunt Big Blink', hint: 'Big Blink, a one-eyed Cyclops as tall as a pine, stomps about the snowy valleys. Find him, and keep after him when he runs off — he is slow, but he never stops!', done: 'Big Blink is popped, and he blinks for the very last time!' },
      { kind: 'ambush', name: 'The Ice Cave', hint: 'A Lantern Spark sparkles inside the Ice Cave. Trap! Take it and thorns of ice spring up round you while the Storm Gang comes at you, wave after wave.', done: 'Every wave is popped, and the Ice Cave sparkles again!' },
      { kind: 'nest', name: 'The Blizzard Nests', hint: 'Blizzard Nests sit up on the slopes, hatching monsters in a flurry. Burst every one!', done: 'The last Blizzard Nest pops in a puff of snow!' },
      { kind: 'siege', name: 'The Summit Beacon', hint: 'Light the beacon on the summit and keep it burning till the bar runs out. Up here the Storm Gang is at its toughest!', done: 'The Summit Beacon burned so bright that it could be seen from the sea!' },
    ],
    intro:
      'Three Sky Lanterns shine, and the Cloud Blanket is thinning! The fourth lantern is up in Snowball Peaks, where the snow is as soft as whipped cream and the mountains have rosy cheeks. Big Blink, a one-eyed Cyclops, stomps about the valleys, the Storm Gang has nests up on the slopes and a trap in the Ice Cave, and the summit beacon has gone out. Wrap up warm!',
    won: 'Whoosh! The fourth Sky Lantern floats up over Snowball Peaks, and every snowman on the mountains cheers. Baron Bluster turns a very dark grey: “Enough! Come up to Thunder Top — if you dare — and I will blow you all the way home!”',
  },
  {
    key: 'thunder',
    episode: 5,
    level: 16,
    icon: '⛈️',
    name: 'Thunder Top',
    theme: 'toonstorm',
    weather: ['cloudy'],
    // (Its Baron, at the very end: isle-battles.js showdown.)
    boss: 'bluster',
    gang: ['knight', 'golem', 'spiky', 'mosquito'],
    battles: [
      { kind: 'hunt', beast: 'wizard', who: 'Gusto', name: 'Hunt Gusto', hint: 'Gusto, the Baron’s own Grumble Wizard, blinks about the stormy hills. Corner him, and keep after him when he runs!', done: 'Gusto is popped, and his hat blows away in the wind!' },
      { kind: 'siege', name: 'The Lightning Tower', hint: 'Light the beacon on the old Lightning Tower and keep it burning till the bar runs out, while the Storm Gang storms it!', done: 'The Lightning Tower’s beacon blazed through the storm!' },
      { kind: 'ambush', name: 'The Storm Circle', hint: 'A Lantern Spark crackles in the middle of the Storm Circle. Take it, and the thorns spring up for the toughest ambush of all!', done: 'The Storm Circle is quiet at last!' },
      { kind: 'nest', name: 'The Thundercloud Nests', hint: 'Thundercloud Nests rumble on the hilltops, hatching the Storm Gang’s toughest. Burst every one!', done: 'The last Thundercloud Nest bursts with a boom!' },
      { kind: 'showdown', after: true, name: 'Baron Bluster!', hint: 'Once every other battle is won, Baron Bluster comes down to his arena on the very top. Up on his cloud he is out of reach: stand on all three lightning rods round the arena at once to zap him down, then bop him while he is on the ground. Three times!', done: 'Baron Bluster is popped, top hat and all!' },
    ],
    intro:
      'Four Sky Lanterns shine together, and only Thunder Top is still under the Cloud Blanket, rumbling and flashing. Baron Bluster is up there, on his arena at the very top, with the last lantern — and his toughest Storm Gang, his own Grumble Wizard Gusto, a trap, nests and a lightning tower. Win every battle and the Baron comes down to fight you himself: zap him off his cloud with his own lightning rods, then pop him once and for all!',
    won: 'Baron Bluster is popped, top hat and all! He goes off like a burst balloon, whizzing round and round over the island and shrinking as he goes, until he is a little white cloud, puffing politely. All five Sky Lanterns float up together, and the Cloud Blanket blows away for good: Toon Isle shines in the sun from end to end, brighter than any cartoon.',
  },
  // ------------------------------------------------ Episode 6: The Land of Nod
  {
    key: 'pillow',
    episode: 6,
    level: 14,
    icon: '🛏️',
    name: 'Pillow Moons',
    theme: 'nodpillow',
    day: 'night',
    weather: ['clear'],
    nightmares: [
      { name: 'The Bolster Stampede', icon: '🐏', hint: 'Grumble Rams are all wool in front, and bops bounce off it. Roll aside as they charge so they bump into something, or bop them just as they flash!', done: 'The last Grumble Ram trots off to be shorn, and the bolster is soft and quiet again. A lamp lights by the night-light!' },
      { name: 'The Thimble Ring', icon: '🪡', hint: 'Bops clang off a Thimble Knight: jump, and bop in the air to slam down and tip it over. And bop the Night Moths’ dust balls right back at them!', done: 'The Thimble Knights are tipped over for good, and the moths flutter off to find a nicer lamp. Yours lights by the night-light!' },
      { name: 'The Sleepless Moon', icon: '⏰', hint: 'Nobody can sleep on the biggest moon: an Alarm Clock stamps about on it, ringing. Jump over its rings as they roll right round the moon — and bop it once it has rung itself out!', done: 'The Alarm Clock has wound right down at last. Shh! The lamp by the night-light is lit.' },
      { name: 'Rambunctious', icon: '🐏', hint: 'Nothing gets through all that wool! Stand in front of one of his bedposts, and roll aside at the last moment as he charges: BONK! Jump over his rings — and mind your back, he rolls all the way round!', done: 'Rambunctious has had enough: he lies down, sighs, and is fast asleep.' },
    ],
    intro:
      'Baron Bluster, a polite little cloud these days, was so sorry about the Cloud Blanket that he gave everyone the softest bit of himself: the Cloud Pillow. Lie down on it, and down you sink — right through, and out at the other side, into the Land of Nod, where there is no island, no sea and not a brick to be seen! Every dream here is a sky of little worlds, each with a down of its own, so you can walk right round every one; step on a spring, and it flings you to the next. But the Night Mare, a great black horse with a mane of smoke, has trampled five dreams into nightmares and carried off their Sweet Dreams. Nothing here cares how strong your weapon is. In a dream you have to be brave at the right moment: roll (Shift, or 💨) just as a blow lands, bop back what is thrown or what flashes, slam down out of the air — and once you are as brave as can be, let it all out in a Brave Burst! This first is the Shepherd’s dream, and not one of his sheep will be counted.',
    won: 'Baa! Rambunctious is fast asleep with his nightcap over his eyes, and every sheep jumps over the moon, one by one: the Shepherd’s Sweet Dream is back. Far off across the sky, something black gallops away with sparks at its heels…',
  },
  {
    key: 'garden',
    episode: 6,
    level: 15,
    icon: '🎃',
    name: 'Pumpkin Skies',
    theme: 'nodgarden',
    day: 'day',
    weather: ['clear'],
    nightmares: [
      { name: 'The Pea Pod Raid', icon: '🪲', hint: 'Weevil Knights in shiny armour have come for the peas. Bops clang off their shells: slam down out of the air beside them to flip them on their backs — and get out of the way when they tuck themselves up and roll!', done: 'The last Weevil Knight scuttles off on its back legs, and all the peas are safe in their pod. A lamp lights by the night-light!' },
      { name: 'The Rotten Apple', icon: '🪴', hint: 'Snaptraps burrow about under the skin of the apple: when the ground goes red under you, roll clear — and bop them while they are stuck. And bop the Snapdragons’ seeds right back at them!', done: 'The Snaptraps have bitten off more than they can chew. The apple shines again — and so does a lamp!' },
      { name: 'The Dizzy Snail', icon: '🦗', hint: 'Grump-hoppers leap and leap and leap, round and round the poor snail’s shell. Keep moving! After the third leap they have to catch their breath.', done: 'The Grump-hoppers hop off in a huff, and a very dizzy snail peeps out to say thank you. Its lamp is lit!' },
      { name: 'Old Munch', icon: '🐛', hint: 'Old Munch is eating the Gardener’s prize pumpkin. His waistcoats are all studs, but his tail is bare: keep out of his jaws, run round behind him and bop it! Bop his nose just as it flashes and he stops to rub it.', done: 'Old Munch is so full, and so tired, that he spins himself up for the night.' },
    ],
    intro:
      'The spring at the end of the Shepherd’s dream flings you clean across the night and out into broad daylight: Pumpkin Skies, the Gardener’s dream, where a beanstalk grows up out of a flower pot (you can walk right round it, all the way up!), and a pea pod, an apple, a snail and a toadstool hang in the sun. But the Night Mare’s hooves have trampled the beds, and every pest that ever kept a gardener awake has come to dinner — Weevil Knights, Snaptraps, Snapdragons and Grump-hoppers — and up on the prize pumpkin itself somebody very long and very hungry goes round, and round, and round.',
    won: 'Old Munch spins himself a cocoon as big as a barrel, and in the morning of the dream out flies the most beautiful butterfly the Gardener ever dreamt of. The second Sweet Dream is back! A whinny rolls across the sky, like thunder a long way off…',
  },
  {
    key: 'music',
    episode: 6,
    level: 16,
    icon: '🎼',
    name: 'The Music Box',
    theme: 'nodmusic',
    day: 'night',
    weather: ['clear'],
    nightmares: [
      { name: 'The Scratched Record', icon: '🥁', hint: 'Thumpers beat out their rings over the record — two, and then four: jump every one! After the fourth they are worn out. (There are two sides to every record…)', done: 'The needle comes down, and the record plays right through without a scratch. A lamp lights by the night-light!' },
      { name: 'The Runaway Music Box', icon: '🎵', hint: 'Down, inside the music box, is out: you can run right round the inside of it! Metronomes sweep their beams round the barrel, and Quavers swoop. Jump, and bop, and keep in time.', done: 'The music box winds down, tinkle, tinkle, plink. Its lamp is lit!' },
      { name: 'The Ring of Keys', icon: '🎹', hint: 'Every key of the great ring sounds as you step on it. Castanets snap open to spit their notes: bop those right back, and bop them while they are open — or slam them over!', done: 'The whole ring of keys plays a chord, and not a wrong note in it. The lamp by the night-light is lit!' },
      { name: 'Maestro Crescendo', icon: '🎼', hint: 'The Maestro shows you a tune first: a ring to jump, a note to bop right back, a crash to roll clear of — and then he plays it at you, on the beat! Bop enough of his notes back and he drops his baton: that is when to get him.', done: 'Maestro Crescendo bows, and bows, and cannot stop bowing.' },
    ],
    intro:
      'From the garden you are flung into the dark, and then the lights come up, one by one: the Music Box, the Fiddler’s dream. A drum to land on, a record as wide as a field (with two sides to it), a ring of piano keys that play as you run round it, a trumpet, a cymbal — and a music box so big that you can run right round the inside. But the Night Mare’s gallop has put everything out of time: Thumpers thump, Metronomes sweep, Castanets snap, and on his podium high over it all Maestro Crescendo conducts the worst noise anybody ever dreamt. Listen for the beat!',
    won: 'The Maestro’s baton snaps, and in the hush a cradle song starts up all by itself, on the fiddle first, and then on everything. The third Sweet Dream is back! Somewhere a clock strikes thirteen…',
  },
  {
    key: 'clock',
    episode: 6,
    level: 17,
    icon: '🕰️',
    name: 'Tick-Tock Skies',
    theme: 'nodclock',
    day: 'night',
    weather: ['clear'],
    nightmares: [
      { name: 'The Jammed Gears', icon: '🗝️', hint: 'Wind-up Knights are all shield in front, and they come at you cut, cut, spin. Bop them back as they flash, or wait: after the spin they have run right down. Mind the Coglings bowling by!', done: 'The gears grind, and turn, and go round as sweetly as ever. A lamp lights by the night-light!' },
      { name: 'Round the Globe', icon: '🐦', hint: 'Bomb Cuckoos keep out of reach over the brass globe, laying clockwork eggs on you. Get out from under, and bop their cogs right back at them!', done: 'The last cuckoo pops back into its clock and slams the door. The globe is yours, and its lamp is lit!' },
      { name: 'The Hourglass', icon: '🃏', hint: 'Time is running out of the hourglass, and Grumpy Jacks are leaping out of their boxes all over it. Step aside as they spring — and bop them while they dangle!', done: 'The hourglass turns itself over with a sigh, and there is all the time in the world again. The lamp is lit!' },
      { name: 'Old Tock', icon: '🕰️', hint: 'Old Tock stands in the middle of his own great dial, and his hands sweep right round it: jump them! Nothing hurts him in front. But every clock has a key, and his is round the back: run over the edge to the other side of the dial, and bop it when he has struck and run down!', done: 'Old Tock has stopped. Then, very gently: tick. Tock.' },
    ],
    intro:
      'Thirteen o’clock! The Clockmaker’s dream is all brass and starlight: a pocket watch to land on, great gears, a globe with a ring to run round, an hourglass, a pendulum as long as a street — Tick-Tock Skies. But the Night Mare has galloped through the works, and time has got its legs in a knot. Wind-up Knights drill on the gears, Bomb Cuckoos lay clockwork eggs, Jacks spring out of boxes, and in the middle of his own great dial stands Old Tock, the grandfather of all clocks, striking whenever he feels like it. There are two sides to everything here. Remember that!',
    won: 'Old Tock’s key turns, his door swings open, and out comes not a cuckoo but a lullaby. The fourth Sweet Dream is back! And now there is only one place left in the Land of Nod where nobody has ever wanted to go: the Dark Side.',
  },
  {
    key: 'mare',
    episode: 6,
    level: 18,
    icon: '🌑',
    name: 'The Dark Side',
    theme: 'nodmare',
    day: 'night',
    weather: ['clear'],
    nightmares: [
      { name: 'The Ribbon with One Side', icon: '👤', hint: 'Run right round the ribbon, and you are on the other side of it — and that is the same side. Shadow Twins wait for you on it, as quick as you are, and they know all your tricks. Bop them as they flash!', done: 'Your last Shadow Twin gives you a nod, and goes back to following you about. A lamp lights by the night-light!' },
      { name: 'Under the Bed', icon: '🖐️', hint: 'There is something under the bed, of course there is. Go over the edge of the mattress and look: Under-bed Grabbers reach up twice — roll clear, and roll clear again, and bop them while they are stuck.', done: 'There is nothing under the bed any more but one lost sock. The lamp is lit!' },
      { name: 'The Broken Moon', icon: '👁️', hint: 'Night Watchers sweep the broken moon with their beams. Jump as they come round, bop their darts back, and run in when their eyes water — and mind the Gloom Moths overhead.', done: 'The Watchers shut their eyes at last, and the moon is whole again. The last lamp is lit!' },
      { name: 'The Night Mare', icon: '🐴', hint: 'Here she comes! Bop her just as she flashes, or roll clear as she gallops by. Then she is three — and only one of them strikes sparks. And when it goes quite dark, stay by the lights: slam down on all three to light them, and she is dazzled!', done: 'The Night Mare stands trembling in the light. She was never angry at all.' },
    ],
    intro:
      'So this is where she lives. On the Dark Side nobody has ever dreamt anything nice: a moon broken in bits, a ribbon of night with only one side to it, a bed with something under it — and, over it all, the black moon where the Night Mare gallops round and round and never, ever stops. Her best frights are here: Shadow Twins that know all your tricks, Under-bed Grabbers, Night Watchers and Gloom Moths. You have four Sweet Dreams to keep you company, and one little night-light. Be as brave as you can. It is always darkest just before…',
    won: 'The Night Mare does not pop. She stands there in the light of every lamp you lit, and shakes, and you see what nobody ever saw before: she is only a young horse, and she is afraid of the dark. That is why she runs. So you give her the night-light to keep — and she lies down, and puts her nose on it, and sleeps. All five Sweet Dreams are back, and there is not a nightmare left in the Land of Nod.',
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

// ---------------------------------------------------------------- tickets

// How many times someone has been there as an episode was told to its end —
// on the island as its last boss went pop — is counted in the isle's own
// world of them (stickers.js STAT_KEYS), under this: toldstar, toldrainbow.
export const toldKey = (episode) => `told${episodeOf(episode).key}`;

// The ticket an episode needs ({ icon, name }), or null for the first, which
// is open to everyone.
export const ticketOf = (episode) => episodeOf(episode).ticket ?? null;

// The episodes whose tickets someone holds, from what they have done (their
// counts): each one whose episode before it they have seen told to its end.
// Kept for good. This is what a page tells an island of the isle as it comes.
export const ticketsHeld = (stats) => EPISODES.filter((e) => e.ticket && stats?.[toldKey(e.n - 1)] >= 1).map((e) => e.n);

// Whether tickets (the episodes of them, as ticketsHeld gives) let into an
// episode: the first needs none.
export const ticketFits = (episode, tickets) => !ticketOf(episode) || (Array.isArray(tickets) && tickets.includes(episodeOf(episode).n));

// What is done to an episode's villain at its end, as told: popped, or (Jinx
// the Magpie) caught — { verb, ing }.
export const beatenOf = (episode) => episodeOf(episode).beaten ?? { verb: 'pop', ing: 'popping' };

// What someone without an episode's ticket is told.
export function ticketNeeded(episode) {
  const ep = episodeOf(episode);
  if (!ep.ticket) return '';
  const before = episodeOf(ep.n - 1);
  const { verb } = beatenOf(before.n);
  return `Episode ${ep.n} needs the ${ep.ticket.icon} ${ep.ticket.name}. ${verb[0].toUpperCase()}${verb.slice(1)} ${before.villain} at the end of Episode ${before.n} to get yours!`;
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
// last), or null past the names the chapter has. (On a chapter told in
// challenges, a challenge's name, by its id: questOf; in battles, a
// battle's: battleOf.)
export function campName(stage, id, kind = 'camp') {
  const ch = chapterOf(stage);
  if (ch.quests) return questOf(stage, id)?.name ?? null;
  if (ch.battles) return battleOf(stage, id)?.name ?? null;
  if (ch.nightmares) return ch.nightmares[id - 1]?.name ?? null;
  if (kind === 'castle') return ch.lair;
  return ch.camps[id - 1] ?? null;
}

// A challenge of a chapter told in challenges (the fourth episode's), by its
// id (its place in the chapter's list, from 1), or null.
export function questOf(stage, id) {
  return chapterOf(stage).quests?.[id - 1] ?? null;
}

// A battle of a chapter told in battles (the fifth episode's), by its id
// (its place in the chapter's list, from 1), or null.
export function battleOf(stage, id) {
  return chapterOf(stage).battles?.[id - 1] ?? null;
}

// What is told on arriving: the chapter's own story, and on a journey after
// the first, that its episode's villain is back.
export function introOf(stage, journey = 1) {
  const ch = chapterOf(stage);
  if (!(journey > 1)) return ch.intro;
  return `${ch.episode.again(journey)} ${ch.intro}`;
}
