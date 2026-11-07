// The beasts: ten mightier species of monster (monsters.js), each a creature
// of its own with moves of its own, the way a boss has them (bosses.js), each
// showing before it comes. Tier 1 are about as tough as a Stone Golem, tier 2
// three times that: they want a mighty weapon, or friends.
//
// - Rattlebones 💀, a pirate skeleton: it throws bones, and with its last heart
//   gone it falls apart into a heap. Bop the heap before it pulls itself back
//   together, or up it gets again.
// - Stingtail 🦂, a great scorpion in armour no one can land on: it lunges, and
//   when it is cross it flicks globs of venom from its tail.
// - Shadow Wolf 🐺: they hunt in twos, nearly as quick as you run. It pounces,
//   and when it is hurt it howls for another.
// - Thunderhawk 🦅: it soars out of reach, out of the sky calling lightning down
//   round you, and swoops to bump you, when you can bop it.
// - Mimic 🎁: a treasure chest, shut and still, until someone comes near. Then
//   it bites. It is full of coins.
// - Grumble Oak 🌳, a walking tree, very slow: its roots burst up out of the
//   ground under you, and it hates fire most of all.
// - Grumble Wizard 🧙: he rains falling stars round you, blinks away when he is
//   bopped, and calls blobs to help him.
// - Swamp Hydra 🐍, three heads: they breathe a wide cloud of venom and spit it
//   at you from afar.
// - Cyclops 👁️, one huge eye: it throws boulders from far off, and slams the
//   ground with its club.
// - Rumble Rex 🦖: it charges, stomps, and roars, and bumps harder than anything
//   else there is.
//
// As for a boss, a move comes in once it is cross enough, here by its hearts
// (rage 0, 1 at two thirds of them, 2 at a third), and comes sooner the crosser
// it is (gap, by rage). The numbers mean what they do in bosses.js, and:
//
//   call    it howls or chants, and most times over in all kind (count of them)
//           come to help: helpers, which never come back and never call more.
//   blink   it vanishes and comes back a way off from whoever it is after, as
//           far as to says.
//   hurl    scatter: this many more come down round each of those it is aimed
//           at, as far off as SCATTER. Where it comes from: a bolt or a star out
//           of the sky, a root up out of the ground (boss-fx.js).
//   daze    how long it sits dazed down from a stomp or a leap, or charging into
//           a wall (bosses: monsters.js DAZE_MS).
//
// walks: it walks, rather than getting about in hops. stagger: how much of a
// blow's knock it feels. notice: how near someone has to be for it to come after
// them, if not as near as for the others (monsters.js NOTICE). march: how fast
// along a tower defense road, marchHearts how many blobs' hearts it has there.
// weak: what does it double harm (shop.js keys, and 'fire' for a dragon's breath).
// coins: what popping one pays.
//
// Their tables are in the same terms as monsters.js KINDS, which takes them in.
export const SCATTER = 4;

export const BEASTS = {
  rattle: {
    icon: '💀',
    name: 'Rattlebones',
    tier: 1,
    body: { radius: 0.42, height: 1.55 },
    hearts: 8,
    bump: 2,
    land: 3,
    walks: true,
    stagger: 0.8,
    move: { walk: 1.7, run: 4.2, jump: 8 },
    cross: { walk: 1.7, run: 6, jump: 8 },
    march: 2.4,
    marchHearts: 2,
    weak: ['hammer'],
    coins: 2,
    // Its last heart gone, it lies in a heap this long, and any blow pops it for
    // good; left alone, up it gets again with this share of its hearts.
    rises: { ms: 4000, share: 0.5 },
    gap: [4200, 3400, 2600],
    moves: [{ move: 'hurl', from: 0, windup: 800, what: 'bone', count: 1, reach: 1.7, ms: 1000, near: 3, far: 13, bumps: 1 }],
  },
  stinger: {
    icon: '🦂',
    name: 'Stingtail',
    tier: 1,
    body: { radius: 0.72, height: 0.85 },
    hearts: 12,
    bump: 2,
    land: 0,
    walks: true,
    stagger: 0.55,
    move: { walk: 2, run: 4.4, jump: 8 },
    cross: { walk: 2, run: 6.2, jump: 8 },
    march: 2.2,
    marchHearts: 3,
    coins: 3,
    gap: [3800, 3000, 2300],
    moves: [
      { move: 'charge', from: 0, windup: 800, speed: 10.5, far: 9, near: 2.5, bumps: 2, daze: 1200 },
      { move: 'hurl', from: 1, windup: 800, what: 'venom', count: 2, reach: 1.9, ms: 1100, near: 3, far: 13, bumps: 1 },
    ],
  },
  wolf: {
    icon: '🐺',
    name: 'Shadow Wolf',
    tier: 1,
    body: { radius: 0.5, height: 1.05 },
    hearts: 10,
    bump: 2,
    land: 3,
    walks: true,
    stagger: 0.8,
    // Roaming, two come out together.
    pack: 2,
    move: { walk: 2.6, run: 5.4, jump: 9 },
    cross: { walk: 2.6, run: 6.7, jump: 9 },
    march: 3.6,
    marchHearts: 2,
    coins: 3,
    gap: [3400, 2800, 2200],
    moves: [
      { move: 'leap', from: 0, windup: 650, reach: 2.6, jump: 9.5, near: 3, far: 10, bumps: 2, daze: 700 },
      { move: 'call', from: 1, windup: 1000, kind: 'wolf', count: 1, most: 1, far: 30 },
    ],
  },
  hawk: {
    icon: '🦅',
    name: 'Thunderhawk',
    tier: 1,
    body: { radius: 0.6, height: 0.95 },
    hearts: 10,
    bump: 2,
    land: 0,
    stagger: 0.7,
    flies: true,
    notice: 15,
    // Up here it is out of reach; it comes down to low to bump you.
    hover: { high: 3.7, low: 1, up: 4.5 },
    move: { walk: 2.4, run: 5.2 },
    cross: { walk: 2.4, run: 6.6 },
    march: 3.4,
    marchHearts: 2,
    coins: 3,
    gap: [3600, 2900, 2300],
    moves: [{ move: 'hurl', from: 0, windup: 1000, what: 'bolt', count: 2, scatter: 2, reach: 2.1, ms: 1100, far: 16, bumps: 1.5 }],
  },
  mimic: {
    icon: '🎁',
    name: 'Mimic',
    tier: 1,
    body: { radius: 0.55, height: 0.85 },
    hearts: 14,
    bump: 2,
    land: 3,
    stagger: 0.7,
    // It sits shut until someone comes this near, in a camp too.
    shut: true,
    notice: 4.5,
    move: { walk: 1.8, run: 4.6, jump: 8 },
    cross: { walk: 1.8, run: 6.2, jump: 8 },
    march: 2.5,
    marchHearts: 2,
    coins: 15,
    gap: [3200, 2600, 2000],
    moves: [{ move: 'leap', from: 0, windup: 500, reach: 2.4, jump: 9, near: 2.5, far: 8, bumps: 2, daze: 900 }],
  },
  oak: {
    icon: '🌳',
    name: 'Grumble Oak',
    tier: 2,
    body: { radius: 0.95, height: 3 },
    hearts: 24,
    bump: 3,
    land: 0,
    walks: true,
    stagger: 0.2,
    move: { walk: 0.9, run: 1.9, jump: 7.5 },
    cross: { walk: 0.9, run: 3, jump: 7.5 },
    march: 1.3,
    marchHearts: 5,
    weak: ['lavablade', 'meteorstaff', 'fire'],
    coins: 6,
    gap: [3600, 3000, 2400],
    moves: [
      { move: 'hurl', from: 0, windup: 1000, what: 'root', count: 3, scatter: 2, reach: 1.9, ms: 950, far: 15, bumps: 1.5 },
      { move: 'stomp', from: 1, windup: 1100, reach: 4.5, jump: 6.5, bumps: 2, daze: 1500 },
    ],
  },
  wizard: {
    icon: '🧙',
    name: 'Grumble Wizard',
    tier: 2,
    body: { radius: 0.45, height: 1.75 },
    hearts: 16,
    bump: 1,
    land: 4,
    walks: true,
    stagger: 0.6,
    notice: 15,
    // Bopped, he is off a moment later.
    slips: 500,
    move: { walk: 1.4, run: 2.8, jump: 8 },
    cross: { walk: 1.4, run: 4.2, jump: 8 },
    march: 2,
    marchHearts: 3,
    coins: 8,
    gap: [3000, 2500, 2000],
    moves: [
      { move: 'hurl', from: 0, windup: 900, what: 'star', count: 3, scatter: 3, reach: 2, ms: 1150, far: 16, bumps: 1.5 },
      { move: 'blink', from: 0, windup: 650, to: [5, 8], far: 40 },
      { move: 'call', from: 1, windup: 900, kind: 'blob', count: 2, most: 2, far: 18 },
    ],
  },
  hydra: {
    icon: '🐍',
    name: 'Swamp Hydra',
    tier: 2,
    body: { radius: 1.1, height: 2.4 },
    hearts: 30,
    bump: 3,
    land: 0,
    walks: true,
    stagger: 0.2,
    move: { walk: 1.2, run: 2.6, jump: 8 },
    cross: { walk: 1.2, run: 4, jump: 8 },
    march: 1.5,
    marchHearts: 6,
    coins: 8,
    gap: [3400, 2800, 2200],
    moves: [
      { move: 'breath', from: 0, windup: 1000, ms: 1400, reach: 6.5, angle: 0.75, bumps: 1.5, what: 'venom' },
      { move: 'hurl', from: 1, windup: 900, what: 'venom', count: 3, scatter: 1, reach: 2, ms: 1200, near: 4, far: 16, bumps: 1.5 },
    ],
  },
  cyclops: {
    icon: '👁️',
    name: 'Cyclops',
    tier: 2,
    body: { radius: 1.05, height: 3.1 },
    hearts: 28,
    bump: 3,
    land: 0,
    walks: true,
    stagger: 0.15,
    notice: 16,
    move: { walk: 1.2, run: 2.8, jump: 8.5 },
    cross: { walk: 1.2, run: 4.4, jump: 8.5 },
    march: 1.5,
    marchHearts: 6,
    coins: 8,
    gap: [3800, 3000, 2300],
    moves: [
      { move: 'hurl', from: 0, windup: 1100, what: 'boulder', count: 2, reach: 2.6, ms: 1300, near: 4, far: 20, bumps: 2.5 },
      { move: 'stomp', from: 0, windup: 950, reach: 5, jump: 8.5, bumps: 2, daze: 1400 },
    ],
  },
  rex: {
    icon: '🦖',
    name: 'Rumble Rex',
    tier: 2,
    body: { radius: 1.15, height: 3 },
    hearts: 36,
    bump: 4,
    land: 0,
    walks: true,
    stagger: 0.12,
    move: { walk: 1.6, run: 3.6, jump: 9 },
    cross: { walk: 1.6, run: 5.4, jump: 9 },
    march: 1.8,
    marchHearts: 7,
    coins: 10,
    gap: [3600, 2900, 2200],
    moves: [
      { move: 'charge', from: 0, windup: 1200, speed: 12, far: 14, near: 3.5, bumps: 4, daze: 1800 },
      { move: 'stomp', from: 0, windup: 900, reach: 5.5, jump: 9.5, bumps: 2.5, daze: 1500 },
      { move: 'puff', from: 1, windup: 850, what: 'roar', reach: 7, bumps: 1 },
    ],
  },
};

export const isBeast = (kind) => Object.hasOwn(BEASTS, kind);
export const beastsOfTier = (tier) => Object.keys(BEASTS).filter((kind) => BEASTS[kind].tier === tier);
// How much harder than usual a blow of this (a shop.js key, or 'fire') lands on
// one of these.
export const weakTo = (kind, what) => (what && BEASTS[kind]?.weak?.includes(what) ? 2 : 1);
