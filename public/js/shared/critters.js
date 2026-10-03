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
// and turtles and crabs between the water and the beach.
import * as B from './blocks.js';
import { Rng } from './rng.js';

// New kinds go on the end: the wire sends the index.
export const CRITTER_TYPES = ['bunny', 'chick', 'sheep', 'duck', 'butterfly', 'bird', 'owl', 'bee', 'seagull', 'fish', 'dolphin', 'whale', 'turtle', 'crab', 'octopus'];
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
  // sea: 'water' never leaves it; 'beach' walks the sand and the sea floor (or floats, with swims).
  fish: { name: 'Fish', icon: '🐠', speed: 2.2, swims: true, flies: false, sea: 'water', names: ['Finn', 'Splish', 'Glimmer', 'Wiggles', 'Guppy', 'Shimmer', 'Zigzag', 'Minnow', 'Sprinkle', 'Flash'] },
  dolphin: { name: 'Dolphin', icon: '🐬', speed: 4.5, swims: true, flies: false, sea: 'water', names: ['Echo', 'Bubbly', 'Leapy', 'Squeaky', 'Twirl', 'Zoom', 'Ripple', 'Surfy', 'Glider', 'Smiley'] },
  whale: { name: 'Whale', icon: '🐳', speed: 1.6, swims: true, flies: false, sea: 'water', names: ['Big Blue', 'Humphrey', 'Tiny', 'Rumble', 'Spouty', 'Waverly', 'Jumbo', 'Misty', 'Ocean', 'Puddles'] },
  turtle: { name: 'Turtle', icon: '🐢', speed: 0.8, swims: true, flies: false, sea: 'beach', range: [1.5, 5], names: ['Sheldon', 'Myrtle', 'Slowpoke', 'Pickle', 'Mossy', 'Tank', 'Bean', 'Kelp', 'Lagoon', 'Olive'] },
  crab: { name: 'Crab', icon: '🦀', speed: 1.3, swims: false, flies: false, sea: 'beach', wades: true, sideways: true, range: [0.8, 2.5], names: ['Pinchy', 'Snappy', 'Clawdia', 'Sidney', 'Scuttle', 'Nipper', 'Clicky', 'Rusty', 'Tickles', 'Sideways'] },
  octopus: { name: 'Octopus', icon: '🐙', speed: 1.5, swims: true, flies: false, sea: 'water', names: ['Inky', 'Squiggle', 'Octavia', 'Wiggly', 'Noodle', 'Swirly', 'Bloop', 'Doodle', 'Hugs', 'Jelly'] },
};
// New states go on the end too.
export const STATES = ['idle', 'walk', 'hop', 'eat', 'happy', 'swim', 'fly', 'sleep', 'jump', 'spout'];
export const MAX_CRITTERS = 64;
const FOLLOW_MS = 60000;
const HAPPY_MS = 2200;

// What bees visit and butterflies rest on.
export const FLOWERS = new Set([B.TULIP, B.DAISY, B.BLUEBELL, B.COSMOS, B.SUNFLOWER, B.LOLLIPOP, B.GUMDROP]);

// How high above someone's feet a flying friend sits on their head: on top of
// the skull (render/avatar.js puts it at 1.41), or on the hat.
const HEAD_TOP = { cap: 1.6, party: 1.76, crown: 1.42, beanie: 1.7, sprout: 1.66, straw: 1.52, headphones: 1.6 };
export const headTop = (hat) => HEAD_TOP[hat] ?? 1.41;

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
// The sand of the beach and the sea floor, where crabs and turtles keep.
const SANDY = new Set([B.SAND, B.PEBBLES]);
// The water each swimmer needs: how many cells deep, whether it has to be the
// sea (not a pond), and how far either side it must be water too.
const WATERS = {
  fish: { deep: 1 },
  octopus: { deep: 2 },
  dolphin: { deep: 3, sea: true, wide: 1 },
  whale: { deep: 4, sea: true, wide: 2 },
};
// Where in the water each one swims, from a column of it: [lowest, highest].
const BANDS = {
  fish: (w) => [w.floor + 1.25, w.top + SURFACE - 0.3],
  octopus: (w) => [w.floor + 1.02, w.top + SURFACE - 0.5],
  dolphin: (w) => [w.top + SURFACE - 1, w.top + SURFACE - 0.3],
  whale: (w) => [w.top + SURFACE - 0.3, w.top + SURFACE - 0.22],
};
// What to say when a swimmer is invited where there is no water for it.
export const NEEDS_WATER = {
  fish: 'Fish need water: tap a pond or the sea!',
  octopus: 'An octopus needs deeper water: tap the sea!',
  dolphin: 'Dolphins need the open sea: tap the water past the beach!',
  whale: 'A whale needs the deep sea, far out from the beach!',
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
export function placeFlyers(world, rng, counts = flyerCounts(world.theme)) {
  const places = {
    bird: [(p) => p.kind === 'tree', (p) => p.kind !== 'water'],
    owl: [(p) => p.kind === 'tree', (p) => p.kind !== 'water'],
    bee: [(p) => p.flower, (p) => p.kind === 'ground'],
    seagull: [(p) => isShore(world, p), (p) => p.kind === 'water'],
  };
  const find = (test) => {
    for (let tries = 0; tries < 800; tries++) {
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
export function placeSea(world, rng, counts = seaCounts(world.theme)) {
  const out = [];
  for (const [type, n] of Object.entries(counts)) {
    for (let i = 0; i < n; i++) {
      for (let tries = 0; tries < 800; tries++) {
        const x = rng.int(2, world.W - 3) + 0.5;
        const z = rng.int(2, world.D - 3) + 0.5;
        let y = null;
        if (CRITTER_INFO[type].sea === 'beach') {
          const p = perchAt(world, x, z);
          const w = waterColumn(world, x, z);
          if (p && isShore(world, p)) y = p.y;
          // With no beach to be found (Flat Land's sea has none), the shallows will do.
          else if (tries >= 400 && w && w.top - w.floor <= 3 && SANDY.has(world.get(FL(x), w.floor, FL(z)))) y = type === 'crab' ? w.floor + 1 : w.top + 0.75;
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

export class CritterSim {
  constructor(seed = 1) {
    this.rng = new Rng(seed);
    this.list = [];
    this.nextId = 1;
  }

  add(type, x, y, z, name = null) {
    if (!CRITTER_INFO[type] || this.list.length >= MAX_CRITTERS) return null;
    const info = CRITTER_INFO[type];
    const c = {
      id: this.nextId++,
      type,
      name: name && info.names.includes(name) ? name : this.rng.pick(info.names),
      x,
      y,
      z,
      yaw: this.rng.next() * Math.PI * 2,
      state: 'idle',
      timer: this.rng.range(0.5, 3),
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
    if (!c) return null;
    c.follow = pid;
    c.followUntil = now + FOLLOW_MS;
    return c;
  }

  // players: Map of pid -> { x, y, z, yaw, anim, flying, hat } for who is here.
  step(world, dt, now, players, night = false) {
    for (const c of this.list) this.stepOne(world, c, dt, now, players, night);
  }

  stepOne(world, c, dt, now, players, night) {
    const info = CRITTER_INFO[c.type];
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
    if (c.follow && (c.followUntil < now || !players.has(c.follow))) c.follow = 0;
    const leader = c.follow ? players.get(c.follow) : null;

    if (info.flies) {
      this.stepFlyer(world, c, dt, leader, night);
      return;
    }
    if (info.sea === 'water') {
      this.stepSwimmer(world, c, dt, leader, night);
      return;
    }

    if (night && !leader) {
      c.state = world.get(Math.floor(c.x), Math.floor(c.y), Math.floor(c.z)) === B.WATER && info.swims ? 'swim' : 'sleep';
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
      if (c.state === 'walk' || c.state === 'hop' || c.state === 'swim') {
        c.state = this.rng.chance(0.4) ? 'eat' : 'idle';
        c.timer = this.rng.range(1.5, 4);
      } else {
        this.pickTarget(world, c);
        c.state = c.type === 'bunny' ? 'hop' : 'walk';
        c.timer = this.rng.range(3, 6);
      }
    }

    if (c.state === 'walk' || c.state === 'hop' || c.state === 'swim') this.walk(world, c, dt, info, leader);
    else this.fall(world, c, dt);
  }

  pickTarget(world, c) {
    const info = CRITTER_INFO[c.type];
    for (let tries = 0; tries < 8; tries++) {
      const a = this.rng.next() * Math.PI * 2;
      const r = this.rng.range(...(info.range ?? [2, 7]));
      // Stay near home, loosely (a crab closer).
      const pull = Math.hypot(c.home.x - c.x, c.home.z - c.z) > (info.wades ? 8 : 16) ? 0.7 : 0;
      const tx = c.x + Math.cos(a) * r * (1 - pull) + (c.home.x - c.x) * pull * 0.5;
      const tz = c.z + Math.sin(a) * r * (1 - pull) + (c.home.z - c.z) * pull * 0.5;
      const y = standHeight(world, tx, tz, c.y);
      if (y === null) continue;
      const wet = world.get(Math.floor(tx), y, Math.floor(tz)) === B.WATER;
      if (wet && !info.swims && !info.wades) continue;
      if (c.type === 'duck' && !wet && this.rng.chance(0.6)) continue;
      // Crabs wade only into the edge of the water, and not often.
      if (info.wades && wet && (this.rng.chance(0.75) || !this.shallow(world, tx, tz))) continue;
      // Crabs and turtles keep to the sand, the sea and its floor (but for a
      // last try, so one far from any never gets stuck).
      if (info.sea === 'beach' && !wet && !SANDY.has(world.get(Math.floor(tx), y - 1, Math.floor(tz))) && tries < 7) continue;
      c.tx = tx;
      c.tz = tz;
      return;
    }
    c.tx = c.x;
    c.tz = c.z;
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
    const speed = info.speed * (leader ? 1.6 : 1);
    const step = Math.min(d, speed * dt);
    const nx = c.x + (dx / d) * step;
    const nz = c.z + (dz / d) * step;
    // A crab faces one way and walks off to its side.
    c.yaw = Math.atan2(dx, dz) + (info.sideways ? Math.PI / 2 : 0);
    const ny = standHeight(world, nx, nz, c.y);
    const inWater = ny !== null && world.get(Math.floor(nx), ny, Math.floor(nz)) === B.WATER;
    const deep = inWater && info.wades && !this.shallow(world, nx, nz);
    if (ny === null || ny - c.y > 1.05 || c.y - ny > 3 || (inWater && !info.swims && !info.wades) || deep) {
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
      const top = leader.y + headTop(leader.hat);
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

  // Out of the sea in an arc ahead, if there is room in the air for one and
  // deep sea to come down into.
  tryLeap(world, c) {
    const w = waterColumn(world, c.x, c.z);
    if (!w || c.y < w.top + SURFACE - 1.1) return;
    const fx = Math.sin(c.yaw);
    const fz = Math.cos(c.yaw);
    const len = 5.5;
    const h = 2;
    const land = waterFor(world, c.x + fx * len, c.z + fz * len, WATERS.dolphin);
    if (!land || land.top !== w.top) return;
    const y = w.top + SURFACE - 0.35;
    for (let i = 1; i < 12; i++) {
      const k = i / 12;
      const id = world.get(FL(c.x + fx * len * k), FL(y + 4 * h * k * (1 - k)), FL(c.z + fz * len * k));
      if (id !== B.AIR && id !== B.WATER) return;
    }
    c.leap = { t: 0, T: 1.35, x: c.x, y, z: c.z, fx, fz, len, h };
    c.state = 'jump';
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
    c.mode = 'rest';
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
    return this.list.map((c) => ({ id: c.id, type: c.type, name: c.name }));
  }

  save() {
    return this.list.map((c) => ({ type: c.type, name: c.name, x: +c.x.toFixed(2), y: +c.y.toFixed(2), z: +c.z.toFixed(2) }));
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
