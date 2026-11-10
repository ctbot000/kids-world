// The bosses: whoever holds the lair at the end of a stage of Adventure Isle
// (adventure.js). Each chapter's lair (isle-story.js) is held by a boss of
// its own — one of King Grumble's eleven captains, each keeping a Star Shard
// for him — and King Grumble himself waits on Gloom Rock at the end of the
// first episode, knowing every one of his captains' tricks. In the second,
// six helpers of his big sister each keep a colour of the rainbow for her in
// the Rainbow Lands, and Queen Grizzle herself waits in Castle Drab.
//
// A boss is big, has lots of hearts (adventure.js kingHearts, times its
// hearts here), sits safe in a bubble while any camp is still to free, and
// has moves of its own, each showing before it comes (monsters.js
// MonsterSim.bossStep does them, room.js what they do to people):
//
//   stomp   it crouches, jumps straight up and lands with a thump that
//           knocks over anyone on the ground within reach: jump! Down from
//           it, it sits dazed a moment.
//   leap    it crouches and leaps onto where someone stood, a ring there
//           showing where it will come down: out of the ring, or jump!
//           Dazed after, too.
//   charge  it rears back, a strip on the ground showing the way it will
//           go, and rushes straight along it: step aside! Into a wall, it
//           sits dazed.
//   hurl    it lifts something over its head and throws one at each of
//           the nearest few, a ring on the ground where each comes down:
//           out of the ring!
//   puff    it swells up and puffs a cloud all round it: step back!
//   breath  it rears back and breathes a jet of fire the way it faces:
//           out of the way!
//
// Each move comes in once the boss is cross enough (rage 0 to start with,
// 1 at two thirds of its hearts, 2 at a third: adventure.js stepCastle),
// and the crosser it is, the sooner each next move comes (gap, by rage)
// and the quicker it gets about (run, by rage). Each time it gets crosser,
// it calls two of its minions to help it.
//
// bumps: how many bumps' worth of HP each move takes (monsters.js BUMP_HP);
// windup: how long it shows a move coming; reach: how far a stomp or a
// leap's landing, a puff or a breath reaches, or how near where something
// thrown comes down; near and far: how near or far whoever it is after
// can be for the move to be started at them.

// King Grumble's body, as tall as a player and much wider (the others are
// bigger again, each its own shape).
export const KING_BODY = { radius: 0.95, height: 1.8 };

// His stomp: now and then, near whoever he is after, he crouches (long
// enough to see it coming, with a ring on the ground as far as it reaches),
// jumps straight up and lands with a thump that knocks over anyone on the
// ground that near; anyone in the air then is missed. Down from one, he
// sits dazed a moment: he bumps nobody, and a bop then takes DAZED_HIT
// hearts (monsters.js). every: how long from landing to the next, for one
// that stomps with no moves of its own to say (monsters.js stompOf).
export const STOMP = { every: 6500, windup: 900, reach: 6, jump: 10.5 };

// The bosses of Adventure Isle, by kind (monsters.js MONSTER_KINDS), in the
// order of the chapters they hold (isle-story.js).
export const BOSSES = {
  // Captain Clawbeard, of Driftwood Fort on Shipwreck Shore: a giant pirate
  // crab with a captain's hat and a bushy beard. He charges at you from afar
  // and slams his claws down when you are near; when he is cross he throws
  // coconuts too. His minions: Snappy Crabs.
  clawbeard: {
    icon: '🦀',
    name: 'Captain Clawbeard',
    body: { radius: 1.1, height: 1.5 },
    hearts: 1,
    bump: 1,
    run: [3.4, 4.2, 5],
    gap: [4200, 3400, 2600],
    minion: 'snapper',
    moves: [
      { move: 'charge', from: 0, windup: 1100, speed: 12, far: 14, near: 3, bumps: 1.5 },
      { move: 'stomp', from: 0, windup: 850, reach: 4.5, jump: 8.5, bumps: 1 },
      { move: 'hurl', from: 1, windup: 900, what: 'coconut', count: 2, reach: 1.6, ms: 1200, far: 16, bumps: 1 },
    ],
  },
  // Old Puffcap, of the Hollow Tree Hideout in the Whispering Woods: a
  // great old mushroom with a long white beard, slow on his stalk. He puffs
  // great clouds of spores and lobs spore pods at you from afar; at the
  // last he stomps too. His minions: Puffshrooms.
  puffcap: {
    icon: '🍄',
    name: 'Old Puffcap',
    body: { radius: 1.05, height: 2.4 },
    hearts: 1,
    bump: 1,
    run: [2.4, 3, 3.6],
    gap: [3600, 3000, 2400],
    minion: 'shroom',
    moves: [
      { move: 'puff', from: 0, windup: 1100, what: 'spores', reach: 5, bumps: 1 },
      { move: 'hurl', from: 0, windup: 900, what: 'pod', count: 3, reach: 2, ms: 1400, far: 18, bumps: 1 },
      { move: 'stomp', from: 2, windup: 900, reach: 5, jump: 9, bumps: 1 },
    ],
  },
  // Frostfang, of the Ice Palace at the top of Frostpeak Pass: the biggest
  // yeti there ever was, with an icy crown and two great fangs. His stomp
  // reaches further than King Grumble's, he throws snowballs, and when he
  // is very cross he slides at you on his tummy. His minions: snowy blobs.
  frostfang: {
    icon: '❄️',
    name: 'Frostfang',
    body: { radius: 1.05, height: 2.3 },
    hearts: 1.1,
    bump: 1.5,
    run: [3.2, 4, 4.8],
    gap: [4000, 3200, 2500],
    minion: 'blob',
    moves: [
      { move: 'stomp', from: 0, windup: 900, reach: 6.5, jump: 11, bumps: 1.5 },
      { move: 'hurl', from: 0, windup: 800, what: 'snowball', count: 2, reach: 2, ms: 1300, far: 18, bumps: 1 },
      { move: 'charge', from: 2, windup: 1000, speed: 13, far: 16, near: 3, bumps: 1.5 },
    ],
  },
  // Gumbo the Gummy Giant, of the Candy Castle in Candy Canyon: a great red
  // gummy bear in a crown of gumdrops. He bounces up and comes down on you,
  // throws gumdrops when he is cross, and stomps when he is crosser. His
  // minions: Gummy Cubs.
  gumbo: {
    icon: '🧸',
    name: 'Gumbo the Gummy Giant',
    body: { radius: 1.05, height: 2.1 },
    hearts: 1.1,
    bump: 1,
    run: [3.4, 4.2, 5],
    gap: [3600, 2900, 2300],
    minion: 'cub',
    moves: [
      { move: 'leap', from: 0, windup: 800, reach: 4.5, jump: 12, far: 14, bumps: 1.5 },
      { move: 'hurl', from: 1, windup: 800, what: 'gumdrop', count: 3, reach: 1.8, ms: 1200, far: 16, bumps: 1 },
      { move: 'stomp', from: 2, windup: 800, reach: 5, jump: 10, bumps: 1 },
    ],
  },
  // Bogmaw the Bog Toad, of the Bog Fort in Misty Marsh: a huge warty toad.
  // He leaps a long way, spits balls of mud, and when he is very cross he
  // burps a cloud of swamp gas. His minions: giant mosquitoes, his friends.
  bogmaw: {
    icon: '🐸',
    name: 'Bogmaw the Bog Toad',
    body: { radius: 1.15, height: 1.6 },
    hearts: 1.2,
    bump: 1,
    run: [3, 3.8, 4.6],
    gap: [3600, 2900, 2300],
    minion: 'mosquito',
    moves: [
      { move: 'leap', from: 0, windup: 900, reach: 5, jump: 13, far: 15, bumps: 1.5 },
      { move: 'hurl', from: 0, windup: 800, what: 'mud', count: 3, reach: 2, ms: 1300, far: 18, bumps: 1 },
      { move: 'puff', from: 2, windup: 1000, what: 'gas', reach: 5, bumps: 1.5 },
    ],
  },
  // Moltok the Lava Golem, of the Fire Fort on Ember Mountain: a mountain of
  // black rock with lava glowing through its cracks. It breathes fire and
  // stomps, throws lava rocks when it is cross, and charges when it is very
  // cross. Its bumps are hot. Its minions: Lava Ghosts.
  moltok: {
    icon: '🌋',
    name: 'Moltok the Lava Golem',
    body: { radius: 1.1, height: 2.6 },
    hearts: 1.25,
    bump: 1.5,
    run: [2.8, 3.6, 4.4],
    gap: [3800, 3000, 2300],
    minion: 'ghost',
    moves: [
      { move: 'breath', from: 0, windup: 900, ms: 1200, reach: 7, angle: 0.45, bumps: 1.5 },
      { move: 'stomp', from: 0, windup: 900, reach: 6, jump: 10.5, bumps: 1.5 },
      { move: 'hurl', from: 1, windup: 900, what: 'lava', count: 3, reach: 2.2, ms: 1400, far: 20, bumps: 1.5 },
      { move: 'charge', from: 2, windup: 1100, speed: 11, far: 14, near: 3, bumps: 2 },
    ],
  },
  // Sir Scarabold, of the Sunken Pyramid in Sunscorch Dunes: a great golden
  // scarab beetle in polished armour, with a horn on his nose and a plume on
  // his helmet. He charges horn first, throws balls of sand that come down
  // round you, and when he is cross he flies up on his wings and comes down
  // on you. His minions: Spikies, as prickly as cactus.
  scarabold: {
    icon: '🪲',
    name: 'Sir Scarabold',
    body: { radius: 1.2, height: 1.7 },
    hearts: 1.15,
    bump: 1.5,
    run: [3.4, 4.2, 5],
    gap: [3500, 2800, 2200],
    minion: 'spiky',
    moves: [
      { move: 'charge', from: 0, windup: 1000, speed: 13, far: 16, near: 3, bumps: 1.5 },
      { move: 'hurl', from: 0, windup: 850, what: 'sandball', count: 2, scatter: 1, reach: 1.8, ms: 1300, far: 18, bumps: 1 },
      { move: 'leap', from: 1, windup: 850, reach: 4.5, jump: 12, far: 15, bumps: 1.5 },
      { move: 'stomp', from: 2, windup: 850, reach: 5, jump: 9.5, bumps: 1 },
    ],
  },
  // Old Glimmershell, of the Crystal Grotto in the Crystal Caverns: a tortoise
  // older than the isle, his shell grown all over with glowing crystals. Slow
  // on his feet, he stomps the cave floor so the crystals ring, throws
  // crystals from his back, and when he is cross pulls in his head and spins
  // along in his shell. His minions: giant spiders.
  glimmershell: {
    icon: '🐢',
    name: 'Old Glimmershell',
    body: { radius: 1.3, height: 1.9 },
    hearts: 1.3,
    bump: 1.5,
    run: [2.6, 3.4, 4.2],
    gap: [3400, 2700, 2100],
    minion: 'spider',
    moves: [
      { move: 'stomp', from: 0, windup: 900, reach: 6.5, jump: 9, bumps: 1.5 },
      { move: 'hurl', from: 0, windup: 900, what: 'crystal', count: 3, scatter: 1, reach: 2, ms: 1400, far: 20, bumps: 1 },
      { move: 'charge', from: 1, windup: 1100, speed: 12, far: 18, near: 3, bumps: 2 },
      { move: 'call', from: 2, windup: 900, kind: 'spider', count: 2, most: 1, far: 22 },
    ],
  },
  // Baron Boo, of Creaky Manor in Haunted Hollow: the grandest ghost on the
  // isle, in a top hat and a cape, a Star Shard for his monocle. He vanishes
  // and pops up somewhere else, throws grinning pumpkins and blows a cold mist
  // all round him; when he is cross he calls up Rattlebones to help. His
  // minions: Lava Ghosts, his little cousins.
  baronboo: {
    icon: '🎩',
    name: 'Baron Boo',
    body: { radius: 1.0, height: 2.4 },
    hearts: 1.35,
    bump: 1,
    run: [3.6, 4.4, 5.2],
    gap: [3200, 2600, 2000],
    minion: 'ghost',
    moves: [
      { move: 'hurl', from: 0, windup: 850, what: 'pumpkin', count: 3, reach: 2, ms: 1300, far: 18, bumps: 1 },
      { move: 'blink', from: 0, windup: 800, to: [5, 9], far: 40 },
      { move: 'puff', from: 1, windup: 1000, what: 'mist', reach: 5.5, bumps: 1.5 },
      { move: 'call', from: 2, windup: 900, kind: 'rattle', count: 1, most: 2, far: 24 },
    ],
  },
  // Big Sprocket, of Mainspring Hall in Cogwheel City: a wind-up tin giant as
  // tall as a house, a great key turning in his back. He stomps, throws gears
  // that rain down round you, blows a jet of steam from his funnel when he is
  // cross, and when his spring is wound right up he charges. His minions:
  // Grumble Knights, fresh off the line.
  sprocket: {
    icon: '🤖',
    name: 'Big Sprocket',
    body: { radius: 1.15, height: 2.7 },
    hearts: 1.4,
    bump: 1.5,
    run: [3.0, 3.9, 4.8],
    gap: [3000, 2400, 1900],
    minion: 'knight',
    moves: [
      { move: 'stomp', from: 0, windup: 850, reach: 6, jump: 10, bumps: 1.5 },
      { move: 'hurl', from: 0, windup: 850, what: 'gear', count: 3, scatter: 1, reach: 2, ms: 1300, far: 20, bumps: 1.5 },
      { move: 'breath', from: 1, windup: 900, what: 'steam', ms: 1300, reach: 7.5, angle: 0.5, bumps: 1.5 },
      { move: 'charge', from: 2, windup: 1000, speed: 14, far: 18, near: 3, bumps: 2 },
    ],
  },
  // Old Nimbus, of the Thunderhead Temple at the top of the Stormcloud Spires:
  // a great grumpy thundercloud with a face, never touching the ground. He
  // calls lightning down on red rings round you, blows a gale all round him,
  // drifts off and comes back somewhere else, and when he is very cross he
  // comes down on you like a hailstorm. His minions: giant mosquitoes.
  nimbus: {
    icon: '🌩️',
    name: 'Old Nimbus',
    body: { radius: 1.2, height: 2.5 },
    hearts: 1.45,
    bump: 1,
    run: [3.6, 4.4, 5.2],
    gap: [3000, 2400, 1900],
    minion: 'mosquito',
    moves: [
      { move: 'hurl', from: 0, windup: 900, what: 'bolt', count: 3, scatter: 2, reach: 2, ms: 1200, far: 22, bumps: 1.5 },
      { move: 'puff', from: 0, windup: 1000, what: 'gust', reach: 6, bumps: 1.5 },
      { move: 'blink', from: 1, windup: 800, to: [6, 10], far: 40 },
      { move: 'leap', from: 2, windup: 850, reach: 5, jump: 13, far: 16, bumps: 2 },
    ],
  },
  // King Grumble on Gloom Rock, at the end of the story: all his captains'
  // tricks. He stomps and throws grumble bombs, leaps at you when he is
  // cross, charges and calls his knights when he is very cross. His minions:
  // Spikies.
  king: {
    icon: '👑',
    name: 'King Grumble',
    body: KING_BODY,
    hearts: 1.6,
    bump: 1.5,
    run: [3.4, 4.2, 5],
    gap: [3200, 2500, 1900],
    minion: 'spiky',
    moves: [
      { move: 'stomp', from: 0, windup: STOMP.windup, reach: STOMP.reach, jump: 11, bumps: 1.5 },
      { move: 'hurl', from: 0, windup: 800, what: 'bomb', count: 3, scatter: 1, reach: 2.2, ms: 1300, far: 20, bumps: 1.5 },
      { move: 'leap', from: 1, windup: 800, reach: 5, jump: 13, far: 15, bumps: 1.5 },
      { move: 'charge', from: 2, windup: 1000, speed: 13, far: 16, near: 3, bumps: 2 },
      { move: 'call', from: 2, windup: 900, kind: 'knight', count: 2, most: 1, far: 24 },
    ],
  },
  // ------------------------------------------------ Episode 2: the rainbow
  // Lady Dotty, of the Rose Bower at the top of the Tulip Fields: a ladybird
  // as big as a cart, shiny red with black spots. She comes rolling at you,
  // flies up and comes down on you, throws strawberries when she is cross,
  // and stomps when she is crosser. Her minions: Spikies.
  dotty: {
    icon: '🐞',
    name: 'Lady Dotty',
    she: true,
    body: { radius: 1.2, height: 1.5 },
    hearts: 1.2,
    bump: 1.5,
    run: [3.4, 4.2, 5],
    gap: [3500, 2800, 2200],
    minion: 'spiky',
    moves: [
      { move: 'charge', from: 0, windup: 1000, speed: 13, far: 16, near: 3, bumps: 1.5 },
      { move: 'leap', from: 0, windup: 850, reach: 4.5, jump: 12, far: 15, bumps: 1.5 },
      { move: 'hurl', from: 1, windup: 850, what: 'berry', count: 3, scatter: 1, reach: 1.8, ms: 1300, far: 18, bumps: 1 },
      { move: 'stomp', from: 2, windup: 850, reach: 5, jump: 9.5, bumps: 1 },
    ],
  },
  // Duke Bushytail, of the Nut Hoard at the top of Maple Ridge: a squirrel as
  // tall as a shed, russet, with a tail bigger than he is and his cheeks full.
  // He never misses with an acorn, bounds onto you, scampers at you when he is
  // cross, and whistles up giant spiders when he is crosser. His minions: Mr.
  // Moles.
  bushytail: {
    icon: '🐿️',
    name: 'Duke Bushytail',
    body: { radius: 1.0, height: 2.5 },
    hearts: 1.25,
    bump: 1.5,
    run: [3.8, 4.6, 5.4],
    gap: [3400, 2700, 2100],
    minion: 'mole',
    moves: [
      { move: 'hurl', from: 0, windup: 800, what: 'acorn', count: 3, scatter: 1, reach: 1.9, ms: 1200, far: 20, bumps: 1 },
      { move: 'leap', from: 0, windup: 800, reach: 4.5, jump: 13, far: 16, bumps: 1.5 },
      { move: 'charge', from: 1, windup: 1000, speed: 14, far: 16, near: 3, bumps: 1.5 },
      { move: 'call', from: 2, windup: 900, kind: 'spider', count: 2, most: 1, far: 22 },
    ],
  },
  // Baroness Bumble, of the Golden Hive in the Honeycomb Hills: the biggest,
  // bossiest bee there ever was, in a little crown, never touching the
  // ground. She drops blobs of honey round you, comes at you sting first,
  // shakes off a cloud of pollen when she is cross, and calls her cousins the
  // giant mosquitoes when she is crosser. Her minions: giant mosquitoes.
  bumble: {
    icon: '🐝',
    name: 'Baroness Bumble',
    she: true,
    body: { radius: 1.15, height: 2.3 },
    hearts: 1.3,
    bump: 1.5,
    run: [3.6, 4.4, 5.2],
    gap: [3300, 2600, 2000],
    minion: 'mosquito',
    moves: [
      { move: 'hurl', from: 0, windup: 850, what: 'honey', count: 3, scatter: 2, reach: 2, ms: 1300, far: 20, bumps: 1 },
      { move: 'charge', from: 0, windup: 950, speed: 14, far: 16, near: 3, bumps: 2 },
      { move: 'puff', from: 1, windup: 1000, what: 'pollen', reach: 5.5, bumps: 1.5 },
      { move: 'call', from: 2, windup: 900, kind: 'mosquito', count: 3, most: 2, far: 24 },
    ],
  },
  // Sir Blendalot, of the Lost Temple in Tangle Jungle: a great chameleon
  // with a crest like a helmet, eyes that look two ways at once and a curly
  // tail, changing colour as he goes. He vanishes and pops up somewhere else,
  // throws bunches of bananas, scuttles at you when he is cross, and drops on
  // you out of the trees when he is crosser. His minions: giant spiders.
  blendalot: {
    icon: '🦎',
    name: 'Sir Blendalot',
    body: { radius: 1.15, height: 1.8 },
    hearts: 1.35,
    bump: 1.5,
    run: [3.4, 4.2, 5],
    gap: [3200, 2500, 1900],
    minion: 'spider',
    moves: [
      { move: 'blink', from: 0, windup: 800, to: [5, 9], far: 40 },
      { move: 'hurl', from: 0, windup: 850, what: 'banana', count: 3, scatter: 1, reach: 1.9, ms: 1300, far: 18, bumps: 1 },
      { move: 'charge', from: 1, windup: 950, speed: 14, far: 16, near: 3, bumps: 2 },
      { move: 'leap', from: 2, windup: 800, reach: 5, jump: 12, far: 15, bumps: 1.5 },
    ],
  },
  // Admiral Inkwell, of the Sunken Galleon in Bubble Lagoon: a great blue
  // octopus in an admiral's hat, an arm for every job. He squirts blobs of ink
  // that come down round you, slams his arms down all round him, lets go a
  // cloud of ink when he is cross, and jets at you when he is crosser. His
  // minions: Snappy Crabs.
  inkwell: {
    icon: '🐙',
    name: 'Admiral Inkwell',
    body: { radius: 1.25, height: 2.2 },
    hearts: 1.4,
    bump: 1.5,
    run: [3, 3.8, 4.6],
    gap: [3100, 2400, 1900],
    minion: 'snapper',
    moves: [
      { move: 'hurl', from: 0, windup: 850, what: 'ink', count: 3, scatter: 2, reach: 2, ms: 1300, far: 20, bumps: 1.5 },
      { move: 'stomp', from: 0, windup: 900, reach: 6.5, jump: 9.5, bumps: 1.5 },
      { move: 'puff', from: 1, windup: 1000, what: 'ink', reach: 6, bumps: 1.5 },
      { move: 'charge', from: 2, windup: 1000, speed: 14, far: 18, near: 3, bumps: 2 },
    ],
  },
  // Mochi the Moon Rabbit, of the Moon Mill on Moonbeam Moor: a great white
  // rabbit down from the moon, with a mallet as big as a barrel for pounding
  // rice cakes. He brings it down so the whole moor shakes, bounds a long way
  // onto you, throws rice cakes when he is cross, and calls the moor's ghosts
  // when he is crosser. His minions: Mr. Moles.
  mochi: {
    icon: '🐇',
    name: 'Mochi the Moon Rabbit',
    body: { radius: 1.05, height: 2.6 },
    hearts: 1.45,
    bump: 1.5,
    run: [3.8, 4.6, 5.4],
    gap: [3000, 2300, 1800],
    minion: 'mole',
    moves: [
      { move: 'stomp', from: 0, windup: 850, reach: 6.5, jump: 10.5, bumps: 1.5 },
      { move: 'leap', from: 0, windup: 800, reach: 5, jump: 14, far: 18, bumps: 2 },
      { move: 'hurl', from: 1, windup: 850, what: 'ricecake', count: 3, scatter: 2, reach: 2, ms: 1250, far: 20, bumps: 1.5 },
      { move: 'call', from: 2, windup: 900, kind: 'ghost', count: 2, most: 1, far: 24 },
    ],
  },
  // Queen Grizzle in Castle Drab, at the end of the second episode: King
  // Grumble's big sister, as grey as a rainy Monday, with all her helpers'
  // tricks and her great grey umbrella. She throws smudges of grey and stomps,
  // floats off under her umbrella and comes down somewhere else, shakes a
  // drizzle all round her when she is cross, and charges and calls her
  // brother's knights when she is very cross. Her minions: Grumble Knights.
  grizzle: {
    icon: '👸',
    name: 'Queen Grizzle',
    she: true,
    body: { radius: 1.0, height: 2.1 },
    hearts: 1.65,
    bump: 1.5,
    run: [3.4, 4.2, 5],
    gap: [3000, 2300, 1800],
    minion: 'knight',
    moves: [
      { move: 'hurl', from: 0, windup: 800, what: 'smudge', count: 3, scatter: 2, reach: 2.2, ms: 1300, far: 20, bumps: 1.5 },
      { move: 'stomp', from: 0, windup: 900, reach: 6, jump: 11, bumps: 1.5 },
      { move: 'blink', from: 1, windup: 800, to: [6, 10], far: 40 },
      { move: 'puff', from: 1, windup: 1000, what: 'drizzle', reach: 6, bumps: 1.5 },
      { move: 'charge', from: 2, windup: 1000, speed: 13, far: 16, near: 3, bumps: 2 },
      { move: 'call', from: 2, windup: 900, kind: 'knight', count: 2, most: 1, far: 24 },
    ],
  },
};

// Whether a monster kind is a boss.
export const isBoss = (kind) => Object.hasOwn(BOSSES, kind);

// How a boss of this kind fights, as its chapter has it. Null for a kind
// that is no boss.
export const planOf = (kind) => BOSSES[kind] ?? null;

// A boss's stomp (the first of its moves that is one), or null.
export const stompMove = (plan) => plan?.moves.find((m) => m.move === 'stomp') ?? null;

// A boss's breath of fire, or null.
export const breathMove = (plan) => plan?.moves.find((m) => m.move === 'breath') ?? null;
