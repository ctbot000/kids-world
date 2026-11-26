// What popped monsters dropped (shared/loot.js), on this page: each thing
// tumbling out of the monster as it goes pop, in an arc to where the island
// says it lands, bouncing twice and lying there spinning and glinting (bobbing
// on the water, if it came down in it); walked up to, it is asked for, and
// once the island says whose it is, it flies to whoever picked it up — or by
// itself, after a while, to whoever it is for — and what it was goes in your
// purse, pocket or basket if it was for you (game.js lootGot).
//
// In the Land of Nod, where down is towards whatever body you are on, it all
// goes by the up there (game.js nod).
import * as B from './shared/blocks.js';
import { PICK_HIGH, PICK_REACH, unpackLoot } from './shared/loot.js';
import { dist3, flatUnit } from './shared/nod/shape.js';
import { quatOf } from './render/nod/kit.js';
import { disposeLoot, lootModel } from './render/loot-models.js';

const UP = { x: 0, y: 1, z: 0 };
// How fast it spins lying there (radians a second), and how far and how fast
// it bobs.
const SPIN = 2.6;
const BOB = 0.055;
const BOB_SPEED = 2.8;
// Out of a monster: one after another this far apart (seconds), in an arc
// this long and this high (a boss's fountain higher and longer), then two
// little bounces where it lands.
const STAGGER = 0.035;
const BIG_STAGGER = 0.05;
const BOUNCES = [
  [0.17, 0.17],
  [0.1, 0.055],
];
// Landed, it can be picked up this long after (so it is always seen first).
const READY_MS = 280;
// Asked for and not heard of again in this long, it is asked for again.
const ASK_AGAIN_MS = 1500;
// Flying off to whoever got it takes this long, and goes to their middle.
const FLY_SECS = 0.34;
const CHEST = 0.9;
// Further than this from the camera it is not drawn.
const SEEN = 90;

const ease = (k) => 1 - (1 - k) ** 3;

export class LootView {
  constructor(game) {
    this.g = game;
    this.items = new Map();
    // What has been picked up lately, by its id: something whose news came
    // before it was seen to drop (a monster still flying off) never lies here.
    this.gone = new Set();
  }

  get renderer() {
    return this.g.renderer;
  }

  // Which way is up at p.
  upAt(p) {
    return this.g.nod ? this.g.nod.space.up(p.x, p.y, p.z) : UP;
  }

  // What lies about the island as you arrive (room.js welcome).
  reset(rows) {
    this.clear();
    this.gone.clear();
    for (const row of Array.isArray(rows) ? rows.slice(0, 200) : []) {
      const d = unpackLoot(row);
      if (d) this.add(d, null);
    }
  }

  // Out of a monster that went pop at `from` (its middle): each thing on its
  // way to where it lands. big: a boss's fountain.
  burst(rows, from, { big = false } = {}) {
    const list = (Array.isArray(rows) ? rows.slice(0, 40) : []).map(unpackLoot).filter(Boolean);
    list.forEach((d, i) => this.add(d, from, { i, big }));
    if (list.length && from && this.g.near(from.x, from.y, from.z, big ? 80 : 32)) this.g.sound.play('loot', { big, n: list.length });
    return list.length;
  }

  add(d, from, { i = 0, big = false } = {}) {
    if (this.items.has(d.id) || this.gone.has(d.id)) return;
    const model = lootModel(d.k);
    this.renderer.entities.add(model.group, model.shadow);
    const at = { x: d.x, y: d.y, z: d.z };
    const up = this.upAt(at);
    const world = this.g.nod ? null : this.g.world;
    const wet = Boolean(world) && world.get(Math.floor(at.x), Math.floor(at.y), Math.floor(at.z)) === B.WATER;
    const now = performance.now();
    const item = { ...d, at, up, wet, model, phase: Math.random() * Math.PI * 2, pos: { ...at } };
    if (from && [from.x, from.y, from.z].every(Number.isFinite)) {
      const far = dist3(from, at);
      item.fly = {
        from: { ...from },
        t0: now + i * (big ? BIG_STAGGER : STAGGER) * 1000,
        secs: (big ? 0.85 + Math.random() * 0.35 : 0.48 + Math.random() * 0.14) + far * 0.04,
        high: big ? 2.4 + Math.random() * 1.4 : 0.75 + Math.random() * 0.45,
      };
      model.group.visible = false;
      model.shadow.visible = false;
    } else item.readyAt = now;
    this.items.set(d.id, item);
  }

  // Someone got some (room.js giveLoot): { by (who picked it up, 0 for it
  // flying off by itself), got: [{ id, k, n, to }] }. Yours goes to you now;
  // you see it fly to you a moment later (and theirs to them).
  took(msg) {
    const g = this.g;
    if (!Array.isArray(msg.got)) return;
    const now = performance.now();
    for (const t of msg.got.slice(0, 120)) {
      const to = Array.isArray(t?.to) ? t.to.filter(Number.isInteger) : [];
      const mine = to.includes(g.pid);
      const k = typeof t?.k === 'string' ? t.k : '';
      const n = Number.isInteger(t?.n) && t.n > 0 ? Math.min(999, t.n) : 0;
      if (mine && k && n) g.lootGot(k, n);
      if (Number.isInteger(t?.id)) {
        this.gone.add(t.id);
        if (this.gone.size > 400) this.gone.delete(this.gone.values().next().value);
      }
      const item = this.items.get(t?.id);
      if (!item) {
        if (mine && k && n) g.lootShown(k, n, msg.by);
        continue;
      }
      // Off to whoever picked it up; or, flying off by itself, to you if it is
      // yours, or to the first of the others it is for.
      const pid = msg.by || (mine ? g.pid : (to.find((p) => g.players.get(p)?.avatar) ?? 0));
      item.take = { t0: now, from: { ...item.pos }, pid, shown: mine ? [k, n, msg.by] : null };
      item.fly = null;
    }
  }

  // Each frame: what is on its way out of a monster, lying about, being
  // asked for or flying off; and whatever is near enough to you, asked for.
  update(dt) {
    const g = this.g;
    if (!this.items.size) return;
    const now = performance.now();
    const t = now / 1000;
    const cam = this.renderer.camera.position;
    const me = g.me?.body;
    const free = Boolean(me) && !g.watching && !g.dizzy && !g.closed;
    const ask = [];
    for (const item of [...this.items.values()]) {
      const { model } = item;
      if (item.take) {
        if (this.flyOff(item, now)) continue;
      } else if (item.fly) {
        this.tumble(item, now);
      } else {
        this.rest(item, t, dt);
        if (free && now >= item.readyAt && now - (item.asked ?? -Infinity) > ASK_AGAIN_MS && this.inReach(item, me)) {
          item.asked = now;
          ask.push(item.id);
        }
        // Asked for: it leans in towards you, as the island says yes.
        const pull = item.asked && now - item.asked < ASK_AGAIN_MS && me ? ease(Math.min(1, (now - item.asked) / 160)) * 0.35 : 0;
        if (pull) {
          const up = g.nod ? g.nod.w.up : UP;
          const to = { x: me.x + up.x * CHEST, y: me.y + up.y * CHEST, z: me.z + up.z * CHEST };
          for (const a of ['x', 'y', 'z']) item.pos[a] += (to[a] - item.pos[a]) * pull;
        }
      }
      const p = item.pos;
      model.group.position.set(p.x, p.y, p.z);
      const far = Math.hypot(p.x - cam.x, p.y - cam.y, p.z - cam.z);
      const shown = (!item.fly || now >= item.fly.t0) && far < SEEN && !g.inFog?.(p.x, p.z);
      model.group.visible = shown;
      if (!shown) {
        model.shadow.visible = false;
        continue;
      }
      if (g.nod) {
        quatOf(item.up, flatUnit({ x: 0.3, y: 0.2, z: 0.9 }, item.up), model.group.quaternion);
        g.nod.blob(model.shadow, p, item.up, null, 0.9);
      } else if (item.wet) model.shadow.visible = false;
      else this.renderer.placeShadow(model.shadow, p.x, p.y, p.z, 0.9);
      // A glint now and then.
      if (!item.take && Math.random() < dt * (model.beam ? 1.6 : 0.8) && far < 40) {
        const s = model.look.size * 0.35;
        this.renderer.effects.add('sparkle', p.x + (Math.random() - 0.5) * s, p.y + (Math.random() - 0.3) * s, p.z + (Math.random() - 0.5) * s, { vy: 0.4, size: 0.1 + Math.random() * 0.1, life: 0.55, color: model.look.glow, spin: 4 });
      }
    }
    if (ask.length) g.send({ t: 'loot', ids: ask });
  }

  // Whether you are near enough to pick it up.
  inReach(item, me) {
    if (this.g.nod) return dist3(item.at, me) <= PICK_REACH + 0.5;
    const dy = item.at.y - me.y;
    return Math.hypot(item.at.x - me.x, item.at.z - me.z) <= PICK_REACH && dy >= PICK_HIGH[0] && dy <= PICK_HIGH[1];
  }

  // Out of the monster: up in an arc and down where it lands, then two little
  // bounces there; landed, it lies there.
  tumble(item, now) {
    const f = item.fly;
    const { at, up } = item;
    const hover = this.hover(item);
    const s = (now - f.t0) / 1000;
    const spin = item.model.spin;
    if (s < 0) {
      Object.assign(item.pos, f.from);
      return;
    }
    if (s < f.secs) {
      const k = s / f.secs;
      const h = f.high * 4 * k * (1 - k);
      for (const a of ['x', 'y', 'z']) item.pos[a] = f.from[a] + (at[a] + up[a] * hover - f.from[a]) * k + up[a] * h;
      spin.rotation.y += 0.25;
      return;
    }
    if (!f.landed) {
      f.landed = true;
      this.landed(item);
    }
    let left = s - f.secs;
    for (const [secs, high] of BOUNCES) {
      if (left < secs) {
        const k = left / secs;
        const h = high * 4 * k * (1 - k);
        for (const a of ['x', 'y', 'z']) item.pos[a] = at[a] + up[a] * (hover + h);
        spin.rotation.y += 0.12;
        return;
      }
      left -= secs;
    }
    item.fly = null;
    item.readyAt = now + READY_MS;
  }

  // Its first touch of the ground: a tink and a puff.
  landed(item) {
    const g = this.g;
    const { at } = item;
    if (!g.near(at.x, at.y, at.z, 24)) return;
    const fx = this.renderer.effects;
    if (item.wet) fx.splash(at.x, at.y, at.z);
    else fx.add('puff', at.x, at.y + 0.05, at.z, { size: 0.28, grow: 0.9, life: 0.35, color: '#ffffff' });
    // (Only so many tinks at once, however many come down.)
    const now = performance.now();
    if (now - (this.tinkAt ?? 0) > 70) {
      this.tinkAt = now;
      g.sound.play('tink', { k: item.k, wet: item.wet });
    }
  }

  // How high its middle is over where it lies: lower floating on the water.
  hover(item) {
    return item.model.look.hover * (item.wet ? 0.55 : 1);
  }

  // Lying there: spinning, bobbing, and its glow breathing.
  rest(item, t, dt) {
    const { at, up, model } = item;
    const bob = Math.sin(t * BOB_SPEED + item.phase) * (item.wet ? BOB * 0.6 : BOB);
    const high = this.hover(item) + bob;
    for (const a of ['x', 'y', 'z']) item.pos[a] = at[a] + up[a] * high;
    model.spin.rotation.y += dt * (item.wet ? SPIN * 0.5 : SPIN);
    if (item.wet) model.spin.rotation.z = Math.sin(t * 1.7 + item.phase) * 0.18;
    model.glow.scale.setScalar(model.look.size * (1 + 0.1 * Math.sin(t * 3.4 + item.phase)));
  }

  // Flying off to whoever got it, shrinking as it goes; there, it is gone
  // (with what it was shown, if it was yours). Says whether it is gone.
  flyOff(item, now) {
    const g = this.g;
    const k = Math.min(1, (now - item.take.t0) / 1000 / FLY_SECS);
    const who = item.take.pid ? (item.take.pid === g.pid ? g.me?.body : g.players.get(item.take.pid)?.avatar?.root.position) : null;
    const { from } = item.take;
    if (who) {
      const up = item.take.pid === g.pid && g.nod ? g.nod.w.up : this.upAt(who);
      const to = { x: who.x + up.x * CHEST, y: who.y + up.y * CHEST, z: who.z + up.z * CHEST };
      const e = ease(k);
      // (A little hop up on the way, as if snatched.)
      const hop = Math.sin(k * Math.PI) * 0.6;
      for (const a of ['x', 'y', 'z']) item.pos[a] = from[a] + (to[a] - from[a]) * e + item.up[a] * hop;
    }
    item.model.group.scale.setScalar(Math.max(0.05, 1 - k * 0.75));
    item.model.spin.rotation.y += 0.45;
    if (k < 1) return false;
    const p = item.pos;
    if (g.near(p.x, p.y, p.z, 30)) this.renderer.effects.sparkles(p.x, p.y, p.z, item.take.shown ? 10 : 5, [item.model.look.glow, '#ffffff', '#fff3a0']);
    if (item.take.shown) g.lootShown(...item.take.shown);
    this.drop(item.id);
    return true;
  }

  drop(id) {
    const item = this.items.get(id);
    if (!item) return;
    disposeLoot(item.model);
    this.items.delete(id);
  }

  clear() {
    for (const id of [...this.items.keys()]) this.drop(id);
  }
}
