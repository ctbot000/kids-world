// The island's animal friends. The host moves them around; everyone else
// sees where they are a few times a second and fills in the motion between.
import * as B from './blocks.js';
import { Rng } from './rng.js';

export const CRITTER_TYPES = ['bunny', 'chick', 'sheep', 'duck', 'butterfly'];
export const CRITTER_INFO = {
  bunny: { name: 'Bunny', icon: '🐰', speed: 2.4, swims: false, flies: false, names: ['Bun-Bun', 'Hoppy', 'Clover', 'Cotton', 'Nibbles', 'Snowball', 'Button', 'Biscuit', 'Mochi', 'Pudding'] },
  chick: { name: 'Chick', icon: '🐤', speed: 1.5, swims: false, flies: false, names: ['Peep', 'Sunny', 'Pip', 'Chirpy', 'Lemon', 'Buttercup', 'Goldie', 'Sprout', 'Honey', 'Popcorn'] },
  sheep: { name: 'Sheep', icon: '🐑', speed: 1.1, swims: false, flies: false, names: ['Fluffy', 'Woolly', 'Cloud', 'Marshmallow', 'Puff', 'Dolly', 'Snowy', 'Cuddles', 'Lamby', 'Cottonball'] },
  duck: { name: 'Duck', icon: '🦆', speed: 1.4, swims: true, flies: false, names: ['Quackers', 'Puddle', 'Waddles', 'Splash', 'Ducky', 'Bubbles', 'Paddle', 'Dotty', 'Pebble', 'Drizzle'] },
  butterfly: { name: 'Butterfly', icon: '🦋', speed: 1.9, swims: false, flies: true, names: ['Flutter', 'Twinkle', 'Petal', 'Blossom', 'Sparkle', 'Daisy', 'Rainbow', 'Dusty', 'Glitter', 'Breeze'] },
};
export const STATES = ['idle', 'walk', 'hop', 'eat', 'happy', 'swim', 'fly', 'sleep'];
export const MAX_CRITTERS = 40;
const FOLLOW_MS = 60000;
const HAPPY_MS = 2200;

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
      state: type === 'butterfly' ? 'fly' : 'idle',
      timer: this.rng.range(0.5, 3),
      tx: x,
      tz: z,
      ty: y,
      vy: 0,
      follow: 0,
      followUntil: 0,
      happyUntil: 0,
      home: { x, z },
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
    if (player) c.yaw = Math.atan2(player.x - c.x, player.z - c.z);
    return c;
  }

  feed(id, pid, player, now) {
    const c = this.pet(id, player, now);
    if (!c) return null;
    c.follow = pid;
    c.followUntil = now + FOLLOW_MS;
    return c;
  }

  // players: Map of pid -> { x, y, z } for who is here.
  step(world, dt, now, players, night = false) {
    for (const c of this.list) this.stepOne(world, c, dt, now, players, night);
  }

  stepOne(world, c, dt, now, players, night) {
    const info = CRITTER_INFO[c.type];
    // Anyone who got built into a wall pops out on top.
    if (B.SOLID[world.get(Math.floor(c.x), Math.floor(c.y + 0.2), Math.floor(c.z))]) {
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
      this.stepFlyer(world, c, dt, night);
      return;
    }

    if (night && !leader) {
      c.state = world.get(Math.floor(c.x), Math.floor(c.y), Math.floor(c.z)) === B.WATER ? 'swim' : 'sleep';
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
      const r = this.rng.range(2, 7);
      // Stay near home, loosely.
      const pull = Math.hypot(c.home.x - c.x, c.home.z - c.z) > 16 ? 0.7 : 0;
      const tx = c.x + Math.cos(a) * r * (1 - pull) + (c.home.x - c.x) * pull * 0.5;
      const tz = c.z + Math.sin(a) * r * (1 - pull) + (c.home.z - c.z) * pull * 0.5;
      const y = standHeight(world, tx, tz, c.y);
      if (y === null) continue;
      const wet = world.get(Math.floor(tx), y, Math.floor(tz)) === B.WATER;
      if (wet && !info.swims) continue;
      if (c.type === 'duck' && !wet && this.rng.chance(0.6)) continue;
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
    c.yaw = Math.atan2(dx, dz);
    const ny = standHeight(world, nx, nz, c.y);
    const inWater = ny !== null && world.get(Math.floor(nx), ny, Math.floor(nz)) === B.WATER;
    if (ny === null || ny - c.y > 1.05 || c.y - ny > 3 || (inWater && !info.swims)) {
      // Blocked: think again.
      c.timer = 0;
      c.state = 'idle';
      return;
    }
    c.x = nx;
    c.z = nz;
    if (inWater) {
      // Swimmers float at the water's surface.
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

  stepFlyer(world, c, dt, night) {
    c.state = night ? 'sleep' : 'fly';
    c.timer -= dt;
    if (c.timer <= 0 || Math.hypot(c.tx - c.x, c.tz - c.z) < 0.3) {
      const a = this.rng.next() * Math.PI * 2;
      const r = this.rng.range(1.5, 5);
      const pull = Math.hypot(c.home.x - c.x, c.home.z - c.z) > 12 ? 0.6 : 0;
      c.tx = Math.min(world.W - 1, Math.max(1, c.x + Math.cos(a) * r * (1 - pull) + (c.home.x - c.x) * pull));
      c.tz = Math.min(world.D - 1, Math.max(1, c.z + Math.sin(a) * r * (1 - pull) + (c.home.z - c.z) * pull));
      const ground = world.top(Math.floor(c.tx), Math.floor(c.tz));
      c.ty = Math.max(ground + 1.4, world.sea + 1.4) + this.rng.range(0, 1.8);
      c.timer = this.rng.range(2, 5);
    }
    const dx = c.tx - c.x;
    const dy = c.ty - c.y;
    const dz = c.tz - c.z;
    const d = Math.hypot(dx, dy, dz);
    if (d > 0.01) {
      const step = Math.min(d, CRITTER_INFO.butterfly.speed * dt);
      c.x += (dx / d) * step;
      c.y += (dy / d) * step;
      c.z += (dz / d) * step;
      c.yaw = Math.atan2(dx, dz);
    }
    const floor = world.top(Math.floor(c.x), Math.floor(c.z)) + 1.2;
    if (c.y < floor) c.y = floor;
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
