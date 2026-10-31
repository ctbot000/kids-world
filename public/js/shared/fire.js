// Fire, as lightning starts it in a thunderstorm (room.js stepStorm). Only
// what grows burns — trees, leaves, grass, hay and flowers — never what
// anybody built: a fire creeps from one block to the next, each burning for
// a while and then gone (grass is left as bare dirt), slower in the rain,
// and goes out when it runs out of things to burn. The watering can puts it
// out (douse), and so does taking the burning block away.
import * as B from './blocks.js';

// What each block that burns leaves behind.
export const BURNT = new Map([
  [B.LEAVES, B.AIR],
  [B.PINE_LEAVES, B.AIR],
  [B.KATSURA_LEAVES, B.AIR],
  [B.WOOD, B.AIR],
  [B.KATSURA_WOOD, B.AIR],
  [B.HAY, B.AIR],
  [B.GRASS, B.DIRT],
  [B.MOWED, B.DIRT],
]);
// Flowers, tall grass and sprouts go up in a moment (not candy ones).
for (const d of B.BLOCKS) if (d?.kind === 'plant' && d.category === 'plants' && d.sound === 'plant') BURNT.set(d.id, B.AIR);
export const burns = (id) => BURNT.has(id);

// How readily each catches from a fire next to it: leaves and hay go up at
// once, a trunk more slowly, and grass hardly, so a grass fire soon dies
// down (and never sweeps the whole island bare) while a tree burns through.
export function catches(id) {
  if (id === B.GRASS || id === B.MOWED) return 0.12;
  if (id === B.WOOD || id === B.KATSURA_WOOD) return 0.55;
  return BURNT.has(id) ? 1 : 0;
}

export const FIRE = {
  // How long one block burns before it is gone (ms, from and to).
  burnMs: [8000, 14000],
  // How often a burning block tries to set one next to it alight, and how
  // likely that is (by what it is, see catches) in dry weather and in the
  // rain.
  spreadMs: 1500,
  spread: 0.6,
  wetSpread: 0.35,
  // No more than this many blocks alight at once on an island.
  max: 48,
  // How far round a tap of the watering can it puts fires out (blocks).
  douse: 1.6,
  // A strike's chance of setting what it hits alight.
  catches: 0.65,
  // How often lightning strikes in a storm (ms, from and to).
  strikeMs: [5000, 12000],
  // What standing in the flames takes off you, in monster bumps.
  bumps: 1,
};

// The blocks next to a burning one that it may set alight: all round it,
// and more often above it (fire climbs).
const AROUND = [];
for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) for (let dz = -1; dz <= 1; dz++) if (dx || dy || dz) AROUND.push([dx, dy, dz]);
for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) AROUND.push([dx, 1, dz]);

export class Fires {
  constructor(world, random = Math.random) {
    this.world = world;
    this.random = random;
    // Each block alight, by its cell: where it is, what was burning, when
    // it burns away and when it next tries to spread.
    this.list = new Map();
  }

  key(x, y, z) {
    return this.world.index(x, y, z);
  }

  has(x, y, z) {
    return this.world.inBounds(x, y, z) && this.list.has(this.key(x, y, z));
  }

  // Sets the block at (x, y, z) alight, if it burns and there is room for
  // one more fire. True when it caught.
  ignite(x, y, z, now) {
    const w = this.world;
    if (!w.inBounds(x, y, z) || this.list.size >= FIRE.max) return false;
    const k = this.key(x, y, z);
    const id = w.get(x, y, z);
    if (this.list.has(k) || !burns(id)) return false;
    // Grass under a block (a house's floor, say) has nothing to burn with.
    if ((id === B.GRASS || id === B.MOWED) && w.get(x, y + 1, z) !== B.AIR && !burns(w.get(x, y + 1, z))) return false;
    const [lo, hi] = FIRE.burnMs;
    this.list.set(k, { x, y, z, id, out: now + lo + this.random() * (hi - lo), next: now + FIRE.spreadMs * (0.5 + this.random()) });
    return true;
  }

  // The fires a moment on: { on: cells newly alight, off: cells gone out,
  // burnt: [x, y, z, id, ...] what burnt away, to set in the world }.
  step(now, wet = false) {
    const on = [];
    const off = [];
    const burnt = [];
    const w = this.world;
    for (const [k, f] of [...this.list]) {
      // Taken away, built over or changed by somebody: nothing left alight.
      if (w.get(f.x, f.y, f.z) !== f.id) {
        this.list.delete(k);
        off.push(f.x, f.y, f.z);
        continue;
      }
      if (now >= f.out) {
        this.list.delete(k);
        off.push(f.x, f.y, f.z);
        burnt.push(f.x, f.y, f.z, BURNT.get(f.id));
        continue;
      }
      if (now < f.next) continue;
      f.next = now + FIRE.spreadMs * (0.7 + this.random() * 0.6);
      // One of what burns round it, if anything does.
      const near = AROUND.filter(([dx, dy, dz]) => burns(w.get(f.x + dx, f.y + dy, f.z + dz)) && !this.has(f.x + dx, f.y + dy, f.z + dz));
      if (!near.length) continue;
      const [dx, dy, dz] = near[Math.floor(this.random() * near.length)];
      const [x, y, z] = [f.x + dx, f.y + dy, f.z + dz];
      if (this.random() >= (wet ? FIRE.wetSpread : FIRE.spread) * catches(w.get(x, y, z))) continue;
      if (this.ignite(x, y, z, now)) on.push(x, y, z);
    }
    return { on, off, burnt };
  }

  // Puts out every fire within FIRE.douse of (x, y, z): the cells gone out.
  douse(x, y, z) {
    const off = [];
    for (const [k, f] of this.list) {
      if (Math.hypot(f.x + 0.5 - x, f.y + 0.5 - y, f.z + 0.5 - z) > FIRE.douse) continue;
      this.list.delete(k);
      off.push(f.x, f.y, f.z);
    }
    return off;
  }

  // Whether a body standing at (x, y, z) is in the flames: a block alight
  // where its feet or its middle are, or right under its feet.
  burning(x, y, z) {
    const fx = Math.floor(x);
    const fz = Math.floor(z);
    const fy = Math.floor(y + 0.05);
    return this.has(fx, fy, fz) || this.has(fx, fy + 1, fz) || this.has(fx, fy - 1, fz);
  }

  clear() {
    this.list.clear();
  }

  // Every block alight, as [x, y, z, ...].
  pack() {
    const out = [];
    for (const f of this.list.values()) out.push(f.x, f.y, f.z);
    return out;
  }
}

// Where lightning strikes: of a few spots picked at random over the island,
// the highest (a tree before the grass round it, as lightning does), its
// top block and what that is. Null when there is no land to hit.
export function strikeSpot(world, random = Math.random, tries = 5) {
  let best = null;
  for (let i = 0; i < tries; i++) {
    const x = Math.floor(world.W * (0.1 + 0.8 * random()));
    const z = Math.floor(world.D * (0.1 + 0.8 * random()));
    let y = world.H - 1;
    while (y > 0 && world.get(x, y, z) === B.AIR) y--;
    if (y <= 0) continue;
    if (!best || y > best.y) best = { x, y, z, id: world.get(x, y, z) };
  }
  return best;
}
