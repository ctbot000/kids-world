// The volcano island's crater erupting on its own (room.js volcanoStep): a show, and a light hazard, never a change to the world. Everything an eruption does lives only in the moment — a rumble and a boom, a fountain of lava out of the crater, lava bombs arcing out and bursting — so an island saved and opened again shows no trace of one, as with monsters. What the eruption is made of is the host's to say (so everyone on the island sees and hears the same), and each page draws it (game.js volcanoFx): the fountain built on the whale's blowhole spout scaled up in lava colours, the bombs on the thrown-object physics, and the splashes as little glowing pools that cool and fade within a minute. A splash never harms anything: it lands only on natural ground, never on anything built, planted or furnished, and nothing at all is set in the world — no edit is made, so nothing needs undoing and nobody's build is ever touched. The one hazard is standing in a splash as it is still hot, which burns like lava does (room.js stepVolcano, and 40 HP, halved by Knight Armor or a Fire Suit as with a monster's bump). Craters are found where the lava sits highest (craterOf below): the summit lake the island was made with, wherever the island has been shaped since.
import * as B from './blocks.js';

// How the eruptions come: no more often than the least of this and no less
// often than the most (ms), each about twenty seconds from the first of the
// rumble to the last of the bombs.
export const ERUPT_EVERY_MS = [150000, 300000];
// The rumble before it blows: this long, rising (ms).
export const RUMBLE_MS = 4000;
// How long the fountain plays and the bombs come out (ms).
export const BURST_MS = 15000;
// How the bombs come: one every this long (ms, from and to), how many blocks
// out from the middle of the crater they land at most, and how long each is
// in the air (ms) — the same thrown-object arc as a Bomb Rod's little bomb
// (game.js lobBomb), only bigger.
export const BOMB_EVERY_MS = [900, 1900];
export const BOMB_REACH = 26;
export const BOMB_MS = [1600, 2600];
// A splash a bomb leaves: this big round where it lands (blocks), this hot
// for standing in, and gone this long after it landed (ms) — it cools and
// fades on its own, so nothing is ever left behind.
export const SPLASH_R = 1;
export const SPLASH_HOT_MS = 6000;
export const SPLASH_COOL_MS = 45000;
// No more than this many splashes lying about at once.
export const MAX_SPLASHES = 24;

// Where a volcano's crater is: the middle of the highest lava in the world,
// which on an island as it was made is the summit lake. Null when there is
// none (the volcano dug out, or filled in), so an island with no crater
// never erupts.
export function craterOf(world) {
  let best = null;
  for (let x = 1; x < world.W - 1; x++) {
    for (let z = 1; z < world.D - 1; z++) {
      for (let y = world.H - 1; y > 0; y--) {
        if (world.get(x, y, z) !== B.LAVA) continue;
        if (!best || y > best.y) best = { x: x + 0.5, y, z: z + 0.5 };
        break;
      }
    }
  }
  return best;
}

// Whether a bomb may burst on the block at (x, y, z): only natural ground —
// never anything built, planted or furnished, and nothing of anybody's at
// all over it (a splash must not sit under a build, or in one).
export function naturalGround(world, x, y, z) {
  const id = world.get(x, y, z);
  const d = B.block(id);
  if (id !== B.LAVA && d.category !== 'nature') return false;
  const over = world.get(x, y + 1, z);
  return over === B.AIR || over === B.LAVA;
}

// One eruption, from rumble to the last splash cooling. The host steps it
// (step) and tells everyone what it does as it goes (see room.js volcanoStep).
export class VolcanoSim {
  constructor(world, random = Math.random) {
    this.world = world;
    this.random = random;
    this.crater = world.theme === 'volcano' ? craterOf(world) : null;
    // Where the next eruption starts, and what is going now: null between
    // eruptions. phase: 'rumble' rising, 'burst' the fountain and the bombs.
    this.nextAt = 0;
    this.event = null;
    // The splashes lying about, by `${x},${y},${z}`: where, when it cools.
    this.splashes = new Map();
    this.seq = 0;
  }

  get going() {
    return this.event !== null;
  }

  // Steps a moment on, calling out(tell) with each message for everyone:
  // what started, each bomb as it is thrown, each splash it leaves, and what
  // has cooled. Returns the messages, so a test can look at them.
  step(now, tell) {
    const out = [];
    const say = (msg) => {
      out.push(msg);
      tell?.(msg);
    };
    if (!this.crater) return out;
    const e = this.event;
    if (!e) {
      // The first eruption waits as long as the rest do: nobody stepping
      // onto the island is met with one.
      if (this.armed !== true) {
        this.armed = true;
        this.nextAt = now + this.between(ERUPT_EVERY_MS);
      }
      if (now >= this.nextAt) {
        // Look again for the crater: the island may have been shaped since the
        // room was opened, and an eruption comes from wherever the lava sits
        // highest now (or never, if there is no crater left).
        this.crater = craterOf(this.world);
        if (!this.crater) return out;
        this.event = { at: now, phase: 'rumble', bombAt: now + RUMBLE_MS };
        say({ t: 'vfx', kind: 'start', at: [this.crater.x, this.crater.y, this.crater.z] });
      }
      return out;
    }
    if (e.phase === 'rumble') {
      if (now >= e.at + RUMBLE_MS) {
        e.phase = 'burst';
        say({ t: 'vfx', kind: 'blow', at: [this.crater.x, this.crater.y, this.crater.z] });
      }
      return out;
    }
    if (now >= e.at + RUMBLE_MS + BURST_MS) {
      this.event = null;
      this.nextAt = now + this.between(ERUPT_EVERY_MS);
      say({ t: 'vfx', kind: 'end', at: [this.crater.x, this.crater.y, this.crater.z] });
      return out;
    }
    if (now >= e.bombAt) {
      e.bombAt = now + this.between(BOMB_EVERY_MS);
      const bomb = this.throwBomb(now);
      if (bomb) say(bomb);
    }
    return out;
  }

  // One lava bomb out of the crater: where it starts, where it comes down
  // and when, so every page can fly it the same way. Null when nowhere it
  // lands will do (see naturalGround).
  throwBomb(now) {
    const c = this.crater;
    for (let tries = 0; tries < 12; tries++) {
      const a = this.random() * Math.PI * 2;
      const d = 6 + this.random() * (BOMB_REACH - 6);
      const tx = Math.floor(c.x + Math.cos(a) * d);
      const tz = Math.floor(c.z + Math.sin(a) * d);
      if (tx < 1 || tz < 1 || tx >= this.world.W - 1 || tz >= this.world.D - 1) continue;
      const y = this.world.top(tx, tz);
      if (y < 1 || !naturalGround(this.world, tx, y, tz)) continue;
      if (Math.hypot(tx + 0.5 - c.x, tz + 0.5 - c.z) < 5) continue;
      const from = [c.x, c.y + 0.5, c.z];
      const to = [tx + 0.5, y + 1, tz + 0.5];
      return { t: 'vfx', kind: 'bomb', from, to, ms: Math.round(this.between(BOMB_MS)), id: ++this.seq };
    }
    return null;
  }

  // A bomb bursting at (x, y, z): the splash it leaves there, if it may, and
  // how long it stays hot. Called by the host as each bomb lands.
  splashAt(x, y, z, now) {
    const fx = Math.floor(x);
    const fy = Math.floor(y);
    const fz = Math.floor(z);
    if (!naturalGround(this.world, fx, fy - 1, fz)) return null;
    if (this.splashes.size >= MAX_SPLASHES) {
      // The oldest has cooled enough for anyone: it goes at once, so the
      // island is never short of room for the new one.
      let oldest = null;
      for (const [k, s] of this.splashes) if (!oldest || s.coolAt < oldest.coolAt) oldest = { k, ...s };
      this.splashes.delete(oldest.k);
    }
    const k = `${fx},${fy},${fz}`;
    const s = { x: fx, y: fy, z: fz, at: now, hotUntil: now + SPLASH_HOT_MS, coolAt: now + SPLASH_COOL_MS };
    this.splashes.set(k, s);
    return s;
  }

  // The splashes a moment on: which have cooled away, and are gone.
  stepSplashes(now) {
    const gone = [];
    for (const [k, s] of [...this.splashes]) {
      if (now < s.coolAt) continue;
      this.splashes.delete(k);
      gone.push(s);
    }
    return gone;
  }

  // Whether someone standing at (x, y, z) is in a splash still hot enough to
  // burn: one round their feet, as the lava itself is (fire.js burning).
  burning(x, y, z, now) {
    const fx = Math.floor(x);
    const fy = Math.floor(y + 0.05);
    const fz = Math.floor(z);
    for (const s of this.splashes.values()) {
      if (now >= s.hotUntil) continue;
      if (Math.hypot(s.x + 0.5 - x, s.z + 0.5 - z) > SPLASH_R) continue;
      if (Math.abs(s.y - fy) > 1) continue;
      return true;
    }
    return false;
  }

  // A number between [lo, hi], as room.js between does.
  between([lo, hi]) {
    return lo + this.random() * (hi - lo);
  }

  // Nothing of an eruption is saved: what someone joining mid-show sees, so
  // they are not left guessing at a rumble they never heard.
  pack(now) {
    if (!this.event) return null;
    const e = this.event;
    return {
      at: [this.crater.x, this.crater.y, this.crater.z],
      phase: e.phase,
      left: Math.max(0, Math.round(e.at + RUMBLE_MS + BURST_MS - now)),
    };
  }
}
