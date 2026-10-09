// The island's animal friends. The host moves them around; everyone else
// sees where they are a few times a second and fills in the motion between.
//
// Some of them fly. Birds flit between the treetops, the roofs and the grass,
// owls sleep in a treetop all day and come out at night, bees go from flower
// to flower, seagulls circle high over the shore, and butterflies flutter
// about. A flying friend given a fruit flies along with you, and sits on your
// head whenever you stand still.
//
// Others live in the sea: schools of fish, dolphins that leap out of it, a
// whale that blows water up out of its blowhole, an octopus on the sea floor,
// and turtles and crabs between the water and the beach. On snowy islands,
// penguins and seals live on the shore and dive into the sea.
//
// And some are big enough to ride: ponies, cows, an elephant and a giraffe,
// reindeer and polar bears on snowy islands, and unicorns on candy ones. They
// get about the way players do (physics.js), and someone riding one moves it
// themselves (riding.js); the dolphins and the whale take riders too.
//
// Vehicles (vehicle) live here too, as friends that never go anywhere by
// themselves: a car, a boat, a digger that tunnels through the ground and
// a mine cart that rolls along rails. They park where they were left, and
// someone driving one moves it the way a rider moves an animal.
import * as B from './blocks.js';
import { bodyOverlapsSolid, makeBody, pushOut, shove, stepBody, unstick } from './physics.js';
import { Rng } from './rng.js';

// New kinds go on the end: the wire sends the index.
export const CRITTER_TYPES = ['bunny', 'chick', 'sheep', 'duck', 'butterfly', 'bird', 'owl', 'bee', 'seagull', 'fish', 'dolphin', 'whale', 'turtle', 'crab', 'octopus', 'penguin', 'seal', 'pony', 'cow', 'elephant', 'giraffe', 'reindeer', 'polarbear', 'unicorn', 'car', 'boat', 'digger', 'minecart'];
// The sand of the beach and the sea floor, where crabs and turtles keep; and
// the cold shore of a snowy island, where penguins and seals do.
const SANDY = new Set([B.SAND, B.PEBBLES]);
const ICY = new Set([B.SNOW, B.ICE, B.SAND, B.PEBBLES, B.STONE]);
export const CRITTER_INFO = {
  bunny: { name: 'Bunny', icon: '🐰', speed: 2.4, swims: false, flies: false, names: ['Bun-Bun', 'Hoppy', 'Clover', 'Cotton', 'Nibbles', 'Snowball', 'Button', 'Biscuit', 'Mochi', 'Pudding'] },
  chick: { name: 'Chick', icon: '🐤', speed: 1.5, swims: false, flies: false, names: ['Peep', 'Sunny', 'Pip', 'Chirpy', 'Lemon', 'Buttercup', 'Goldie', 'Sprout', 'Honey', 'Popcorn'] },
  sheep: { name: 'Sheep', icon: '🐑', speed: 1.1, swims: false, flies: false, names: ['Fluffy', 'Woolly', 'Cloud', 'Marshmallow', 'Puff', 'Dolly', 'Snowy', 'Cuddles', 'Lamby', 'Cottonball'] },
  duck: { name: 'Duck', icon: '🦆', speed: 1.4, swims: true, flies: false, names: ['Quackers', 'Puddle', 'Waddles', 'Splash', 'Ducky', 'Bubbles', 'Paddle', 'Dotty', 'Pebble', 'Drizzle'] },
  butterfly: { name: 'Butterfly', icon: '🦋', speed: 1.9, swims: false, flies: true, names: ['Flutter', 'Twinkle', 'Petal', 'Blossom', 'Sparkle', 'Daisy', 'Rainbow', 'Dusty', 'Glitter', 'Breeze'] },
  bird: { name: 'Bird', icon: '🐦', speed: 4.2, swims: false, flies: true, names: ['Skye', 'Robin', 'Melody', 'Whistle', 'Feather', 'Kiwi', 'Pepper', 'Wren', 'Tilly', 'Dash'] },
  owl: { name: 'Owl', icon: '🦉', speed: 3.2, swims: false, flies: true, nocturnal: true, names: ['Hootie', 'Ollie', 'Luna', 'Starry', 'Moony', 'Professor', 'Twig', 'Nutmeg', 'Hazel', 'Pinecone'] },
  bee: { name: 'Bee', icon: '🐝', speed: 2.2, swims: false, flies: true, names: ['Buzzy', 'Bumble', 'Stripes', 'Nectar', 'Pollen', 'Fuzzy', 'Bizzy', 'Jellybean', 'Dot', 'Zippy'] },
  seagull: { name: 'Seagull', icon: '🕊️', speed: 5, swims: true, flies: true, names: ['Gully', 'Skipper', 'Captain', 'Sandy', 'Sailor', 'Coral', 'Splashy', 'Windy', 'Shelly', 'Marina'] },
  // sea: 'water' never leaves it; 'beach' and 'shore' walk the ground (the
  // sand, the cold shore) and float on the water, or wade along its bottom.
  // dives: goes under to swim about, too; climb: how high a step it can
  // take, up out of the water.
  fish: { name: 'Fish', icon: '🐠', speed: 2.2, swims: true, flies: false, sea: 'water', names: ['Finn', 'Splish', 'Glimmer', 'Wiggles', 'Guppy', 'Shimmer', 'Zigzag', 'Minnow', 'Sprinkle', 'Flash'] },
  // ride: how they take a rider (see under the list).
  dolphin: { name: 'Dolphin', icon: '🐬', speed: 4.5, swims: true, flies: false, sea: 'water', ride: { seat: 0.24, z: 0.05, spread: 0.55, radius: 0.45, sea: true, swim: 6, run: 9, float: 0.15, dive: 1.4, trick: 'leap' }, names: ['Echo', 'Bubbly', 'Leapy', 'Squeaky', 'Twirl', 'Zoom', 'Ripple', 'Surfy', 'Glider', 'Smiley'] },
  whale: { name: 'Whale', icon: '🐳', speed: 1.6, swims: true, flies: false, sea: 'water', ride: { seat: 0.56, z: -0.05, spread: 0.45, reach: 1.25, radius: 0.9, sea: true, swim: 3.5, run: 5, float: 0.26, dive: 1.2, trick: 'spout' }, names: ['Big Blue', 'Humphrey', 'Tiny', 'Rumble', 'Spouty', 'Waverly', 'Jumbo', 'Misty', 'Ocean', 'Puddles'] },
  turtle: { name: 'Turtle', icon: '🐢', speed: 0.8, swims: true, flies: false, sea: 'beach', ground: SANDY, range: [1.5, 5], names: ['Sheldon', 'Myrtle', 'Slowpoke', 'Pickle', 'Mossy', 'Tank', 'Bean', 'Kelp', 'Lagoon', 'Olive'] },
  crab: { name: 'Crab', icon: '🦀', speed: 1.3, swims: false, flies: false, sea: 'beach', ground: SANDY, home: 8, wades: true, sideways: true, range: [0.8, 2.5], names: ['Pinchy', 'Snappy', 'Clawdia', 'Sidney', 'Scuttle', 'Nipper', 'Clicky', 'Rusty', 'Tickles', 'Sideways'] },
  octopus: { name: 'Octopus', icon: '🐙', speed: 1.5, swims: true, flies: false, sea: 'water', names: ['Inky', 'Squiggle', 'Octavia', 'Wiggly', 'Noodle', 'Swirly', 'Bloop', 'Doodle', 'Hugs', 'Jelly'] },
  penguin: { name: 'Penguin', icon: '🐧', speed: 1.2, swims: true, flies: false, sea: 'shore', ground: ICY, home: 10, range: [1, 4], dives: true, climb: 1.3, swimSpeed: 3.6, slides: true, names: ['Tuxedo', 'Snowdrop', 'Frosty', 'Icicle', 'Wobble', 'Slider', 'Popsicle', 'Chilly', 'Sprinkles', 'Igloo'] },
  seal: { name: 'Seal', icon: '🦭', speed: 0.6, swims: true, flies: false, sea: 'shore', ground: ICY, home: 6, range: [0.8, 3], dives: true, climb: 1.3, swimSpeed: 3, names: ['Whiskers', 'Barkley', 'Sealia', 'Flappy', 'Clapper', 'Seabiscuit', 'Muffin', 'Lolly', 'Dumpling', 'Slippy'] },
  // Big animals (big), to ride. gallops: runs about now and then by itself;
  // paddles: goes into the water for a swim now and then.
  pony: { name: 'Pony', icon: '🐴', speed: 1.5, swims: true, flies: false, big: true, gallops: true, ride: { seat: 1.13, radius: 0.42, height: 2.3, float: 0.8, spread: 0.85, walk: 5.5, run: 9.5, swim: 3.5, jump: 10 }, names: ['Buttercup', 'Thunder', 'Daisy', 'Pepper', 'Maple', 'Toffee', 'Sparky', 'Gallop', 'Apple', 'Ginger'] },
  cow: { name: 'Cow', icon: '🐄', speed: 0.9, swims: true, flies: false, big: true, ride: { seat: 1.15, radius: 0.45, height: 2.35, float: 0.8, spread: 0.95, walk: 4, run: 6.5, swim: 3, jump: 8 }, names: ['Moomoo', 'Bessie', 'Clarabelle', 'Patches', 'Milkshake', 'Buttons', 'Dottie', 'Mabel', 'Marigold', 'Cocoa'] },
  elephant: { name: 'Elephant', icon: '🐘', speed: 0.9, swims: true, flies: false, big: true, paddles: true, ride: { seat: 1.72, z: -0.08, radius: 0.72, height: 2.9, float: 1.25, spread: 0.45, reach: 1.2, walk: 3.8, run: 6, swim: 3, jump: 7.6, trick: 'spray' }, names: ['Peanut', 'Ellie', 'Trunky', 'Rosie', 'Stomper', 'Squirt', 'Mumbo', 'Lulu', 'Gumbo', 'Hazelnut'] },
  giraffe: { name: 'Giraffe', icon: '🦒', speed: 1.2, swims: true, flies: false, big: true, ride: { seat: 1.66, z: -0.14, radius: 0.42, height: 2.95, float: 1.3, spread: 0.85, walk: 5, run: 8.5, swim: 2.5, jump: 8 }, names: ['Stretch', 'Spots', 'Tallulah', 'Skyler', 'Treetop', 'Zuri', 'Gigi', 'Lofty', 'Twiga', 'Polka'] },
  reindeer: { name: 'Reindeer', icon: '🦌', speed: 1.4, swims: true, flies: false, big: true, gallops: true, ride: { seat: 1.13, radius: 0.42, height: 2.3, float: 0.8, spread: 0.85, walk: 5.5, run: 9.5, swim: 3.5, jump: 11 }, names: ['Dasher', 'Dancer', 'Prancer', 'Comet', 'Cupid', 'Blitzen', 'Jingle', 'Holly', 'Snowflake', 'Aurora'] },
  polarbear: { name: 'Polar Bear', icon: '🐻‍❄️', speed: 1, swims: true, flies: false, big: true, paddles: true, ground: ICY, home: 10, ride: { seat: 1.05, radius: 0.46, height: 2.25, float: 0.75, spread: 1, walk: 4.5, run: 7.5, swim: 5, jump: 8.5 }, names: ['Nanook', 'Iceberg', 'Blizzard', 'Mitten', 'Snowdrift', 'Polo', 'Nuka', 'Glacier', 'Puffball', 'Yeti'] },
  unicorn: { name: 'Unicorn', icon: '🦄', speed: 1.6, swims: true, flies: false, big: true, gallops: true, ride: { seat: 1.21, radius: 0.44, height: 2.4, float: 0.85, spread: 0.85, walk: 6, run: 10.5, swim: 3.5, jump: 11.5 }, names: ['Stardust', 'Moonbeam', 'Candyfloss', 'Celeste', 'Dreamy', 'Sugarplum', 'Pixie', 'Starlight', 'Wish', 'Lullaby'] },
  // Vehicles (vehicle: 'land' or 'sea'), to drive. The car and the boat
  // honk instead of jumping; the digger digs through the ground it drives
  // into (ride.drill); the mine cart rolls along rails (ride.rails: its
  // speeds on them) and only creeps along off them.
  car: { name: 'Car', icon: '🚗', speed: 0, swims: true, flies: false, vehicle: 'land', ride: { seat: 0.5, z: -0.12, radius: 0.55, height: 1.75, float: 0.55, spread: 0.12, reach: 1.35, walk: 7, run: 12, swim: 2, jump: 8, trick: 'honk' }, names: ['Beep-Beep', 'Zoomy', 'Vroom', 'Cherry', 'Bumper', 'Speedy', 'Pip', 'Rosie', 'Turbo', 'Sunny'] },
  boat: { name: 'Boat', icon: '🚤', speed: 0, swims: true, flies: false, vehicle: 'sea', sea: 'water', ride: { seat: 0.3, z: -0.15, radius: 0.6, sea: true, swim: 6.5, run: 10, float: 0, dive: 0, spread: 0.12, reach: 1.35, trick: 'honk' }, names: ['Splashy', 'Bubbles', 'Captain', 'Wave Rider', 'Skipper', 'Puddle Jumper', 'Bobby', 'Sea Breeze', 'Toot-Toot', 'Marina'] },
  digger: { name: 'Digger', icon: '🚜', speed: 0, swims: true, flies: false, vehicle: 'land', ride: { drill: true, seat: 0.92, z: -0.22, radius: 0.6, height: 2.15, float: 0.75, spread: 0.15, reach: 1.3, walk: 3.5, run: 5, swim: 1.8, jump: 8.5 }, names: ['Rumbles', 'Scoop', 'Chomper', 'Drilly', 'Dusty', 'Rocky', 'Tunnel', 'Diggs', 'Muddy', 'Crunch'] },
  minecart: { name: 'Mine Cart', icon: '🚃', speed: 0, swims: true, flies: false, vehicle: 'land', ride: { seat: 0.32, radius: 0.42, height: 1.6, float: 0.5, spread: 0.12, reach: 1.35, walk: 1.8, run: 2.6, swim: 1.5, jump: 7.6, trick: 'honk', rails: { speed: 7, run: 11 } }, names: ['Clickety', 'Rattle', 'Nugget', 'Rusty', 'Clank', 'Rolly', 'Coal', 'Jingle', 'Choo-Choo', 'Pebble'] },
};
// Riding (ride, above): where the rider sits (seat: the top of its back, over
// its feet, or over its middle for a dolphin or the whale; z: how far that is
// in front of its middle), how far round it and forward the rider's legs
// reach (spread, reach: on a wide back they sit with their legs out in front),
// the box it and its rider fill (radius, height: see physics.js), the height
// over its feet that floats at the top of the water, and how fast it walks,
// runs, swims and jumps with a rider on (speed is how fast it ambles about
// by itself). A dolphin or the whale keeps to the top of the sea (float: how
// far under it its middle is) or dives (dive: how far down). trick: what the
// jump button does instead of jumping: a leap, a spout, or a spray from the
// trunk.
export const BIG = CRITTER_TYPES.filter((type) => CRITTER_INFO[type].big);
export const VEHICLES = CRITTER_TYPES.filter((type) => CRITTER_INFO[type].vehicle);
// The animals, without the vehicles.
export const ANIMAL_TYPES = CRITTER_TYPES.filter((type) => !CRITTER_INFO[type].vehicle);
// New states go on the end too.
export const STATES = ['idle', 'walk', 'hop', 'eat', 'happy', 'swim', 'fly', 'sleep', 'jump', 'spout', 'slide', 'dive', 'run'];
export const MAX_CRITTERS = 64;

// How many more animals a bigger island has than a cozy one (128 blocks
// across), side to side: a big one half as many again, a huge one twice.
const roomier = (world) => Math.max(1, Math.max(world.W, world.D) / 128);
export const maxCritters = (world) => Math.round(MAX_CRITTERS * roomier(world));
// How many random spots to try in looking for somewhere: more on a bigger island, by area.
const spots = (world, n) => Math.round(n * roomier(world) ** 2);
export function scaleCounts(counts, world) {
  const k = roomier(world);
  return Object.fromEntries(Object.entries(counts).map(([type, n]) => [type, Math.round(n * k)]));
}
// The room each animal on the ground takes up, for keeping things out of
// each other (see physics.js pushOut): a small one's own (radius, height),
// and a big one's or a vehicle's the box it gets about in. Flying friends
// and those that keep to the sea have none: they go over and under
// everyone. (The boat floats at the top of its water, its feet there.)
const SMALL_BOX = {
  bunny: [0.24, 0.55],
  chick: [0.15, 0.35],
  sheep: [0.38, 0.9],
  duck: [0.2, 0.5],
  turtle: [0.3, 0.4],
  crab: [0.2, 0.3],
  penguin: [0.24, 0.7],
  seal: [0.38, 0.5],
};
export function critterBox(type) {
  const info = CRITTER_INFO[type];
  if (!info || info.flies) return null;
  if (SMALL_BOX[type]) return { radius: SMALL_BOX[type][0], height: SMALL_BOX[type][1] };
  if (type === 'boat') return { radius: info.ride.radius, height: 1 };
  if (info.big || info.vehicle) return { radius: info.ride.radius, height: info.ride.height };
  return null;
}

const FOLLOW_MS = 60000;
const HAPPY_MS = 2200;

// What bees visit and butterflies rest on.
export const FLOWERS = new Set([B.TULIP, B.DAISY, B.BLUEBELL, B.COSMOS, B.SUNFLOWER, B.LOLLIPOP, B.GUMDROP]);

// How high above someone's feet a flying friend sits on their head: on top of
// the skull (render/avatar.js puts it at 1.41), or on the hat. A kid's hair
// (hair: its style; '' for an animal) is a little higher and lifts the hat
// with it, more for curls; spikes and a bun stick up out of it, unless a hat
// that covers the top of the head is over them. A grown-up (tall: how much
// taller than a kid) has all of it that much higher.
const HEAD_TOP = { cap: 1.6, party: 1.76, crown: 1.42, beanie: 1.7, sprout: 1.66, straw: 1.52, headphones: 1.6 };
const HAIR_TOP = { spiky: 1.51, curly: 1.53, bun: 1.57 };
const OVER_HAIR = ['cap', 'beanie', 'straw', 'party'];
export function headTop(hat, hair = '', tall = 0) {
  const top = HEAD_TOP[hat] ?? 1.41;
  if (!hair) return top + tall;
  return tall + Math.max(top + (hair === 'curly' ? 0.07 : 0.025), OVER_HAIR.includes(hat) ? 0 : (HAIR_TOP[hair] ?? 1.43));
}

// How high a rider's hips are over their feet, as render/avatar.js draws
// them, less a little for sinking into the saddle.
const HIPS = 0.25;

// Where someone riding an animal at (x, y, z, yaw) is: their feet, as
// everybody's are, with their hips on its back.
export function riderAt(type, m) {
  const r = CRITTER_INFO[type].ride;
  const z = r.z ?? 0;
  return { x: m.x + Math.sin(m.yaw) * z, y: m.y + r.seat - HIPS, z: m.z + Math.cos(m.yaw) * z, yaw: m.yaw };
}

// ...and the other way round: where the animal is, under its rider.
export function mountUnder(type, p) {
  const r = CRITTER_INFO[type].ride;
  const z = r.z ?? 0;
  return { x: p.x - Math.sin(p.yaw) * z, y: p.y - r.seat + HIPS, z: p.z - Math.cos(p.yaw) * z, yaw: p.yaw };
}

// How a friend following you flies round you: how far out, and how high.
const ORBIT = { bird: [1.15, 1.9], owl: [1.3, 2], bee: [0.75, 1.55], butterfly: [0.8, 1.6], seagull: [2.2, 2.9] };
// Small hops about on the ground, for birds and seagulls.
const HOP = { speed: 1.4, swims: false };
// Sitting on a flower is on top of its blossom, most of the way up its cell.
const ON_FLOWER = 0.86;

const FL = Math.floor;
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const wrap = (a) => a - Math.PI * 2 * Math.floor((a + Math.PI) / (Math.PI * 2));

// The water's surface, as it is drawn: 7/8 of the way up its top cell (render/mesher.js).
export const SURFACE = 0.875;
// The water each swimmer needs: how many cells deep, whether it has to be the
// sea (not a pond), and how far either side it must be water too.
const WATERS = {
  fish: { deep: 1 },
  octopus: { deep: 2 },
  dolphin: { deep: 3, sea: true, wide: 1 },
  whale: { deep: 4, sea: true, wide: 2 },
  penguin: { deep: 2 },
  seal: { deep: 2 },
  boat: { deep: 1 },
};
// Where in the water each one swims, from a column of it: [lowest, highest].
const BANDS = {
  fish: (w) => [w.floor + 1.25, w.top + SURFACE - 0.3],
  octopus: (w) => [w.floor + 1.02, w.top + SURFACE - 0.5],
  dolphin: (w) => [w.top + SURFACE - 1, w.top + SURFACE - 0.3],
  whale: (w) => [w.top + SURFACE - 0.3, w.top + SURFACE - 0.22],
  // Penguins and seals keep within a few blocks of the top.
  penguin: (w) => [Math.max(w.floor + 1.3, w.top + SURFACE - 3.5), w.top + SURFACE - 0.6],
  seal: (w) => [Math.max(w.floor + 1.3, w.top + SURFACE - 3.5), w.top + SURFACE - 0.6],
  // A boat's bottom at the top of the water.
  boat: (w) => [w.top + SURFACE, w.top + SURFACE],
};
// A penguin's leap out of the water on its way: [how far, how high, how long].
const PENGUIN_LEAP = [2.6, 0.9, 0.75];
// What to say when a swimmer is invited where there is no water for it.
export const NEEDS_WATER = {
  fish: 'Fish need water: tap a pond or the sea!',
  octopus: 'An octopus needs deeper water: tap the sea!',
  dolphin: 'Dolphins need the open sea: tap the water past the beach!',
  whale: 'A whale needs the deep sea, far out from the beach!',
  boat: 'A boat needs water: tap a pond or the sea!',
};

// The first thing under the open sky in a column: the ground, a roof, a
// treetop or water. -1 off the island.
export function skyline(world, x, z) {
  const cx = FL(x);
  const cz = FL(z);
  if (cx < 0 || cz < 0 || cx >= world.W || cz >= world.D) return -1;
  for (let y = world.H - 1; y >= 0; y--) {
    const id = world.get(cx, y, cz);
    if (B.SOLID[id] || id === B.WATER) return y;
  }
  return -1;
}

// The water at the top of a column: its highest water cell (top) and the
// block under its lowest one (floor), or null where the column does not open
// onto water.
export function waterColumn(world, x, z) {
  const s = skyline(world, x, z);
  const cx = FL(x);
  const cz = FL(z);
  if (s < 0 || world.get(cx, s, cz) !== B.WATER) return null;
  let y = s;
  while (y > 0 && world.get(cx, y - 1, cz) === B.WATER) y--;
  return { top: s, floor: y - 1 };
}

// The water column at (x, z) if a swimmer that needs this can be there.
function waterFor(world, x, z, need) {
  const w = waterColumn(world, x, z);
  if (!w || w.top - w.floor < need.deep || (need.sea && w.top !== world.sea)) return null;
  for (const [ox, oz] of need.wide ? [[need.wide, 0], [-need.wide, 0], [0, need.wide], [0, -need.wide]] : []) {
    const v = waterColumn(world, x + ox, z + oz);
    if (!v || v.top - v.floor < need.deep - 1) return null;
  }
  return w;
}

// Whether a swimmer of this kind can be in the water at (x, z).
export function swimmable(world, type, x, z) {
  return Boolean(waterFor(world, x, z, WATERS[type]));
}

// A leap out of the water, from (x, z) on ahead the way yaw faces: if there
// is room in the air for one, and water for this kind to come down into, the
// arc's start, way, length, height and time; otherwise null.
export function leapFrom(world, type, x, z, yaw, [len, h, T] = [5.5, 2, 1.35]) {
  const w = waterColumn(world, x, z);
  if (!w) return null;
  const fx = Math.sin(yaw);
  const fz = Math.cos(yaw);
  const land = waterFor(world, x + fx * len, z + fz * len, WATERS[type]);
  if (!land || land.top !== w.top) return null;
  const y = w.top + SURFACE - 0.35;
  for (let i = 1; i < 12; i++) {
    const k = i / 12;
    const id = world.get(FL(x + fx * len * k), FL(y + 4 * h * k * (1 - k)), FL(z + fz * len * k));
    if (id !== B.AIR && id !== B.WATER) return null;
  }
  return { t: 0, T, x, y, z, fx, fz, len, h };
}

// The nearest spot to (x, z), within r, where a swimmer of this kind can
// live: { x, y, z }, or null. It looks in squares further and further out,
// until they are further out than the nearest one found.
export function nearestWater(world, type, x, z, r = 12) {
  const cx = FL(x);
  const cz = FL(z);
  let best = null;
  for (let ring = 0; ring <= r && !(best && ring > best.d); ring++) {
    for (let dx = -ring; dx <= ring; dx++) {
      for (let dz = -ring; dz <= ring; dz++) {
        if (Math.max(Math.abs(dx), Math.abs(dz)) !== ring) continue;
        const d = Math.hypot(dx, dz);
        if (best && d >= best.d) continue;
        const w = waterFor(world, cx + dx + 0.5, cz + dz + 0.5, WATERS[type]);
        if (!w) continue;
        const [lo, hi] = BANDS[type](w);
        best = { x: cx + dx + 0.5, y: (lo + hi) / 2, z: cz + dz + 0.5, d };
      }
    }
  }
  return best && { x: best.x, y: best.y, z: best.z };
}

// Where a flying friend would sit at the top of a column: { x, y, z, kind,
// flower, ground }, or null. kind is tree, ground (grass, sand, snow...),
// block (anything built) or water, which a seagull floats on.
export function perchAt(world, x, z) {
  const cx = FL(x);
  const cz = FL(z);
  if (cx < 1 || cz < 1 || cx > world.W - 2 || cz > world.D - 2) return null;
  const s = skyline(world, cx, cz);
  if (s < 0 || s >= world.H - 1) return null;
  const id = world.get(cx, s, cz);
  const above = world.get(cx, s + 1, cz);
  if (above !== B.AIR && B.KIND[above] !== B.K_PLANT) return null;
  const kind = id === B.WATER ? 'water' : B.TREE_PART[id] ? 'tree' : B.TERRAIN[id] ? 'ground' : 'block';
  return { x: cx + 0.5, y: kind === 'water' ? s + 0.85 : s + 1, z: cz + 0.5, kind, flower: FLOWERS.has(above), ground: id };
}

// Something built over a friend's head (leaves don't count): it stays indoors.
function roofed(world, c) {
  const x = FL(c.x);
  const z = FL(c.z);
  for (let y = FL(c.y) + 1; y <= FL(c.y) + 8; y++) {
    const id = world.get(x, y, z);
    if (B.SOLID[id] && !B.TREE_PART[id]) return true;
  }
  return false;
}

// How many of each newer flying friend an island starts with.
export function flyerCounts(theme) {
  return theme === 'snowy' ? { bird: 3, owl: 2, seagull: 2 } : { bird: 3, owl: 1, bee: 3, seagull: 2 };
}

const isShore = (world, p) => p.kind === 'ground' && p.ground === B.SAND && p.y <= world.sea + 3;

// Where they start out: birds and owls up in the trees, bees at the flowers,
// seagulls on the beach or out on the water.
export function placeFlyers(world, rng, counts = scaleCounts(flyerCounts(world.theme), world)) {
  const places = {
    bird: [(p) => p.kind === 'tree', (p) => p.kind !== 'water'],
    owl: [(p) => p.kind === 'tree', (p) => p.kind !== 'water'],
    bee: [(p) => p.flower, (p) => p.kind === 'ground'],
    seagull: [(p) => isShore(world, p), (p) => p.kind === 'water'],
  };
  const find = (test) => {
    for (let tries = 0; tries < spots(world, 800); tries++) {
      const p = perchAt(world, rng.int(2, world.W - 3) + 0.5, rng.int(2, world.D - 3) + 0.5);
      if (p && test(p)) return p;
    }
    return null;
  };
  const out = [];
  for (const [type, n] of Object.entries(counts)) {
    for (let i = 0; i < n; i++) {
      let p = null;
      for (const test of places[type] ?? []) if ((p = find(test))) break;
      if (p) out.push({ type, x: p.x, y: p.y, z: p.z });
    }
  }
  return out;
}

// How many sea creatures an island starts with: no turtles in the snow.
export function seaCounts(theme) {
  if (theme === 'snowy') return { fish: 3, dolphin: 2, whale: 1, crab: 2, octopus: 1 };
  // Flat Land's sea is a narrow moat, with no beach.
  if (theme === 'flat') return { fish: 3, turtle: 1, octopus: 1 };
  return { fish: 4, dolphin: 2, whale: 1, turtle: 2, crab: 3, octopus: 1 };
}

// Where they start out: fish and the octopus in the shallows (or a pond),
// dolphins and the whale out at sea, crabs and turtles on the beach.
export function placeSea(world, rng, counts = scaleCounts(seaCounts(world.theme), world)) {
  const out = [];
  for (const [type, n] of Object.entries(counts)) {
    for (let i = 0; i < n; i++) {
      for (let tries = 0; tries < spots(world, 800); tries++) {
        const x = rng.int(2, world.W - 3) + 0.5;
        const z = rng.int(2, world.D - 3) + 0.5;
        let y = null;
        if (CRITTER_INFO[type].sea === 'beach') {
          const p = perchAt(world, x, z);
          const w = waterColumn(world, x, z);
          if (p && isShore(world, p)) y = p.y;
          // With no beach to be found (Flat Land's sea has none), the shallows will do.
          else if (tries >= spots(world, 400) && w && w.top - w.floor <= 3 && SANDY.has(world.get(FL(x), w.floor, FL(z)))) y = type === 'crab' ? w.floor + 1 : w.top + 0.75;
        } else {
          const w = waterFor(world, x, z, WATERS[type]);
          if (w && (type === 'dolphin' || type === 'whale' || w.top - w.floor <= 5)) {
            const [lo, hi] = BANDS[type](w);
            y = (lo + hi) / 2;
          }
        }
        if (y === null) continue;
        out.push({ type, x, y, z });
        break;
      }
    }
  }
  return out;
}

// How many penguins and seals an island starts with: only snowy ones have them.
export function polarCounts(theme) {
  return theme === 'snowy' ? { penguin: 5, seal: 3 } : {};
}

// Somewhere on the cold shore: icy ground a step or so up from the sea, with
// the sea right there, to dive into and climb back out of.
function onShore(world, p) {
  if (!p || p.kind !== 'ground' || !ICY.has(p.ground) || p.y > world.sea + 2) return false;
  for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++) if (waterColumn(world, p.x + dx, p.z + dz)?.top === world.sea) return true;
  return false;
}

// Where they start out: the penguins together, as a little colony, and the
// seals here and there along the shore.
export function placePolar(world, rng, counts = scaleCounts(polarCounts(world.theme), world)) {
  const out = [];
  const random = () => perchAt(world, rng.int(2, world.W - 3) + 0.5, rng.int(2, world.D - 3) + 0.5);
  for (const [type, n] of Object.entries(counts)) {
    let colony = null;
    for (let i = 0; i < n; i++) {
      for (let tries = 0; tries < spots(world, 800); tries++) {
        // Beside the others, or, with no room left there, a new group of them.
        const near = type === 'penguin' && colony && tries < 300;
        const p = near ? perchAt(world, colony.x + rng.int(-3, 3), colony.z + rng.int(-3, 3)) : random();
        if (!onShore(world, p) || out.some((o) => Math.hypot(o.x - p.x, o.z - p.z) < 0.5)) continue;
        if (!near) colony = p;
        out.push({ type, x: p.x, y: p.y, z: p.z });
        break;
      }
    }
  }
  return out;
}

// How many big animals an island starts with: ponies, cows, an elephant and a
// giraffe; reindeer and polar bears in the snow; unicorns on candy islands.
export function bigCounts(theme) {
  if (theme === 'snowy') return { reindeer: 3, polarbear: 2 };
  if (theme === 'candy') return { unicorn: 3, pony: 1 };
  if (theme === 'flat') return { pony: 2, cow: 2 };
  return { pony: 2, cow: 2, elephant: 1, giraffe: 1 };
}

// Whether a big animal, with a rider on, fits standing at (x, y, z).
export function fits(world, type, x, y, z) {
  const r = CRITTER_INFO[type].ride;
  const b = { x, y, z, radius: r.radius, height: r.height };
  return !bodyOverlapsSolid(world, b) && bodyOverlapsSolid(world, { ...b, y: y - 0.05, height: 0.05 });
}

// Where they start out: out in the open on dry land, with room about them,
// away from where everyone comes in; polar bears on the cold shore.
export function placeBig(world, rng, counts = scaleCounts(bigCounts(world.theme), world)) {
  const out = [];
  const spawn = world.spawn;
  for (const [type, n] of Object.entries(counts)) {
    for (let i = 0; i < n; i++) {
      for (let tries = 0; tries < spots(world, 800); tries++) {
        const p = perchAt(world, rng.int(3, world.W - 4) + 0.5, rng.int(3, world.D - 4) + 0.5);
        if (!p || (type === 'polarbear' ? !onShore(world, p) : p.kind !== 'ground' || p.ground === B.SAND || p.y <= world.sea + 1)) continue;
        if (Math.hypot(p.x - spawn.x, p.z - spawn.z) < 10 || out.some((o) => Math.hypot(o.x - p.x, o.z - p.z) < 3)) continue;
        if (!fits(world, type, p.x, p.y, p.z)) continue;
        out.push({ type, x: p.x, y: p.y, z: p.z });
        break;
      }
    }
  }
  return out;
}

// The nearest spot to (x, z), within r and near the height y, where a big
// animal fits standing: { x, y, z }, or null.
export function roomFor(world, type, x, y, z, r = 4) {
  const cx = FL(x);
  const cz = FL(z);
  let best = null;
  for (let ring = 0; ring <= r && !(best && ring > best.d); ring++) {
    for (let dx = -ring; dx <= ring; dx++) {
      for (let dz = -ring; dz <= ring; dz++) {
        if (Math.max(Math.abs(dx), Math.abs(dz)) !== ring) continue;
        const d = Math.hypot(dx, dz);
        if (best && d >= best.d) continue;
        const px = cx + dx + 0.5;
        const pz = cz + dz + 0.5;
        const py = standHeight(world, px, pz, y);
        if (py !== null && fits(world, type, px, py, pz)) best = { x: px, y: py, z: pz, d };
      }
    }
  }
  return best && { x: best.x, y: best.y, z: best.z };
}

// ("an elephant", "a unicorn")
export const needsRoom = (type) => `There is no room for ${/^(?!uni)[aeiou]/i.test(CRITTER_INFO[type].name) ? 'an' : 'a'} ${CRITTER_INFO[type].name.toLowerCase()} here. Try somewhere more open!`;

// Where a small animal standing near (x, y, z) would have its feet, or null.
export function standHeight(world, x, z, y) {
  const cx = Math.floor(x);
  const cz = Math.floor(z);
  if (cx < 0 || cz < 0 || cx >= world.W || cz >= world.D) return null;
  const from = Math.min(world.H - 1, Math.floor(y + 1.5));
  for (let yy = from; yy >= Math.max(1, Math.floor(y) - 4); yy--) {
    if (B.SOLID[world.get(cx, yy - 1, cz)] && !B.SOLID[world.get(cx, yy, cz)]) return yy;
  }
  return null;
}

// Rails: whether a mine cart at (x, y, z) is on them (sitting on a rail, or
// on the way up or down a slope of them).
export function onRails(world, x, y, z) {
  const cx = FL(x);
  const cz = FL(z);
  const cy = FL(y + 0.05);
  return world.get(cx, cy, cz) === B.RAIL || world.get(cx, cy - 1, cz) === B.RAIL;
}

// Where an island's vehicles start out: a car out in the open a little way
// from where everyone comes in, a boat on the water by the shore nearest to
// it, and a digger by the way into the first mine (or, with no mines, near
// the car); and a mine cart on the rails just inside each mine's doorway.
// mines: as worldgen.js digs them, each with where its cart and its digger go.
export function placeVehicles(world, rng, mines = []) {
  const out = [];
  const spawn = world.spawn;
  const taken = (x, z, d) => out.some((o) => Math.hypot(o.x - x, o.z - z) < d);
  const open = (type, near) => {
    for (let tries = 0; tries < spots(world, 600); tries++) {
      const a = rng.next() * Math.PI * 2;
      const d = rng.range(near[0], near[1]);
      const p = perchAt(world, spawn.x + Math.cos(a) * d, spawn.z + Math.sin(a) * d);
      if (!p || p.kind !== 'ground' || p.y <= world.sea + 1 || taken(p.x, p.z, 3) || !fits(world, type, p.x, p.y, p.z)) continue;
      return { type, x: p.x, y: p.y, z: p.z, yaw: Math.atan2(spawn.x - p.x, spawn.z - p.z) };
    }
    return null;
  };
  const car = open('car', [5, 14]) ?? open('car', [5, 40]);
  if (car) out.push(car);
  // The boat: the water by the shore nearest to where everyone comes in.
  let boat = null;
  for (let tries = 0; tries < spots(world, 1500); tries++) {
    const x = rng.int(2, world.W - 3) + 0.5;
    const z = rng.int(2, world.D - 3) + 0.5;
    const w = waterFor(world, x, z, WATERS.boat);
    if (!w || w.top !== world.sea) continue;
    let shore = null;
    for (const [dx, dz] of [[2, 0], [-2, 0], [0, 2], [0, -2]]) if (!waterColumn(world, x + dx, z + dz) && skyline(world, x + dx, z + dz) >= 0) shore = [dx, dz];
    if (!shore) continue;
    const d = Math.hypot(x - spawn.x, z - spawn.z);
    if (!boat || d < boat.d) boat = { type: 'boat', x, y: w.top + SURFACE, z, yaw: Math.atan2(-shore[0], -shore[1]), d };
  }
  if (boat) {
    delete boat.d;
    out.push(boat);
  }
  const mine = mines.find((m) => m.digger);
  const spot = mine && roomFor(world, 'digger', mine.digger.x, mine.digger.y, mine.digger.z, 3);
  const digger = spot && !taken(spot.x, spot.z, 2) ? { type: 'digger', ...spot, yaw: mine.digger.yaw } : open('digger', [6, 20]) ?? open('digger', [6, 40]);
  if (digger) out.push(digger);
  for (const m of mines) if (m.cart) out.push({ type: 'minecart', ...m.cart });
  return out;
}

export class CritterSim {
  constructor(seed = 1) {
    this.rng = new Rng(seed);
    // The big animals' own dice: how many of them there are changes nothing
    // about what the others do.
    this.bigRng = new Rng((seed ^ 0x2c1b3c6d) >>> 0 || 1);
    // ...and the vehicles theirs.
    this.vehicleRng = new Rng((seed ^ 0x68e31da4) >>> 0 || 1);
    this.list = [];
    this.nextId = 1;
    // A bigger island has room for more (see maxCritters).
    this.max = MAX_CRITTERS;
  }

  add(type, x, y, z, name = null, yaw = null) {
    if (!CRITTER_INFO[type] || this.list.length >= this.max) return null;
    const info = CRITTER_INFO[type];
    const rng = info.vehicle ? this.vehicleRng : info.big ? this.bigRng : this.rng;
    const c = {
      id: this.nextId++,
      type,
      name: name && info.names.includes(name) ? name : rng.pick(info.names),
      x,
      y,
      z,
      yaw: Number.isFinite(yaw) ? yaw : rng.next() * Math.PI * 2,
      state: 'idle',
      timer: rng.range(0.5, 3),
      tx: x,
      tz: z,
      ty: y,
      vy: 0,
      follow: 0,
      followUntil: 0,
      happyUntil: 0,
      home: { x, z },
      // Flying friends: perch, fly (somewhere), hover, or soar (seagulls).
      mode: 'perch',
      perch: '',
      onHead: 0,
      still: 0,
      // Who is riding it (a big animal, a dolphin or the whale).
      rider: 0,
    };
    this.list.push(c);
    return c;
  }

  remove(id) {
    const i = this.list.findIndex((c) => c.id === id);
    if (i < 0) return null;
    return this.list.splice(i, 1)[0];
  }

  get(id) {
    return this.list.find((c) => c.id === id) ?? null;
  }

  pet(id, player, now) {
    const c = this.get(id);
    if (!c) return null;
    c.happyUntil = now + HAPPY_MS;
    c.state = 'happy';
    if (player && !c.onHead) c.yaw = Math.atan2(player.x - c.x, player.z - c.z);
    return c;
  }

  feed(id, pid, player, now) {
    const c = this.pet(id, player, now);
    // A vehicle has no use for fruit.
    if (!c || CRITTER_INFO[c.type].vehicle) return c;
    c.follow = pid;
    c.followUntil = now + FOLLOW_MS;
    return c;
  }

  // players: Map of pid -> { x, y, z, yaw, anim, flying, hat, hair } for who is here.
  step(world, dt, now, players, night = false) {
    for (const c of this.list) this.stepOne(world, c, dt, now, players, night);
  }

  stepOne(world, c, dt, now, players, night) {
    const info = CRITTER_INFO[c.type];
    if (c.rider) {
      const rider = players.get(c.rider);
      if (rider) {
        this.carry(world, c, rider, dt);
        return;
      }
      this.letGo(c);
    }
    if (info.vehicle) {
      this.stepVehicle(world, c, dt, now);
      return;
    }
    if (c.follow && (c.followUntil < now || !players.has(c.follow))) c.follow = 0;
    const leader = c.follow ? players.get(c.follow) : null;
    if (info.big) {
      this.stepBig(world, c, dt, now, leader, night);
      return;
    }
    // Anyone who got built into a wall pops out on top. (A flying friend on
    // its way somewhere keeps clear by itself.)
    if ((!info.flies || c.mode === 'perch') && B.SOLID[world.get(Math.floor(c.x), Math.floor(c.y + 0.2), Math.floor(c.z))]) {
      const top = world.top(Math.floor(c.x), Math.floor(c.z));
      c.y = top + 1;
    }
    if (c.happyUntil > now) {
      c.state = 'happy';
      return;
    }

    if (info.flies) {
      this.stepFlyer(world, c, dt, leader, night);
      return;
    }
    if (info.sea === 'water') {
      this.stepSwimmer(world, c, dt, leader, night);
      return;
    }
    // Penguins and seals under the water, until they come back up.
    if (c.dive) {
      if (!leader) {
        this.underwater(world, c, dt, night);
        return;
      }
      this.endDive(c);
    }

    if (night && !leader) {
      const afloat = world.get(Math.floor(c.x), Math.floor(c.y), Math.floor(c.z)) === B.WATER;
      // Penguins and seals come ashore to sleep: across the water to the
      // nearest place they can climb out, a stretch at a time.
      if (afloat && info.dives) {
        const onTheWay = c.ashore && c.ashore.x === c.tx && c.ashore.z === c.tz;
        if (!onTheWay || Math.hypot(c.tx - c.x, c.tz - c.z) < 0.15) {
          c.ashore = this.wayAshore(world, c);
          if (c.ashore) [c.tx, c.tz] = [c.ashore.x, c.ashore.z];
          else this.pickTarget(world, c, true);
        }
        this.walk(world, c, dt, info, null);
        // Blocked: another way next time.
        if (c.state === 'idle') c.ashore = null;
        c.state = 'swim';
        return;
      }
      c.state = afloat && info.swims ? 'swim' : 'sleep';
      this.fall(world, c, dt);
      return;
    }

    c.timer -= dt;
    if (leader) {
      const d = Math.hypot(leader.x - c.x, leader.z - c.z);
      if (d > 2.2) {
        c.tx = leader.x;
        c.tz = leader.z;
        c.timer = 1;
        if (c.state === 'idle' || c.state === 'eat') c.state = 'walk';
      } else {
        c.state = 'idle';
        c.yaw = Math.atan2(leader.x - c.x, leader.z - c.z);
      }
    } else if (c.timer <= 0) {
      if (info.dives && world.get(Math.floor(c.x), Math.floor(c.y), Math.floor(c.z)) === B.WATER) {
        // In the water, a penguin or a seal goes under for a swim, or, back
        // up from one, swims ashore.
        if (!c.surfaced && this.rng.chance(0.6) && this.startDive(world, c)) return;
        c.surfaced = false;
        this.pickTarget(world, c, true);
        c.state = 'swim';
        c.timer = this.rng.range(4, 8);
      } else if (c.state === 'walk' || c.state === 'hop' || c.state === 'swim' || c.state === 'slide') {
        c.state = this.rng.chance(0.4) ? 'eat' : 'idle';
        c.timer = this.rng.range(1.5, 4);
      } else {
        this.pickTarget(world, c);
        c.state = c.type === 'bunny' ? 'hop' : 'walk';
        // A penguin on snow or ice now and then goes on its tummy instead.
        const under = world.get(Math.floor(c.tx), (standHeight(world, c.tx, c.tz, c.y) ?? 0) - 1, Math.floor(c.tz));
        if (info.slides && (under === B.SNOW || under === B.ICE) && this.rng.chance(0.6)) c.state = 'slide';
        c.timer = this.rng.range(3, 6);
      }
    }

    if (c.state === 'walk' || c.state === 'hop' || c.state === 'swim' || c.state === 'slide') this.walk(world, c, dt, info, leader);
    else this.fall(world, c, dt);
    // Afloat, a penguin or a seal is swimming whatever it was doing.
    if (info.dives && c.state !== 'happy' && world.get(Math.floor(c.x), Math.floor(c.y), Math.floor(c.z)) === B.WATER) c.state = 'swim';
  }

  // Where each animal stands, for keeping things out of it: a box with a
  // key (see physics.js pushOut). Not one under the water, nor one in the
  // air in a leap.
  boxes() {
    const out = [];
    for (const c of this.list) {
      const box = critterBox(c.type);
      if (box && !c.dive && !c.leap) out.push({ x: c.x, y: c.y, z: c.z, ...box, key: `c${c.id}`, c });
    }
    return out;
  }

  // Animals that walked into someone, or into each other, step back out
  // (people: boxes of who is here, players and monsters, each with a key).
  // Those being ridden go where their rider takes them, and parked vehicles
  // stay put: everything else steps round them.
  keepApart(world, people) {
    const boxes = this.boxes();
    const all = [...people, ...boxes];
    for (const box of boxes) {
      const c = box.c;
      const info = CRITTER_INFO[c.type];
      if (c.rider || info.vehicle) continue;
      const { dx, dz } = pushOut(box, all.filter((o) => o !== box), box.key);
      if (!dx && !dz) continue;
      if (info.big) {
        const b = this.bodyOf(world, c);
        shove(world, b, dx, dz);
        [c.x, c.z] = [b.x, b.z];
      } else {
        this.nudge(world, c, dx, dz);
      }
      [box.x, box.z] = [c.x, c.z];
    }
  }

  // A small animal pushed aside: as far as it could walk there, no further
  // up or down than a little step (or along the water, for a swimmer
  // afloat), or along one way only if not both.
  nudge(world, c, dx, dz) {
    const info = CRITTER_INFO[c.type];
    const afloat = world.get(FL(c.x), FL(c.y), FL(c.z)) === B.WATER;
    for (const [mx, mz] of [[dx, dz], [dx, 0], [0, dz]]) {
      if (!mx && !mz) continue;
      const nx = c.x + mx;
      const nz = c.z + mz;
      if (nx < 0.3 || nz < 0.3 || nx > world.W - 0.3 || nz > world.D - 0.3) continue;
      if (afloat) {
        if (world.get(FL(nx), FL(c.y), FL(nz)) !== B.WATER || B.SOLID[world.get(FL(nx), FL(c.y) + 1, FL(nz))]) continue;
        [c.x, c.z] = [nx, nz];
        return true;
      }
      const ny = standHeight(world, nx, nz, c.y);
      if (ny === null || Math.abs(ny - c.y) > 0.6) continue;
      if (world.get(FL(nx), ny, FL(nz)) === B.WATER && !info.swims && !info.wades) continue;
      [c.x, c.z] = [nx, nz];
      if (ny > c.y) c.y = ny;
      return true;
    }
    return false;
  }

  // dry: only somewhere out of the water.
  pickTarget(world, c, dry = false) {
    const info = CRITTER_INFO[c.type];
    const afloat = world.get(Math.floor(c.x), Math.floor(c.y), Math.floor(c.z)) === B.WATER;
    for (let tries = 0; tries < 8; tries++) {
      const a = this.rng.next() * Math.PI * 2;
      const r = this.rng.range(...(info.range ?? [2, 7]));
      // Stay near home, loosely (a crab or a seal closer).
      const pull = Math.hypot(c.home.x - c.x, c.home.z - c.z) > (info.home ?? 16) ? 0.7 : 0;
      const tx = c.x + Math.cos(a) * r * (1 - pull) + (c.home.x - c.x) * pull * 0.5;
      const tz = c.z + Math.sin(a) * r * (1 - pull) + (c.home.z - c.z) * pull * 0.5;
      const y = standHeight(world, tx, tz, c.y);
      if (y === null) continue;
      const wet = world.get(Math.floor(tx), y, Math.floor(tz)) === B.WATER;
      if (wet && !info.swims && !info.wades) continue;
      // Penguins and seals are mostly ashore: into the water now and then,
      // and soon back out of it.
      if (info.dives && wet && (dry || this.rng.chance(afloat ? 0.7 : 0.8))) continue;
      if (c.type === 'duck' && !wet && this.rng.chance(0.6)) continue;
      // Crabs wade only into the edge of the water, and not often.
      if (info.wades && wet && (this.rng.chance(0.75) || !this.shallow(world, tx, tz))) continue;
      // Out of the water, crabs and turtles keep to the sand, and penguins
      // and seals to the cold shore (but for a last try, so one far from any
      // never gets stuck).
      if (info.ground && !wet && !info.ground.has(world.get(Math.floor(tx), y - 1, Math.floor(tz))) && tries < 7) continue;
      c.tx = tx;
      c.tz = tz;
      return;
    }
    c.tx = c.x;
    c.tz = c.z;
  }

  // Afloat, the way to the nearest ground a penguin or a seal can climb out
  // onto, round the land rather than over it (however far out a dive has
  // left it): as far along that way as it can swim straight. Null with no
  // such ground within reach.
  wayAshore(world, c, reach = 32) {
    const info = CRITTER_INFO[c.type];
    const level = FL(c.y);
    const [x0, z0] = [FL(c.x), FL(c.z)];
    const wet = (x, z) => world.get(x, level, z) === B.WATER;
    const landing = (x, z) => {
      const y = standHeight(world, x + 0.5, z + 0.5, c.y);
      return y !== null && world.get(x, y, z) !== B.WATER && y - c.y <= (info.climb ?? 1.05) && c.y - y <= 3;
    };
    const size = 2 * reach + 1;
    const seen = new Uint8Array(size * size);
    const at = (x, z) => (x - x0 + reach) * size + (z - z0 + reach);
    // Out over the water a square at a time, each with the one it came from.
    const queue = [[x0, z0, -1]];
    seen[at(x0, z0)] = 1;
    for (let i = 0; i < queue.length; i++) {
      const [x, z] = queue[i];
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const [nx, nz] = [x + dx, z + dz];
        if (Math.abs(nx - x0) > reach || Math.abs(nz - z0) > reach || nx < 0 || nz < 0 || nx >= world.W || nz >= world.D || seen[at(nx, nz)]) continue;
        seen[at(nx, nz)] = 1;
        if (wet(nx, nz)) {
          queue.push([nx, nz, i]);
          continue;
        }
        if (!landing(nx, nz)) continue;
        const way = [[nx, nz]];
        for (let j = i; j > 0; j = queue[j][2]) way.push(queue[j]);
        // The farthest square along the way it can swim to in a straight line.
        for (const [wx, wz] of way) {
          const [tx, tz] = [wx + 0.5, wz + 0.5];
          const n = Math.ceil(Math.hypot(tx - c.x, tz - c.z) / 0.1);
          let clear = true;
          for (let k = 1; k <= n && clear; k++) {
            const [px, pz] = [FL(c.x + ((tx - c.x) * k) / n), FL(c.z + ((tz - c.z) * k) / n)];
            clear = wet(px, pz) || (px === nx && pz === nz);
          }
          if (clear) return { x: tx, z: tz };
        }
        return { x: way[way.length - 1][0] + 0.5, z: way[way.length - 1][1] + 0.5 };
      }
    }
    return null;
  }

  walk(world, c, dt, info, leader) {
    const dx = c.tx - c.x;
    const dz = c.tz - c.z;
    const d = Math.hypot(dx, dz);
    if (d < 0.15) {
      c.timer = 0;
      this.fall(world, c, dt);
      return;
    }
    const speed = info.speed * (leader ? 1.6 : 1) * (c.state === 'slide' ? 2.4 : 1);
    const step = Math.min(d, speed * dt);
    const nx = c.x + (dx / d) * step;
    const nz = c.z + (dz / d) * step;
    // A crab faces one way and walks off to its side.
    c.yaw = Math.atan2(dx, dz) + (info.sideways ? Math.PI / 2 : 0);
    // Afloat, a swimmer paddles on along the top of the water however deep
    // it gets underneath.
    const paddle = info.swims && world.get(Math.floor(c.x), Math.floor(c.y), Math.floor(c.z)) === B.WATER && world.get(Math.floor(nx), Math.floor(c.y), Math.floor(nz)) === B.WATER;
    const ny = paddle ? Math.floor(c.y) : standHeight(world, nx, nz, c.y);
    const inWater = ny !== null && world.get(Math.floor(nx), ny, Math.floor(nz)) === B.WATER;
    const deep = inWater && info.wades && !this.shallow(world, nx, nz);
    if (!paddle && (ny === null || ny - c.y > (info.climb ?? 1.05) || c.y - ny > 3 || (inWater && !info.swims && !info.wades) || deep)) {
      // Blocked: think again.
      c.timer = 0;
      c.state = 'idle';
      return;
    }
    c.x = nx;
    c.z = nz;
    if (inWater && info.swims) {
      // Swimmers float at the water's surface; waders walk along the bottom.
      let top = ny;
      while (world.get(Math.floor(nx), top + 1, Math.floor(nz)) === B.WATER) top++;
      c.y = top + 0.75;
      c.state = 'swim';
      c.vy = 0;
      return;
    }
    if (c.state === 'swim') c.state = 'walk';
    if (ny > c.y + 0.01) {
      c.y = ny; // hop up a step
      c.vy = 0;
    } else {
      this.fall(world, c, dt, ny);
    }
  }

  // Water one block deep, at the very edge of it: as far in as a crab goes.
  shallow(world, x, z) {
    const w = waterColumn(world, x, z);
    return Boolean(w) && w.top - w.floor <= 1;
  }

  fall(world, c, dt, ground = null) {
    const g = ground ?? standHeight(world, c.x, c.z, c.y);
    if (g === null) return;
    if (world.get(Math.floor(c.x), g, Math.floor(c.z)) === B.WATER && CRITTER_INFO[c.type].swims) {
      let top = g;
      while (world.get(Math.floor(c.x), top + 1, Math.floor(c.z)) === B.WATER) top++;
      c.y = top + 0.75;
      return;
    }
    if (c.y > g) {
      c.vy -= 20 * dt;
      c.y = Math.max(g, c.y + c.vy * dt);
      if (c.y === g) c.vy = 0;
    } else {
      c.y = g;
      c.vy = 0;
    }
  }

  // ------------------------------------------------ riding

  // Someone gets on: from now on it goes where they take it.
  ride(id, pid) {
    const c = this.get(id);
    if (!c || !CRITTER_INFO[c.type].ride) return null;
    Object.assign(c, { rider: pid, follow: 0, happyUntil: 0, leap: null, dive: null, body: null });
    return c;
  }

  // Ridden: right under its rider (who says where they are: see riding.js),
  // walking, running or swimming as they go.
  carry(world, c, p, dt) {
    const r = CRITTER_INFO[c.type].ride;
    const at = mountUnder(c.type, p);
    const speed = Math.hypot(at.x - c.x, at.z - c.z) / Math.max(dt, 1e-3);
    Object.assign(c, { x: at.x, y: at.y, z: at.z, yaw: at.yaw });
    const wet = r.sea || world.get(FL(c.x), FL(c.y + 0.5), FL(c.z)) === B.WATER;
    c.state = wet ? 'swim' : speed > r.walk * 1.15 ? 'run' : speed > 0.5 ? 'walk' : 'idle';
  }

  // Its rider got off, or went home: it stays where they left it a moment,
  // and makes that its home.
  letGo(c) {
    const info = CRITTER_INFO[c.type];
    Object.assign(c, { rider: 0, body: null, timer: 3, state: info.sea === 'water' && !info.vehicle ? 'swim' : 'idle', mode: 'rest', tx: c.x, ty: c.y, tz: c.z, home: { x: c.x, z: c.z } });
  }

  // ------------------------------------------------ vehicles

  // Parked: where it was left, until someone drives it. A boat floats at the
  // top of its water (and, with that water gone, goes to the nearest there
  // is); a car or a digger stands on the ground, falling onto it if what was
  // under it went; a mine cart on rails stays on them, even on a slope.
  // Honked at (petted), it honks back for a moment.
  stepVehicle(world, c, dt, now) {
    c.state = c.happyUntil > now ? 'happy' : 'idle';
    if (CRITTER_INFO[c.type].vehicle === 'sea') {
      const w = waterColumn(world, c.x, c.z);
      if (w) {
        c.y = w.top + SURFACE;
        return;
      }
      const at = nearestWater(world, c.type, c.x, c.z);
      if (at) Object.assign(c, { x: at.x, y: at.y, z: at.z });
      else this.fall(world, c, dt);
      return;
    }
    if (c.type === 'minecart' && onRails(world, c.x, c.y, c.z)) {
      c.body = null;
      return;
    }
    const b = this.bodyOf(world, c);
    stepBody(world, b, { mx: 0, mz: 0 }, dt, { move: CRITTER_INFO[c.type].ride, autoJump: false });
    c.x = b.x;
    c.y = b.y;
    c.z = b.z;
  }

  // ------------------------------------------------ big animals

  // The box a big animal gets about in, as big as it is with a rider on (so
  // it never goes where it could not be ridden), moved the way a player is
  // (physics.js): bumping into walls and trees, hopping up steps, swimming.
  bodyOf(world, c) {
    if (!c.body) {
      const r = CRITTER_INFO[c.type].ride;
      c.body = Object.assign(makeBody(c.x, c.y, c.z), { radius: r.radius, height: r.height, float: r.float });
    }
    // Anything built where it is lifts it out on top.
    if (bodyOverlapsSolid(world, c.body)) unstick(world, c.body);
    return c.body;
  }

  // Ponies, cows, the elephant and the giraffe, reindeer, polar bears and
  // unicorns: grazing, ambling about (a gallop now and then, for some), a
  // swim, asleep at night; and along with you, once fed a fruit.
  stepBig(world, c, dt, now, leader, night) {
    const info = CRITTER_INFO[c.type];
    const r = info.ride;
    const b = this.bodyOf(world, c);
    // Ambling by itself; keeping up, along with someone.
    let move = { walk: info.speed, run: r.run * 0.7, swim: r.swim * 0.6, jump: r.jump };
    let go = false;
    let face = null;
    if (c.happyUntil > now) {
      c.state = 'happy';
    } else if (leader) {
      // A little way off from them, and running to catch up.
      const d = Math.hypot(leader.x - b.x, leader.z - b.z);
      c.timer = 0;
      if (d > r.radius + 2) {
        c.tx = leader.x;
        c.tz = leader.z;
        c.state = d > 7 ? 'run' : 'walk';
        move = { walk: r.walk * 0.85, run: r.run * 0.8, swim: r.swim * 0.8, jump: r.jump };
        go = true;
      } else {
        c.state = 'idle';
        face = Math.atan2(leader.x - b.x, leader.z - b.z);
      }
    } else if (night && !b.inWater) {
      c.state = 'sleep';
    } else {
      c.timer -= dt;
      if (c.timer <= 0 || (b.inWater && c.state !== 'swim')) this.decideBig(world, c, b, night);
      go = c.state === 'walk' || c.state === 'run' || c.state === 'swim';
    }
    let mx = 0;
    let mz = 0;
    if (go) {
      const dx = c.tx - b.x;
      const dz = c.tz - b.z;
      if (Math.hypot(dx, dz) > 0.4) {
        // Round to face the way, then on: never off sideways, nor over the
        // edge of anything it could not climb back up.
        const off = wrap(Math.atan2(dx, dz) - c.yaw);
        c.yaw = wrap(c.yaw + clamp(off, -3.5 * dt, 3.5 * dt));
        const k = this.edgeAhead(world, c, b) ? 0 : Math.max(0, Math.cos(off));
        mx = Math.sin(c.yaw) * k;
        mz = Math.cos(c.yaw) * k;
        if (!k && Math.abs(off) < 0.5) c.stuck = (c.stuck ?? 0) + dt;
      } else if (!leader) {
        c.timer = 0;
      }
    } else if (face !== null) {
      c.yaw = wrap(c.yaw + clamp(wrap(face - c.yaw), -3.5 * dt, 3.5 * dt));
    }
    const x0 = b.x;
    const z0 = b.z;
    // Swimming into the bank, it kicks to climb out.
    const climb = b.inWater && (c.stuck ?? 0) > 0.2;
    stepBody(world, b, { mx, mz, run: c.state === 'run', jump: climb }, dt, { move });
    // Pushing at something it cannot get past, or held up at an edge: it
    // thinks again.
    const pushing = Math.hypot(mx, mz) > 0.5 && Math.hypot(b.x - x0, b.z - z0) < move.walk * dt * 0.2;
    if (pushing) c.stuck = (c.stuck ?? 0) + dt;
    else if (mx || mz) c.stuck = 0;
    if (c.stuck > 1 && !leader) {
      c.stuck = 0;
      c.timer = 0;
      c.state = 'idle';
    }
    c.x = b.x;
    c.y = b.y;
    c.z = b.z;
    if (b.inWater && c.state !== 'happy') c.state = 'swim';
    else if (c.state === 'swim') c.state = 'walk';
  }

  // Just ahead of a big animal: a drop of more than a block, or water for
  // one that does not like a swim.
  edgeAhead(world, c, b) {
    const info = CRITTER_INFO[c.type];
    if (b.inWater) return false;
    const k = info.ride.radius + 0.3;
    const x = b.x + Math.sin(c.yaw) * k;
    const z = b.z + Math.cos(c.yaw) * k;
    const w = waterColumn(world, x, z);
    if (w && w.top + 2 >= FL(b.y + 1e-4)) return !info.paddles;
    const y = standHeight(world, x, z, b.y);
    return y === null || y < b.y - 1.2;
  }

  decideBig(world, c, b, night) {
    const info = CRITTER_INFO[c.type];
    if (b.inWater) {
      // Back to dry land, or on through the water for one that likes a swim.
      if (night || !info.paddles || this.bigRng.chance(0.6)) this.pickShore(world, c, b);
      else this.pickBig(world, c, false);
      c.state = 'swim';
      c.timer = this.bigRng.range(5, 9);
    } else if (c.state === 'walk' || c.state === 'run' || c.state === 'swim') {
      c.state = this.bigRng.chance(0.55) ? 'eat' : 'idle';
      c.timer = this.bigRng.range(2.5, 6);
    } else {
      this.pickBig(world, c, !info.paddles);
      c.state = info.gallops && this.bigRng.chance(0.3) ? 'run' : 'walk';
      c.timer = this.bigRng.range(5, 9);
    }
  }

  // Somewhere to go: near home, on dry land (and into the water now and then,
  // for one that likes a swim), on the ground it likes.
  pickBig(world, c, dry) {
    const info = CRITTER_INFO[c.type];
    const b = c.body;
    for (let tries = 0; tries < 20; tries++) {
      const a = this.bigRng.next() * Math.PI * 2;
      const r = this.bigRng.range(3, 9);
      const pull = Math.hypot(c.home.x - b.x, c.home.z - b.z) > (info.home ?? 14) ? 0.7 : 0;
      const tx = clamp(b.x + Math.cos(a) * r * (1 - pull) + (c.home.x - b.x) * pull * 0.5, 1, world.W - 1);
      const tz = clamp(b.z + Math.sin(a) * r * (1 - pull) + (c.home.z - b.z) * pull * 0.5, 1, world.D - 1);
      const w = waterColumn(world, tx, tz);
      const wet = Boolean(w) && w.top + 2 >= FL(b.y + 1e-4);
      const y = wet ? w.top : standHeight(world, tx, tz, b.y + 1);
      if (y === null || (wet && (dry || this.bigRng.chance(0.7)))) continue;
      if (info.ground && !wet && !info.ground.has(world.get(FL(tx), y - 1, FL(tz))) && tries < 19) continue;
      if (!this.clearWay(world, c, b, tx, tz)) continue;
      c.tx = tx;
      c.tz = tz;
      return;
    }
    c.tx = b.x;
    c.tz = b.z;
  }

  // Out of the water: the nearest dry land it can swim straight to and
  // climb out onto, a little way in from the edge; or anywhere about, if
  // there is none within reach.
  pickShore(world, c, b) {
    const cx = FL(b.x);
    const cz = FL(b.z);
    let best = null;
    for (let ring = 1; ring <= 24 && !(best && ring > best.d + 1); ring++) {
      for (let dx = -ring; dx <= ring; dx++) {
        for (let dz = -ring; dz <= ring; dz++) {
          if (Math.max(Math.abs(dx), Math.abs(dz)) !== ring) continue;
          const d = Math.hypot(dx, dz);
          if (best && d >= best.d) continue;
          const x = cx + dx + 0.5;
          const z = cz + dz + 0.5;
          if (waterColumn(world, x, z)) continue;
          // A step in from the edge, so it is all the way out.
          const k = (d + 1) / d;
          const tx = b.x + (x - b.x) * k;
          const tz = b.z + (z - b.z) * k;
          if (!waterColumn(world, tx, tz) && this.clearWay(world, c, b, tx, tz)) best = { x: tx, z: tz, d };
        }
      }
    }
    if (best) {
      c.tx = best.x;
      c.tz = best.z;
    } else {
      this.pickBig(world, c, false);
    }
  }

  // Whether a big animal can go straight from where it is to (tx, tz): with
  // room for it all the way, never up or down more than a block at a step
  // (or up a bank one block over the water, out of it), and through water
  // only if it likes a swim or is in it already.
  clearWay(world, c, b, tx, tz) {
    const swims = CRITTER_INFO[c.type].paddles || b.inWater;
    const n = Math.ceil(Math.hypot(tx - b.x, tz - b.z) / 0.5);
    let y = b.inWater ? null : FL(b.y + 1e-4);
    let high = b.inWater ? (waterColumn(world, b.x, b.z)?.top ?? FL(b.y)) + 2 : y + 1;
    for (let i = 1; i <= n; i++) {
      const x = b.x + ((tx - b.x) * i) / n;
      const z = b.z + ((tz - b.z) * i) / n;
      const w = waterColumn(world, x, z);
      if (w && w.top + 2 >= (y ?? high - 1)) {
        // Water, as deep as it likes: swimming.
        if (!swims) return false;
        y = null;
        high = w.top + 2;
        continue;
      }
      let ny = standHeight(world, x, z, y ?? high - 1);
      if (ny === null || ny > high || (y !== null && ny < y - 1)) return false;
      // Its box reaching up a step beside, it hops up onto it.
      if (!fits(world, c.type, x, ny, z) && !(ny + 1 <= high && fits(world, c.type, x, ++ny, z))) return false;
      y = ny;
      high = ny + 1;
    }
    return true;
  }

  // ------------------------------------------------ flying friends

  stepFlyer(world, c, dt, leader, night) {
    if (leader) {
      this.follow(world, c, dt, leader);
      return;
    }
    if (c.followed) {
      // On its own again: it thinks again from wherever it is.
      c.followed = false;
      c.onHead = 0;
      c.mode = 'perch';
      c.perch = '';
      c.timer = 0;
    }
    if (c.state === 'happy') c.state = c.mode === 'perch' ? 'idle' : c.mode === 'hover' && c.goal === 'flower' ? 'eat' : 'fly';
    const awake = CRITTER_INFO[c.type].nocturnal ? night : !night;
    if (c.mode === 'fly') {
      if (this.flight(world, c, dt)) this.arrive(c, awake);
    } else if (c.mode === 'soar') {
      this.soar(world, c, dt, awake);
    } else if (c.mode === 'hover') {
      this.hover(world, c, dt, awake);
    } else {
      this.perched(world, c, dt, awake);
    }
  }

  // Sitting somewhere: looking about, pecking, hopping, floating, or asleep.
  perched(world, c, dt, awake) {
    if (!c.perch) c.perch = this.seat(world, c);
    if (!this.supported(world, c)) {
      this.takeOff(world, c, awake);
      return;
    }
    if (!awake) {
      // Birds and owls go up into a tree to sleep, if there is one about.
      if (!c.roosted && (c.type === 'bird' || c.type === 'owl') && c.perch !== 'tree' && !roofed(world, c)) {
        c.roosted = true;
        const p = this.findPerch(world, c, 1, 14, Infinity, (q) => q.kind === 'tree', 40);
        if (p) {
          this.flyTo(c, p);
          return;
        }
      }
      c.state = 'sleep';
      return;
    }
    c.roosted = false;
    if (c.state === 'sleep') {
      c.state = 'idle';
      c.timer = this.rng.range(0.5, 2.5);
    }
    if (c.state === 'hop') {
      this.walk(world, c, dt, HOP, null);
      if (c.state === 'hop' && Math.hypot(c.tx - c.x, c.tz - c.z) >= 0.15) return;
      c.timer = 0;
    }
    if (c.perch === 'water') c.state = 'swim';
    c.timer -= dt;
    if (c.timer <= 0) this.decide(world, c);
  }

  // What to do next, sitting where it is.
  decide(world, c) {
    c.perch = this.seat(world, c);
    const indoors = roofed(world, c);
    const r = this.rng.next();
    switch (c.type) {
      case 'bird':
      case 'seagull': {
        if (!indoors && r < (c.type === 'bird' ? 0.45 : 0.35)) {
          this.takeOff(world, c, true);
          return;
        }
        if (c.perch === 'water') {
          c.state = 'swim';
          c.timer = this.rng.range(2, 5);
          return;
        }
        const ground = c.perch === 'ground' || c.perch === 'block';
        if (ground && r < 0.75) {
          c.state = 'eat';
          c.timer = this.rng.range(1.2, 3);
          return;
        }
        if (ground && r < 0.88 && this.hopTarget(world, c)) {
          c.state = 'hop';
          return;
        }
        c.state = 'idle';
        c.timer = this.rng.range(1.5, 4);
        return;
      }
      case 'owl':
        if (!indoors && r < 0.4) {
          this.takeOff(world, c, true);
          return;
        }
        c.state = 'idle';
        c.timer = this.rng.range(3, 7);
        return;
      default:
        // Bees and butterflies only ever stop for a moment.
        if (c.type === 'butterfly' && c.perch === 'flower' && r < 0.3) {
          c.state = 'idle';
          c.timer = this.rng.range(1.5, 3.5);
          return;
        }
        this.takeOff(world, c, true);
    }
  }

  // Off somewhere new, each in its own way.
  takeOff(world, c, awake) {
    c.onHead = 0;
    if (roofed(world, c)) {
      // Indoors: a little flutter up, and down again.
      const floor = world.groundBelow(FL(c.x), FL(c.y), FL(c.z)) + 1;
      const small = c.type === 'bee' || c.type === 'butterfly';
      if (small && awake && c.y < floor + 0.3) this.flyTo(c, { x: c.x, y: floor + 0.8, z: c.z }, 'air');
      else this.flyTo(c, { x: c.x, y: floor, z: c.z });
      return;
    }
    if (!awake) {
      // Down for the night: a bee or a butterfly onto a flower, if one is close.
      const small = c.type === 'bee' || c.type === 'butterfly';
      const f = small ? this.findPerch(world, c, 0, 4, Infinity, (q) => q.flower, 24) : null;
      this.flyTo(c, f ? { ...f, y: f.y + ON_FLOWER } : this.landing(world, c));
      return;
    }
    switch (c.type) {
      case 'bird': {
        const tree = this.rng.chance(0.45) ? this.findPerch(world, c, 3, 12, 14, (q) => q.kind === 'tree') : null;
        this.flyTo(c, tree ?? this.findPerch(world, c, 2, 12, 14, (q) => q.kind !== 'water') ?? this.landing(world, c));
        return;
      }
      case 'owl':
        this.flyTo(c, this.findPerch(world, c, 4, 14, 16, (q) => q.kind === 'tree', 40) ?? this.findPerch(world, c, 2, 10, 16, (q) => q.kind !== 'water') ?? this.landing(world, c));
        return;
      case 'seagull':
        this.startSoar(world, c);
        return;
      case 'bee':
        this.nextFlower(world, c);
        return;
      default:
        this.flutter(world, c);
    }
  }

  // Bees: from flower to flower around home, or buzzing about if there are none.
  nextFlower(world, c) {
    const spots = [];
    const hx = FL(c.home.x);
    const hz = FL(c.home.z);
    for (let x = hx - 8; x <= hx + 8; x++) {
      for (let z = hz - 8; z <= hz + 8; z++) {
        const p = perchAt(world, x, z);
        if (p?.flower && Math.hypot(p.x - c.x, p.z - c.z) > 0.6 && !this.taken(c, p.x, p.y + 0.9, p.z)) spots.push(p);
      }
    }
    if (spots.length) {
      // Mostly to one close by.
      spots.sort((a, b) => Math.hypot(a.x - c.x, a.z - c.z) - Math.hypot(b.x - c.x, b.z - c.z));
      const f = spots[Math.floor(this.rng.next() ** 2 * spots.length)];
      this.flyTo(c, { x: f.x, y: f.y + 0.9, z: f.z }, 'flower');
      return;
    }
    const s = this.around(c, 1.5, 4, 6);
    this.flyTo(c, this.airAbove(world, s.x, s.z, 1.2, 2.2), 'air');
  }

  // Butterflies: about in the air, settling on a flower now and then.
  flutter(world, c) {
    if (this.rng.chance(0.3)) {
      const f = this.findPerch(world, c, 0.5, 5, 12, (q) => q.flower, 30);
      if (f) {
        this.flyTo(c, { ...f, y: f.y + ON_FLOWER });
        return;
      }
    }
    const s = this.around(c, 1.5, 5, 12);
    this.flyTo(c, this.airAbove(world, s.x, s.z, 1.4, 3.2), 'air');
  }

  // Seagulls: round and round, high over the shore, on a circle of their own.
  startSoar(world, c) {
    const s = this.around(c, 0, 8, 12);
    const r = this.rng.range(5, 9);
    const x = clamp(s.x, r + 2, world.W - r - 2);
    const z = clamp(s.z, r + 2, world.D - r - 2);
    let high = Math.max(world.sea, skyline(world, x, z));
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      high = Math.max(high, skyline(world, x + Math.cos(a) * r, z + Math.sin(a) * r));
    }
    c.ring = { x, z, r, y: Math.min(world.H + 6, high + this.rng.range(6, 10)), dir: this.rng.chance(0.5) ? 1 : -1 };
    c.mode = 'soar';
    c.state = 'fly';
    c.perch = '';
    c.timer = this.rng.range(14, 32);
  }

  soar(world, c, dt, awake) {
    c.timer -= dt;
    if (!awake || c.timer <= 0) {
      this.gullLand(world, c);
      return;
    }
    const ring = c.ring;
    const speed = CRITTER_INFO[c.type].speed;
    // Steering for a point a little way round the circle draws it smoothly.
    const round = Math.atan2(c.z - ring.z, c.x - ring.x) + ring.dir * 0.7;
    const px = ring.x + Math.cos(round) * ring.r;
    const pz = ring.z + Math.sin(round) * ring.r;
    const turn = 1.5 * dt;
    const yaw = wrap(c.yaw + clamp(wrap(Math.atan2(px - c.x, pz - c.z) - c.yaw), -turn, turn));
    const fx = Math.sin(yaw) * 2;
    const fz = Math.cos(yaw) * 2;
    const need = this.clearance(world, c, fx, fz, 2, speed * dt, false) + 0.5;
    this.move(world, c, dt, clamp(c.x + fx, 1, world.W - 1) - c.x, clamp(c.z + fz, 1, world.D - 1) - c.z, 2, ring.y + Math.sin(c.timer * 0.8) * 0.6, need, speed, 3, 1, false);
    c.yaw = yaw;
  }

  // Down from the sky: mostly to the beach or out on the water, now and then
  // onto a roof or a post.
  gullLand(world, c) {
    const r = this.rng.next();
    const shore = (p) => isShore(world, p);
    const test = r < 0.55 ? shore : r < 0.85 ? (p) => p.kind === 'water' : (p) => p.kind === 'block' || shore(p);
    const p = this.findPerch(world, c, 0, 16, 20, test, 40) ?? this.findPerch(world, c, 0, 24, Infinity, (q) => shore(q) || q.kind === 'water', 40);
    this.flyTo(c, p ?? this.landing(world, c));
  }

  // Hanging in the air: a bee at a flower, or a breather between flutters.
  hover(world, c, dt, awake) {
    // A bee whose flower got picked or covered over goes to another.
    if (c.goal === 'flower' && !FLOWERS.has(world.get(FL(c.x), FL(c.y - 0.5), FL(c.z)))) c.timer = 0;
    c.timer -= dt;
    if (c.timer <= 0 || !awake) this.takeOff(world, c, awake);
  }

  // Fed a fruit, a flying friend goes along with you: round and round you
  // while you move, and onto your head once you stand still. One friend to a
  // head; any others keep flying round.
  follow(world, c, dt, leader) {
    c.followed = true;
    const moved = Math.hypot(leader.x - (c.lx ?? leader.x), leader.y - (c.ly ?? leader.y), leader.z - (c.lz ?? leader.z));
    c.lx = leader.x;
    c.ly = leader.y;
    c.lz = leader.z;
    c.still = !leader.anim && !leader.flying && moved < 0.03 ? c.still + dt : 0;
    if (c.still > 1 && !this.list.some((o) => o !== c && o.follow === c.follow && o.id < c.id && CRITTER_INFO[o.type].flies)) {
      const top = leader.y + headTop(leader.hat, leader.hair, leader.tall);
      if (c.onHead !== c.follow) {
        c.mode = 'fly';
        c.state = 'fly';
        if (!this.chase(world, c, dt, leader.x, top, leader.z)) return;
      }
      c.onHead = c.follow;
      c.mode = 'perch';
      c.perch = 'head';
      c.x = leader.x;
      c.y = top;
      c.z = leader.z;
      c.yaw = leader.yaw ?? c.yaw;
      c.state = 'idle';
      return;
    }
    c.onHead = 0;
    c.mode = 'fly';
    c.state = 'fly';
    c.orbit = (c.orbit ?? c.id * 2.4) + dt * 1.4;
    const [r, up] = ORBIT[c.type] ?? ORBIT.bird;
    this.chase(world, c, dt, leader.x + Math.cos(c.orbit) * r, leader.y + up, leader.z + Math.sin(c.orbit) * r);
  }

  // Straight for a moving spot (faster the further behind), up and over
  // anything in the way. True once there.
  chase(world, c, dt, x, y, z) {
    const dx = x - c.x;
    const dz = z - c.z;
    const flat = Math.hypot(dx, dz);
    const speed = Math.min(11, CRITTER_INFO[c.type].speed + Math.hypot(flat, y - c.y) * 1.5);
    c.tx = x;
    c.ty = y;
    c.tz = z;
    this.move(world, c, dt, dx, dz, flat, y, this.clearance(world, c, dx, dz, flat, speed * dt), speed, speed, 1);
    return Math.hypot(x - c.x, y - c.y, z - c.z) < 0.05;
  }

  // One step towards height want and the spot (dx, dz) away. Below need
  // something is in the way, so it goes up before it goes on. It never moves
  // sideways into a block, nor under one (but for the spot it is landing on).
  move(world, c, dt, dx, dz, d, want, need, speed, rise, ease, landing = true) {
    c.y += clamp(Math.max(want, need) - c.y, -speed * dt, rise * dt);
    const under = need - c.y;
    const go = (under > 0.3 ? Math.max(0, 1 - (under - 0.3) / 1.2) : 1) * ease;
    if (d < 1e-4) return 0;
    const step = Math.min(d, speed * go * dt);
    const nx = c.x + (dx / d) * step;
    const nz = c.z + (dz / d) * step;
    if (d > 0.05) c.yaw = Math.atan2(dx, dz);
    if (B.SOLID[world.get(FL(nx), FL(c.y + 0.15), FL(nz))]) return 0;
    const other = FL(nx) !== FL(c.x) || FL(nz) !== FL(c.z);
    const spot = landing && FL(nx) === FL(c.tx) && FL(nz) === FL(c.tz);
    if (other && !spot && skyline(world, nx, nz) + 1 > c.y) return 0;
    c.x = nx;
    c.z = nz;
    return step;
  }

  flyTo(c, p, goal = 'perch') {
    c.mode = 'fly';
    c.state = 'fly';
    c.goal = goal;
    c.perch = '';
    c.tx = p.x;
    c.ty = p.y;
    c.tz = p.z;
    c.sy = c.y;
    c.span = Math.max(0.3, Math.hypot(c.tx - c.x, c.tz - c.z));
    c.arc = goal === 'perch' ? Math.min(3, 0.4 + c.span * 0.2) : 0.3;
    c.timer = 4 + (c.span / CRITTER_INFO[c.type].speed) * 3;
  }

  // Towards (tx, ty, tz) in a gentle arc, climbing over the hills, trees and
  // houses on the way. True once there, or after far too long.
  flight(world, c, dt) {
    const speed = CRITTER_INFO[c.type].speed;
    const dx = c.tx - c.x;
    const dz = c.tz - c.z;
    const d = Math.hypot(dx, dz);
    const p = 1 - Math.min(1, d / c.span);
    // Never below where it is going, so it comes down onto it from above.
    const want = Math.max(c.sy + (c.ty - c.sy) * p + Math.sin(Math.PI * p) * c.arc, c.ty);
    // Slowing down to land.
    const step = this.move(world, c, dt, dx, dz, d, want, this.clearance(world, c, dx, dz, d, speed * dt), speed, speed * 1.2, d < 1 ? 0.45 + d * 0.55 : 1);
    c.timer -= dt;
    return (d - step < 0.02 && Math.abs(c.ty - c.y) < 0.02) || c.timer <= 0;
  }

  // The lowest it may fly here, a step on and a little further, without
  // clipping anything. Over the spot it is coming down on, that is the spot
  // itself (ty): in from above, never from the side or underneath.
  clearance(world, c, dx, dz, d, step, landing = true) {
    const tx = landing ? FL(c.tx) : -1;
    const tz = landing ? FL(c.tz) : -1;
    let high = -Infinity;
    const look = (k) => {
      const x = c.x + dx * k;
      const z = c.z + dz * k;
      high = Math.max(high, FL(x) === tx && FL(z) === tz ? c.ty - 1.5 : skyline(world, x, z));
    };
    look(0);
    if (d > 1e-4) {
      look(Math.min(d, step) / d);
      look(Math.min(d, 0.7) / d);
      look(Math.min(d, 1.4) / d);
    }
    return high + 1.5;
  }

  arrive(c, awake) {
    c.mode = 'perch';
    c.state = awake ? 'idle' : 'sleep';
    if (Math.hypot(c.tx - c.x, c.ty - c.y, c.tz - c.z) > 0.5) {
      // Took far too long: it thinks again from where it got to.
      c.timer = 0;
      return;
    }
    c.x = c.tx;
    c.y = c.ty;
    c.z = c.tz;
    c.timer = this.rng.range(1.5, 4);
    if (c.goal === 'flower' || c.goal === 'air') {
      c.mode = 'hover';
      c.state = c.goal === 'flower' ? 'eat' : 'fly';
      c.timer = c.goal === 'flower' ? this.rng.range(2, 4.5) : c.type === 'butterfly' ? 0.05 : this.rng.range(0.4, 1.4);
    }
  }

  // Somewhere to come down close by: straight below if that will do.
  landing(world, c) {
    const ok = (p) => p && (p.kind !== 'water' || CRITTER_INFO[c.type].swims);
    const below = perchAt(world, c.x, c.z);
    if (ok(below)) return below;
    const near = this.findPerch(world, c, 1, 10, Infinity, ok, 40);
    if (near) return near;
    const home = perchAt(world, c.home.x, c.home.z);
    return ok(home) ? home : this.airAbove(world, c.home.x, c.home.z, 1.5, 2);
  }

  findPerch(world, c, min, max, homeRange, test, tries = 24) {
    for (let i = 0; i < tries; i++) {
      const s = this.around(c, min, max, homeRange);
      const p = perchAt(world, s.x, s.z);
      if (p && test(p) && !this.taken(c, p.x, p.y, p.z)) return p;
    }
    return null;
  }

  // Somebody else already there, or on the way: two friends never share a seat.
  taken(c, x, y, z) {
    return this.list.some(
      (o) => o !== c && ((Math.hypot(o.x - x, o.z - z) < 0.5 && Math.abs(o.y - y) < 1) || (o.mode === 'fly' && Math.hypot(o.tx - x, o.tz - z) < 0.5 && Math.abs(o.ty - y) < 1)),
    );
  }

  // A spot a little way off, drifting back towards home when far from it.
  around(c, min, max, homeRange) {
    const a = this.rng.next() * Math.PI * 2;
    const r = this.rng.range(min, max);
    const k = Math.hypot(c.home.x - c.x, c.home.z - c.z) > homeRange ? 0.6 : 0;
    return { x: c.x + Math.cos(a) * r * (1 - k) + (c.home.x - c.x) * k, z: c.z + Math.sin(a) * r * (1 - k) + (c.home.z - c.z) * k };
  }

  airAbove(world, x, z, low, high) {
    const tx = clamp(x, 1.5, world.W - 1.5);
    const tz = clamp(z, 1.5, world.D - 1.5);
    return { x: tx, y: Math.max(skyline(world, tx, tz), world.sea) + this.rng.range(low, high), z: tz };
  }

  hopTarget(world, c) {
    for (let tries = 0; tries < 4; tries++) {
      const a = this.rng.next() * Math.PI * 2;
      const r = this.rng.range(0.6, 1.6);
      const tx = c.x + Math.cos(a) * r;
      const tz = c.z + Math.sin(a) * r;
      // Out in the open all the way: never under a tree or a roof (it could
      // not take off from there), nor into the water.
      let open = true;
      for (let k = 0.1; k < 1.05 && open; k += 0.1) {
        const x = c.x + (tx - c.x) * k;
        const z = c.z + (tz - c.z) * k;
        const y = standHeight(world, x, z, c.y);
        open = y !== null && Math.abs(y - c.y) <= 1.05 && perchAt(world, x, z)?.y === y;
      }
      if (!open) continue;
      c.tx = tx;
      c.tz = tz;
      return true;
    }
    return false;
  }

  // What it is sitting on: tree, ground, block, flower or water.
  seat(world, c) {
    const x = FL(c.x);
    const z = FL(c.z);
    const here = world.get(x, FL(c.y), z);
    if (here === B.WATER) return 'water';
    const under = world.get(x, FL(c.y - 0.05), z);
    if (B.KIND[under] === B.K_PLANT) return 'flower';
    if (B.TREE_PART[under]) return 'tree';
    if (B.TERRAIN[under]) return 'ground';
    return 'block';
  }

  supported(world, c) {
    if (c.perch === 'head') return false;
    const x = FL(c.x);
    const z = FL(c.z);
    if (B.SOLID[world.get(x, FL(c.y - 0.05), z)]) return true;
    const here = world.get(x, FL(c.y), z);
    if (here === B.WATER) return CRITTER_INFO[c.type].swims;
    return B.KIND[here] === B.K_PLANT && (c.type === 'bee' || c.type === 'butterfly');
  }

  // ------------------------------------------------ sea creatures

  // Fish, dolphins, the whale and octopuses, which never leave the water.
  // (Crabs and turtles walk the beach like the land animals: see pickTarget
  // and walk.)
  stepSwimmer(world, c, dt, leader, night) {
    if (c.leap) {
      this.leap(c, dt);
      return;
    }
    if (world.get(FL(c.x), FL(c.y), FL(c.z)) !== B.WATER) {
      this.backToWater(world, c);
      return;
    }
    if (leader) {
      this.swimAfter(world, c, dt, leader);
      return;
    }
    if (c.followed) {
      c.followed = false;
      c.mode = 'rest';
      c.timer = 0;
    }
    if (c.state === 'happy') c.state = 'swim';
    if (c.type === 'dolphin') this.dolphin(world, c, dt, night);
    else if (c.type === 'whale') this.whale(world, c, dt, night);
    else if (c.type === 'octopus') this.octopus(world, c, dt, night);
    else this.fish(world, c, dt, night);
  }

  // A school of fish: a dart through the water, a rest, another dart, and
  // now and then one of them jumps out (the picture shows which). Down near
  // the bottom, and slow, at night.
  fish(world, c, dt, night) {
    c.timer -= dt;
    if (c.mode === 'swim') {
      if (this.swimTo(world, c, dt, CRITTER_INFO.fish.speed * (night ? 0.3 : 1))) {
        c.mode = 'rest';
        c.timer = night ? this.rng.range(4, 9) : this.rng.range(0.4, 2);
      }
    } else if (c.timer <= 0) {
      const w = waterColumn(world, c.x, c.z);
      if (!night && c.state !== 'jump' && w && c.y > w.top + SURFACE - 1.3 && this.rng.chance(0.25)) {
        c.state = 'jump';
        c.timer = 1;
        return;
      }
      const p = this.swimSpot(world, c, 1.5, 5, 10, 'fish', night ? (v) => [v.floor + 1.1, v.floor + 1.4] : BANDS.fish);
      if (p) this.swimFor(c, p);
      else c.timer = 1;
    }
    c.state = night ? 'sleep' : c.state === 'jump' && c.timer > 0 ? 'jump' : 'swim';
  }

  // Dolphins: round and about near the top of the sea, leaping out now and then.
  dolphin(world, c, dt, night) {
    c.timer -= dt;
    c.state = night ? 'sleep' : 'swim';
    if (c.mode !== 'swim' || this.cruise(world, c, dt, CRITTER_INFO.dolphin.speed * (night ? 0.25 : 1), 1.6, 'dolphin', 0.9)) {
      const p = this.swimSpot(world, c, 5, 14, 16, 'dolphin', BANDS.dolphin);
      if (p) this.swimFor(c, p);
      else this.swimFor(c, { x: c.home.x, y: c.y, z: c.home.z });
    }
    if (!night && c.timer <= 0) {
      c.timer = this.rng.range(4, 10);
      this.tryLeap(world, c);
    }
  }

  // Out of the water in an arc ahead, if there is room in the air for one and
  // water deep enough for it to come down into. True if it has leapt.
  tryLeap(world, c, shape) {
    const w = waterColumn(world, c.x, c.z);
    if (!w || c.y < w.top + SURFACE - 1.1) return false;
    const leap = leapFrom(world, c.type, c.x, c.z, c.yaw, shape);
    if (!leap) return false;
    c.leap = leap;
    c.state = 'jump';
    return true;
  }

  leap(c, dt) {
    const j = c.leap;
    j.t += dt;
    const k = Math.min(1, j.t / j.T);
    c.x = j.x + j.fx * j.len * k;
    c.z = j.z + j.fz * j.len * k;
    c.y = j.y + 4 * j.h * k * (1 - k);
    c.state = 'jump';
    if (k < 1) return;
    c.leap = null;
    c.state = 'swim';
    if (!c.dive) c.mode = 'rest';
  }

  // A penguin or a seal afloat goes under, for a few stretches through the
  // water. True if it has.
  startDive(world, c) {
    const w = waterColumn(world, c.x, c.z);
    if (!w || world.get(FL(c.x), FL(c.y), FL(c.z)) !== B.WATER || w.top - w.floor < WATERS[c.type].deep) return false;
    const p = this.swimSpot(world, c, 1, 4, CRITTER_INFO[c.type].home, c.type, BANDS[c.type]);
    if (!p) return false;
    c.dive = { legs: this.rng.int(1, 3) };
    this.swimFor(c, p);
    c.state = 'dive';
    return true;
  }

  // Under the water, from one spot to the next (a penguin leaping out on the
  // way now and then); then up to the top, to float again.
  underwater(world, c, dt, night) {
    if (c.leap) {
      this.leap(c, dt);
      if (!c.leap) c.state = 'dive';
      return;
    }
    c.state = 'dive';
    if (world.get(FL(c.x), FL(c.y), FL(c.z)) !== B.WATER) {
      this.endDive(c);
      return;
    }
    if (!this.swimTo(world, c, dt, CRITTER_INFO[c.type].swimSpeed * (night ? 0.5 : 1))) return;
    if (c.dive.legs > 0 && !night) {
      c.dive.legs--;
      if (c.type === 'penguin' && this.rng.chance(0.35) && this.tryLeap(world, c, PENGUIN_LEAP)) return;
      const p = this.swimSpot(world, c, 1.5, 5, CRITTER_INFO[c.type].home, c.type, BANDS[c.type]);
      if (p) {
        this.swimFor(c, p);
        return;
      }
    }
    const w = waterColumn(world, c.x, c.z);
    const afloat = w ? w.top + 0.75 : c.y;
    if (Math.abs(c.y - afloat) > 0.03) {
      c.dive.legs = 0;
      c.tx = c.x;
      c.ty = afloat;
      c.tz = c.z;
      return;
    }
    this.endDive(c);
  }

  endDive(c) {
    c.dive = null;
    c.leap = null;
    c.state = 'swim';
    c.surfaced = true;
    c.timer = this.rng.range(0.5, 2);
  }

  // The whale: slowly round the deep sea, mostly at the top with its back
  // out, now and then a little way down; at the top it stops now and then to
  // blow water up out of its blowhole.
  whale(world, c, dt, night) {
    if (c.state === 'spout') {
      c.timer -= dt;
      if (c.timer > 0) return;
      c.blow = this.rng.range(8, 16);
    }
    c.state = night ? 'sleep' : 'swim';
    c.blow = (c.blow ?? this.rng.range(2, 6)) - dt;
    const w = waterColumn(world, c.x, c.z);
    if (!night && c.blow <= 0 && w && c.y > w.top + SURFACE - 0.5) {
      c.state = 'spout';
      c.timer = 2.4;
      return;
    }
    if (c.mode !== 'swim' || this.cruise(world, c, dt, CRITTER_INFO.whale.speed * (night ? 0.3 : 1), 0.5, 'whale', 1.8)) {
      const down = !night && this.rng.chance(0.25);
      const p = this.swimSpot(world, c, 8, 18, 20, 'whale', down ? (v) => [v.top + SURFACE - 2.4, v.top + SURFACE - 1.8] : BANDS.whale, 30);
      if (p) this.swimFor(c, p);
      else this.swimFor(c, { x: c.home.x, y: c.y, z: c.home.z });
    }
  }

  // An octopus: sitting on the sea floor, a little crawl along it, and now and
  // then a jet up off the bottom and a slow sink back down.
  octopus(world, c, dt, night) {
    c.timer -= dt;
    if (c.mode === 'swim' || c.mode === 'crawl' || c.mode === 'sink') {
      if (this.swimTo(world, c, dt, c.mode === 'swim' ? 2.6 : c.mode === 'crawl' ? 0.5 : 0.8)) {
        const w = waterColumn(world, c.x, c.z);
        if (c.mode === 'swim' && w) {
          this.swimFor(c, { x: c.x, y: w.floor + 1.02, z: c.z });
          c.mode = 'sink';
        } else {
          c.mode = 'rest';
          c.timer = this.rng.range(2, 6);
        }
      }
      c.state = c.mode === 'crawl' ? 'walk' : 'swim';
      return;
    }
    c.state = night ? 'sleep' : 'idle';
    if (night || c.timer > 0) return;
    const jet = this.rng.chance(0.3);
    const p = jet
      ? this.swimSpot(world, c, 1.5, 3.5, 8, 'octopus', (v) => [v.floor + 1.8, Math.min(v.floor + 3.2, v.top + SURFACE - 0.5)])
      : this.swimSpot(world, c, 0.6, 2, 8, 'octopus', (v) => [v.floor + 1.02, v.floor + 1.02]);
    if (!p) {
      c.timer = 1;
      return;
    }
    this.swimFor(c, p);
    c.mode = jet ? 'swim' : 'crawl';
  }

  swimFor(c, p) {
    c.tx = p.x;
    c.ty = p.y;
    c.tz = p.z;
    c.mode = 'swim';
    c.stuck = 0;
  }

  // Straight to (tx, ty, tz) through the water, easing in at the end. True
  // once there, or when the way is no longer water.
  swimTo(world, c, dt, speed) {
    const dx = c.tx - c.x;
    const dy = c.ty - c.y;
    const dz = c.tz - c.z;
    const d = Math.hypot(dx, dy, dz);
    if (d < 0.03) return true;
    const step = Math.min(d, speed * dt * (d < 0.8 ? 0.4 + d * 0.75 : 1));
    const nx = c.x + (dx / d) * step;
    const ny = c.y + (dy / d) * step;
    const nz = c.z + (dz / d) * step;
    if (world.get(FL(nx), FL(ny), FL(nz)) !== B.WATER) return true;
    if (Math.hypot(dx, dz) > 0.05) c.yaw = Math.atan2(dx, dz);
    c.x = nx;
    c.y = ny;
    c.z = nz;
    return false;
  }

  // Steadily round towards (tx, tz), turning no faster than turn and slowing
  // down to come round, and easing to the height ty. Never into water too
  // shallow or narrow for it, here or reach ahead: there it turns where it is,
  // and gives up after a while. True once there, or given up.
  cruise(world, c, dt, speed, turn, type, reach) {
    const dx = c.tx - c.x;
    const dz = c.tz - c.z;
    if (Math.hypot(dx, dz) < 1.2) return true;
    const off = wrap(Math.atan2(dx, dz) - c.yaw);
    c.yaw = wrap(c.yaw + clamp(off, -turn * dt, turn * dt));
    const go = speed * Math.max(0.15, Math.cos(off)) * dt;
    const fx = Math.sin(c.yaw);
    const fz = Math.cos(c.yaw);
    const nx = c.x + fx * go;
    const nz = c.z + fz * go;
    const ny = c.y + clamp(c.ty - c.y, -speed * 0.4 * dt, speed * 0.4 * dt);
    const need = WATERS[type];
    if (world.get(FL(nx), FL(ny), FL(nz)) === B.WATER && waterFor(world, nx, nz, need) && waterFor(world, nx + fx * reach, nz + fz * reach, { deep: need.deep - 1 })) {
      c.x = nx;
      c.y = ny;
      c.z = nz;
      c.stuck = 0;
      return false;
    }
    c.stuck = (c.stuck ?? 0) + dt;
    return c.stuck > 2;
  }

  // A spot in the water a little way off (drifting back towards home when far
  // from it) where this kind can be, at a height in band, with water all the
  // way there in a straight line.
  swimSpot(world, c, min, max, homeRange, type, band, tries = 20) {
    const need = WATERS[type];
    // Somewhere about, at random; failing that (in a narrow channel, say),
    // on ahead, or off to one side, or back the way it came.
    const turns = [0, 0.6, -0.6, 1.2, -1.2, Math.PI];
    for (let i = 0; i < tries + turns.length * 2; i++) {
      const j = i - tries;
      const a = c.yaw + turns[Math.floor(j / 2)];
      const r = j % 2 ? min : (min + max) / 2;
      const s = j < 0 ? this.around(c, min, max, homeRange) : { x: c.x + Math.sin(a) * r, z: c.z + Math.cos(a) * r };
      const w = waterFor(world, s.x, s.z, need);
      if (!w) continue;
      const [lo, hi] = band(w);
      if (hi < lo) continue;
      const y = lo + (hi - lo) * this.rng.next();
      if (this.clearSwim(world, c, s.x, y, s.z, need) && !this.taken(c, s.x, y, s.z)) return { x: s.x, y, z: s.z };
    }
    return null;
  }

  clearSwim(world, c, x, y, z, need) {
    const n = Math.ceil(Math.hypot(x - c.x, y - c.y, z - c.z) / 0.3);
    for (let i = 1; i <= n; i++) {
      const k = i / n;
      const px = c.x + (x - c.x) * k;
      const pz = c.z + (z - c.z) * k;
      if (world.get(FL(px), FL(c.y + (y - c.y) * k), FL(pz)) !== B.WATER) return false;
      if (need.deep > 1 && !waterFor(world, px, pz, need)) return false;
    }
    return true;
  }

  // Fed a fruit, a sea creature comes along with you as far as the water
  // goes: beside you while you swim, and waiting at the water's edge while
  // you are ashore.
  swimAfter(world, c, dt, leader) {
    c.followed = true;
    c.state = 'swim';
    c.orbit = (c.orbit ?? c.id * 2.4) + dt * 0.8;
    const r = c.type === 'whale' ? 4 : c.type === 'dolphin' ? 2 : 1.1;
    const gx = leader.x + Math.cos(c.orbit) * r;
    const gz = leader.z + Math.sin(c.orbit) * r;
    const d = Math.hypot(gx - c.x, gz - c.z);
    const need = WATERS[c.type];
    let best = null;
    for (let i = 1, n = Math.ceil(d / 0.3); i <= n; i++) {
      const px = c.x + ((gx - c.x) * i) / n;
      const pz = c.z + ((gz - c.z) * i) / n;
      const w = waterFor(world, px, pz, need);
      if (!w) break;
      const [lo, hi] = BANDS[c.type](w);
      const py = clamp(leader.y + 0.6, lo, hi);
      if (world.get(FL(px), FL(py), FL(pz)) !== B.WATER) break;
      best = { x: px, y: py, z: pz };
    }
    if (!best) return;
    this.swimFor(c, best);
    const speed = Math.min(7, CRITTER_INFO[c.type].speed + d * 1.2);
    if (c.type === 'whale' || c.type === 'dolphin') this.cruise(world, c, dt, speed, c.type === 'whale' ? 0.9 : 2.4, c.type, c.type === 'whale' ? 1.8 : 0.9);
    else this.swimTo(world, c, dt, speed);
  }

  // Out of the water (it was taken away, or built over): back into the
  // nearest water it can live in, or home if there is none close.
  backToWater(world, c) {
    c.leap = null;
    const p = nearestWater(world, c.type, c.x, c.z, 8) ?? nearestWater(world, c.type, c.home.x, c.home.z, 24);
    if (!p) return;
    c.x = p.x;
    c.y = p.y;
    c.z = p.z;
    c.mode = 'rest';
    c.timer = 0;
  }

  // Compact numbers for the wire: [id, type, x, y, z, yaw, state] in hundredths.
  pack() {
    return this.list.map((c) => [
      c.id,
      CRITTER_TYPES.indexOf(c.type),
      Math.round(c.x * 100),
      Math.round(c.y * 100),
      Math.round(c.z * 100),
      Math.round((((c.yaw % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2)) * 100),
      STATES.indexOf(c.state),
    ]);
  }

  describe() {
    return this.list.map((c) => ({ id: c.id, type: c.type, name: c.name, rider: c.rider ?? 0 }));
  }

  save() {
    return this.list.map((c) => ({ type: c.type, name: c.name, x: +c.x.toFixed(2), y: +c.y.toFixed(2), z: +c.z.toFixed(2), yaw: +c.yaw.toFixed(2) }));
  }
}

export function unpackCritter(row) {
  if (!Array.isArray(row) || row.length < 7) return null;
  return {
    id: row[0],
    type: CRITTER_TYPES[row[1]] ?? 'bunny',
    x: row[2] / 100,
    y: row[3] / 100,
    z: row[4] / 100,
    yaw: row[5] / 100,
    state: STATES[row[6]] ?? 'idle',
  };
}
