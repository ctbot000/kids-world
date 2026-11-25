// Where the souls of the soul weapons are fought (duel.js): six little worlds, one
// to each (shared/souls.js), put together as the dreams of the Land of Nod are
// (maker.js) — a disc of night glass, a ring, a wild hill with standing stones, a
// great gong, a sheet of drawing paper, a bitten moon — with a circle of light let
// into each, and nothing on it but you and its soul.
import { Band, Body, Crate, Dot, Loop, Plate, v3 } from '../shape.js';
import { Maker } from '../maker.js';
import { SOULS, soulOf } from '../../souls.js';

const Y = v3(0, 1, 0);
// What its floor is made of (render/nod/skins.js rune).
const floor = (key, kind, r, look) => {
  const w = soulOf(key);
  return { skin: 'rune', look: { uGlow: w.color, uGlow2: w.glow, uR: r, uN: w.parts.length, uKind: kind, ...look } };
};
// Bits of it adrift in its sky.
const adrift = (list, opt) => list.map(([x, y, z, r], i) => new Body(`bit${i}`, new Dot(v3(x, y, z)), r, { cell: 0.8, ...opt }));
const BITS = [
  [-30, 9, -22, 3.4],
  [34, 15, -16, 2.6],
  [22, -14, 28, 4.2],
  [-26, -10, 26, 2.4],
  [6, 26, -38, 3],
];

// Begun, with its floor (and whatever is adrift): where you start, and its soul.
function begun(key, body, bits, seed, start, at) {
  const m = new Maker(`soul${key}`, [body, ...bits], seed);
  m.start = m.spot('floor', start, v3(0, 0, -1));
  m.boss = { body: 'floor', kind: `soul${key}`, at: m.spot('floor', at, v3(0, 0, 1)) };
  m.keep(m.start, 2.6);
  m.keep(m.boss.at, 3.4);
  return m;
}

const round = (n, r, turn = 0) => Array.from({ length: n }, (_, i) => v3(Math.sin(turn + (i / n) * Math.PI * 2) * r, 0, Math.cos(turn + (i / n) * Math.PI * 2) * r));

const MAKE = {
  // Night glass, with a star let into it.
  star() {
    const body = new Body('floor', new Plate(v3(0, 0, 0), Y, 12.5), 1.1, { cell: 0.4, ...floor('star', 0, 12.6, { uColor: '#0d1238', uColor2: '#24309a' }) });
    const m = begun('star', body, adrift(BITS, { skin: 'dusk', look: { uColor: '#141a4a', uColor2: '#2a3a9a', uGlow: '#ffd84d' } }), 0x57a1, v3(0, 2, 8.5), v3(0, 2, -5));
    for (const p of round(8, 11.4, Math.PI / 8)) m.put('starpost', m.spot('floor', v3(p.x, 2, p.z)), { k: 1, keep: 1 });
    m.scatter('spark', 'floor', 46, { ks: [0.5, 1.1], gap: 1.4, solid: false, only: (s) => s.up.y < 0.6 });
    return m;
  },
  // A ring of every colour, as her own is.
  rainbow() {
    const body = new Body('floor', new Loop(v3(0, 0, 0), Y, 11), 4.6, { cell: 0.5, ...floor('rainbow', 1, 11, { uColor: '#c9bfe0', uColor2: '#a99ad8' }) });
    const m = begun('rainbow', body, adrift(BITS, { skin: 'rune', look: { uKind: 1, uR: 400, uColor: '#c9bfe0', uColor2: '#a99ad8', uGlow: '#ff7ad9', uGlow2: '#7affd0' } }), 0x2a18, v3(0, 6, 11), v3(0, 6, -11));
    for (const p of round(7, 11)) m.put('prism', m.spot('floor', v3(p.x * 1.36, -1, p.z * 1.36)), { k: 1.2, keep: 1.4 });
    m.scatter('prism', 'floor', 16, { ks: [0.5, 0.9], gap: 3, only: (s) => s.up.y < 0.1 });
    return m;
  },
  // A wild hill, ringed with standing stones.
  wild() {
    const body = new Body('floor', new Dot(v3(0, -9, 0)), 11.5, { cell: 0.5, bumps: [{ c: v3(7, -16, 6), r: 3.4, k: 2.4 }, { c: v3(-8, -14, -5), r: 3, k: 2.4 }], ...floor('wild', 2, 6.4, { uColor: '#3f6a34', uColor2: '#6b5238' }) });
    const m = begun('wild', body, adrift(BITS, { skin: 'pot', look: { uColor: '#5a4630', uColor2: '#7a6248', uMoss: '#5fa83f' } }), 0x7d1d, v3(0, 10, 6), v3(0, 10, -5));
    for (const [i, p] of round(6, 8.2, 0.52).entries()) m.put('menhir', m.facing(m.spot('floor', v3(p.x, 8, p.z)), { x: 0, y: 2.5, z: 0 }), { k: i % 2 ? 1.1 : 1.3, keep: 2 });
    for (const p of round(5, 9.4, 0.2)) m.put('menhir', m.spot('floor', v3(p.x, -4, p.z)), { k: 1.05, keep: 2 });
    m.put('menhir', m.spot('floor', v3(1, -12, 1)), { k: 1.3, keep: 2 });
    m.scatter(['toadstool', 'daisy'], 'floor', 40, { ks: [0.6, 1.1], gap: 1.5, solid: false });
    m.scatter('pebble', 'floor', 14, { ks: [0.5, 0.9], gap: 2, solid: false });
    return m;
  },
  // A great gong, hung flat in the sky.
  bells() {
    const body = new Body('floor', new Plate(v3(0, 0, 0), Y, 11.6), 1.5, { cell: 0.4, bumps: [{ c: v3(0, -1.4, 0), r: 3, k: 1.8 }], ...floor('bells', 3, 12, { uColor: '#d9962c', uColor2: '#8a4f14' }) });
    const m = begun('bells', body, adrift(BITS, { skin: 'brass' }), 0xbe11, v3(0, 2, 8.5), v3(0, 2, -5));
    for (const p of round(8, 11.2, Math.PI / 8)) m.put('bell', m.spot('floor', v3(p.x, 2, p.z)), { k: 0.8, keep: 1.2 });
    return m;
  },
  // A sheet of drawing paper, as big as a field.
  toon() {
    const body = new Body('floor', new Crate(v3(0, 0, 0), v3(1, 0, 0), Y, 11, 0.15, 11), 0.75, { cell: 0.4, ...floor('toon', 4, 9.6, { uColor: '#dcd6c8', uColor2: '#c2b8a4' }) });
    const bits = [new Body('bit0', new Band(v3(-32, 8, -18), v3(0.3, 1, 0.1), 5, 1.4, 1), 0.5, { cell: 0.6, skin: 'satin', look: { uColor: '#ff5cb0', uColor2: '#ff9f3d', uGlow: '#fff3a0' } }), ...adrift(BITS.slice(1), { skin: 'plain', look: { uColor: '#3ad0ff', uColor2: '#8a6bff', uRough: 0.3, uFuzz: 0.1 } })];
    const m = begun('toon', body, bits, 0x700d, v3(0, 2, 8), v3(0, 2, -5));
    for (const [i, [x, z]] of [[-9.6, -9.6], [9.6, -9.6], [-9.6, 9.6], [9.6, 9.6], [0, -10.4], [10.4, 1], [-10.4, -1]].entries()) m.put('crayon', m.spot('floor', v3(x, 2, z)), { k: 1 + (i % 3) * 0.2, keep: 1.4 });
    m.scatter('pin', 'floor', 8, { ks: [0.7, 1], gap: 3, only: (s) => s.up.y < -0.8 });
    return m;
  },
  // A moon with a bite out of it.
  nod() {
    const body = new Body('floor', new Dot(v3(0, -9, 0)), 11.5, {
      cell: 0.5,
      bumps: [
        { c: v3(13, -13, 3), r: 6.4, k: 1.6, cut: true },
        { c: v3(-7, -1.6, -6), r: 2.2, k: 1.6, cut: true },
        { c: v3(6, -2.6, 8.4), r: 1.8, k: 1.4, cut: true },
        { c: v3(-9, -11, 7), r: 3, k: 1.8, cut: true },
        { c: v3(-3, -19, -5), r: 3, k: 1.8, cut: true },
      ],
      ...floor('nod', 5, 6.4, { uColor: '#8f84c9', uColor2: '#5a4f9a' }),
    });
    const m = begun('nod', body, adrift(BITS, { skin: 'rune', look: { uKind: 5, uR: 400, uColor: '#8f84c9', uColor2: '#5a4f9a', uGlow: '#b98cff', uGlow2: '#e6e0ff' } }), 0x40d1, v3(0, 10, 6), v3(0, 10, -5));
    m.scatter('pebble', 'floor', 26, { ks: [0.4, 1], gap: 2, solid: false });
    m.scatter('spark', 'floor', 30, { ks: [0.5, 1], gap: 1.6, solid: false });
    return m;
  },
};

// Their keys, as dreams have theirs.
export const ARENA_KEYS = SOULS.map((w) => `soul${w.key}`);
export const ARENAS = Object.fromEntries(SOULS.map((w) => [`soul${w.key}`, () => MAKE[w.key]().done()]));
