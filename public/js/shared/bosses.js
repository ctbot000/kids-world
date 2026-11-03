// The bosses: whoever holds an adventure island's castle (adventure.js).
// On any adventure island that is King Grumble, who stomps. On Adventure
// Isle (isle-story.js) each chapter's lair is held by a boss of its own —
// one of King Grumble's six captains, each keeping a Star Shard for him —
// and King Grumble himself waits on Gloom Rock at the end of the story,
// knowing every one of his captains' tricks.
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

// His stomp on any adventure island: now and then, near whoever he is after,
// he crouches (long enough to see it coming, with a ring on the ground as
// far as it reaches), jumps straight up and lands with a thump that knocks
// over anyone on the ground that near; anyone in the air then is missed.
// Down from one, he sits dazed a moment: he bumps nobody, and a bop then
// takes DAZED_HIT hearts (monsters.js). every: how long from landing to the
// next, when he is not cross at all (gap, by rage, below).
export const STOMP = { every: 6500, windup: 900, reach: 6, jump: 10.5 };

// King Grumble on any adventure island: stomps, and only stomps, sooner
// the crosser he gets; at the last as quick as you walk, never as you run.
export const KING = {
  icon: '👑',
  name: 'King Grumble',
  hearts: 1,
  bump: 1,
  run: [3, 3.8, 4.6],
  gap: [6500, 4500, 3200],
  minion: 'blob',
  moves: [{ move: 'stomp', from: 0, windup: STOMP.windup, reach: STOMP.reach, jump: STOMP.jump, bumps: 1 }],
};

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
  // King Grumble on Gloom Rock, at the end of the story: all his captains'
  // tricks. He stomps and throws grumble bombs, leaps at you when he is
  // cross, and charges when he is very cross. His minions: Spikies.
  king: {
    icon: '👑',
    name: 'King Grumble',
    body: KING_BODY,
    hearts: 1.5,
    bump: 1,
    run: [3.4, 4.2, 5],
    gap: [3600, 2800, 2100],
    minion: 'spiky',
    moves: [
      { move: 'stomp', from: 0, windup: STOMP.windup, reach: STOMP.reach, jump: 11, bumps: 1.5 },
      { move: 'hurl', from: 0, windup: 800, what: 'bomb', count: 3, reach: 2.2, ms: 1300, far: 20, bumps: 1.5 },
      { move: 'leap', from: 1, windup: 800, reach: 5, jump: 13, far: 15, bumps: 1.5 },
      { move: 'charge', from: 2, windup: 1000, speed: 13, far: 16, near: 3, bumps: 2 },
    ],
  },
};

// Whether a monster kind is a boss.
export const isBoss = (kind) => Object.hasOwn(BOSSES, kind);

// How a boss of this kind fights: on Adventure Isle (isle) as its chapter
// has it, King Grumble anywhere else with his stomp alone. Null for a kind
// that is no boss.
export const planOf = (kind, isle = false) => (kind === 'king' && !isle ? KING : (BOSSES[kind] ?? null));

// A boss's stomp (the first of its moves that is one), or null.
export const stompMove = (plan) => plan?.moves.find((m) => m.move === 'stomp') ?? null;

// A boss's breath of fire, or null.
export const breathMove = (plan) => plan?.moves.find((m) => m.move === 'breath') ?? null;
