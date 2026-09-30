// Seeded randomness. Everything that has to come out the same on every
// machine — world generation, where critters wander — draws from these.

// A 32-bit string hash (FNV-1a), for turning seeds and names into numbers.
export function hashString(text) {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

// Hashes integer coordinates to a float in [0, 1).
export function hash2(seed, x, z) {
  let h = seed ^ Math.imul(x | 0, 0x27d4eb2d) ^ Math.imul(z | 0, 0x165667b1);
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

export function hash3(seed, x, y, z) {
  return hash2(seed ^ Math.imul(y | 0, 0x9e3779b1), x, z);
}

// mulberry32: small, fast and good enough for a toy world.
export class Rng {
  constructor(seed = 1) {
    this.state = seed >>> 0 || 1;
  }

  next() {
    let t = (this.state = (this.state + 0x6d2b79f5) >>> 0);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  range(min, max) {
    return min + (max - min) * this.next();
  }

  int(min, maxInclusive) {
    return min + Math.floor(this.next() * (maxInclusive - min + 1));
  }

  pick(list) {
    return list[Math.floor(this.next() * list.length)];
  }

  chance(p) {
    return this.next() < p;
  }
}
