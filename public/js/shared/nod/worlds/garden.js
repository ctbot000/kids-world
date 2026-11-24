// Pumpkin Skies: the second dream of the Land of Nod, the Gardener's — a flower
// pot in a bright sky, a beanstalk winding up out of it to walk all round, a pea
// pod, an apple, a snail's shell and a toadstool's cap, and over it all a pumpkin
// as big as a hill, with something munching on it.
import { Body, Chain, Dot, Plate, v3 } from '../shape.js';
import { Maker } from '../maker.js';

export function garden() {
  // The beanstalk, up and round from the pot.
  const stalk = [];
  for (let i = 0; i <= 30; i++) {
    const a = -2.5 + i * 0.36;
    const R = 8.6 + i * 0.26 + Math.sin(i * 0.7) * 1.2;
    stalk.push(v3(Math.cos(a) * R, 4 + i * 1.35, Math.sin(a) * R));
  }
  const leafAt = (i, out) => {
    const p = stalk[i];
    const l = Math.hypot(p.x, p.z);
    return v3(p.x + (p.x / l) * out, p.y + 0.4, p.z + (p.z / l) * out);
  };
  // A snail's shell, wound up on itself.
  const coil = [];
  const thick = [];
  for (let i = 0; i <= 34; i++) {
    const t = i * 0.42;
    const r = 12 * Math.exp(-0.125 * t);
    coil.push(v3(6 + Math.cos(t) * r, 6 + Math.sin(t) * r, -46 + (1 - Math.exp(-0.125 * t)) * 5));
    thick.push(Math.exp(-0.125 * t));
  }
  const bodies = [
    new Body('pot', new Chain([v3(0, -9, 0), v3(0, 0, 0)], [0.72, 1.06]), 8.4, {
      skin: 'pot',
      cell: 0.5,
      // Its rim, round under the soil heaped up in it.
      ripple: (x, y) => (y > 0.6 && y < 3.4 ? 0.7 * Math.min(1, (y - 0.6) * 3, (3.4 - y) * 3) : y >= 3.4 ? -0.35 : 0),
    }),
    new Body('stalk', new Chain(stalk, stalk.map((_, i) => 1.15 - i * 0.012)), 1.35, { skin: 'plant', cell: 0.5, look: { uColor: '#79c442', uColor2: '#4f9a30', uVeins: 0 }, axis: v3(0, 1, 0) }),
    ...[[8, 4.6, 0.3], [17, 4.6, -0.25], [25, 4.8, 0.2]].map(([i, out, tilt], n) => new Body(`leaf${n + 1}`, new Plate(leafAt(i, out), v3(tilt, 1, -tilt * 0.6), 4.6), 0.5, { skin: 'plant', cell: 0.34, look: { uColor: '#8fd64f', uColor2: '#5fae38', uVein: '#d3f09a', uVeins: 1 } })),
    new Body('pod', new Chain([v3(30, 1, 12), v3(38, -2, 20), v3(48, -3, 24), v3(58, 0, 23)], [0.6, 1, 1, 0.6]), 4.4, {
      skin: 'plant',
      look: { uColor: '#8ccf4a', uColor2: '#5fa834', uVeins: 0 },
      axis: v3(0.9, 0, 0.3),
      bumps: [0, 1, 2, 3, 4].map((i) => ({ c: v3(34 + i * 5.2, 2.6 - Math.sin((i / 4) * Math.PI) * 2.4, 15.5 + Math.sin((i / 4) * 2.2) * 8), r: 2.5 + Math.sin((i / 4) * Math.PI) * 0.7, k: 0.9 })),
    }),
    new Body('apple', new Dot(v3(-38, 8, -4)), 10.6, {
      skin: 'apple',
      look: { uR: 10.6 },
      ripple: (x, y, z) => {
        const d = Math.hypot(x + 38, y - 8, z + 4) || 1;
        const c = (y - 8) / d;
        const top = Math.max(0, c - 0.62) / 0.38;
        const low = Math.max(0, -c - 0.72) / 0.28;
        return 0.5 * (1 - c * c) - 3 * top * top * (3 - 2 * top) - 1.6 * low * low * (3 - 2 * low) + (c < 0 ? -0.5 * c * c : 0);
      },
      bumps: [{ a: v3(-38, 14, -4), b: v3(-36.8, 20.5, -3.2), r: 0.7, rb: 0.9, k: 0.8 }, { c: v3(-30, 13.5, -10.5), r: 2.4, k: 0.7, cut: true }],
    }),
    new Body('snail', new Chain(coil, thick), 6.4, { skin: 'shell', cell: 0.5, axis: v3(0, 0, 1) }),
    new Body('toad', new Plate(v3(-20, -8, 34), v3(0.16, 1, 0.1), 6.4), 2.6, {
      skin: 'cap',
      bumps: [{ a: v3(-20, -10, 34), b: v3(-21.5, -19, 33), r: 2.2, rb: 2.8, k: 1.4 }],
    }),
    // Overhead: the pumpkin, and whoever is eating it.
    new Body('pumpkin', new Dot(v3(-4, 64, -6)), 13, {
      skin: 'rind',
      cell: 0.5,
      look: { uRibs: 12 },
      ripple: (x, y, z) => {
        const px = x + 4;
        const py = y - 64;
        const pz = z + 6;
        const d = Math.hypot(px, py, pz) || 1;
        const c = py / d;
        const ring = Math.sqrt(Math.max(0, 1 - c * c));
        const rib = Math.abs(Math.sin(Math.atan2(pz, px) * 6));
        return (Math.min(1, rib * 1.6) - 1) * 0.75 * ring - 1.9 * c * c * c * c;
      },
      bumps: [{ a: v3(-4, 74, -6), b: v3(-2.6, 79.5, -5), r: 1.5, rb: 1.1, k: 1.2 }],
    }),
  ];
  const m = new Maker('garden', bodies, 0x6a2);
  const pot = m.body('pot');
  m.start = m.spot(pot, v3(1.5, 8, 5.2), v3(-0.2, 0, -1));
  m.keep(m.start, 2.5);
  m.hub = m.put('nightlight', m.spot(pot, v3(0, 9, -0.4), v3(0.1, 0, 1)), { keep: 2.6, k: 0.9 });
  const pad = (key, off, face = null) => m.spot(key, off, face);
  m.spring(pad(pot, v3(6, 6.5, 2), v3(-1, 0.6, 0)), pad('pod', v3(-10, 5, -5), v3(1, 0.1, 0.4)));
  m.spring(pad(pot, v3(-5.6, 6.5, 2.2), v3(1, 0.6, 0)), pad('apple', v3(11, 3, 6), v3(-0.4, 0.6, 0.6)));
  m.spring(pad(pot, v3(1.4, 6.5, -6), v3(0, 0.6, 1)), pad('snail', v3(4, -10, 15), v3(0, 0.6, 0.5)));
  m.spring(pad(pot, v3(-2.6, 6, 6.2), v3(0.4, 0.6, -0.6)), pad('toad', v3(4, 5, -4), v3(-0.4, 0, 1)));
  m.spring(pad('toad', v3(-4.5, 5, -2.5), v3(0.6, 0, 0.6)), pad('apple', v3(2, -11, 8), v3(0.2, 0.4, -0.7)));
  m.spring(pad('pod', v3(10, 5, -3)), pad('snail', v3(12, -4, 8)), { face: true });
  // (The boss's: from the pot, and from the top of the beanstalk too.)
  m.spring(pad(pot, v3(5, 6.8, -3.6), v3(-0.6, 0.6, 0.6)), pad('pumpkin', v3(5, -13, 6), v3(0, 0.4, 1)), { need: 'boss' });
  m.nightmares.push(
    { id: 1, body: 'pod', at: m.spot('pod', v3(0, 8, 0)), waves: [[['aphid', 6]], [['weevil', 2]], [['weevil', 1], ['aphid', 5]], [['weevil', 2], ['spitter', 1]]] },
    { id: 2, body: 'apple', at: m.spot('apple', v3(2, 5, 10)), waves: [[['snaptrap', 2]], [['spitter', 2], ['aphid', 3]], [['snaptrap', 2], ['spitter', 1]]] },
    { id: 3, body: 'snail', at: m.spot('snail', v3(-6, 10, 9)), waves: [[['hopper', 1], ['aphid', 4]], [['hopper', 2]], [['weevil', 1], ['spitter', 1], ['snaptrap', 1]], [['hopper', 2], ['weevil', 1]]] },
  );
  m.boss = { body: 'pumpkin', kind: 'munch', at: m.spot('pumpkin', v3(0, 8, 10), v3(1, 0, 0)) };
  for (const n of m.nightmares) m.keep(n.at, 2.5);
  for (let i = 0; i < 4; i++) {
    const a = -1.15 + i * 0.77;
    m.put('lamp', m.facing(m.spot(pot, v3(Math.sin(a) * 4.2, 8, -0.4 + Math.cos(a) * 3.4)), m.hub), { lamp: i + 1, keep: 1, k: 0.9 });
  }
  m.roam.push({ body: 'toad', kinds: [['aphid', 4]] }, { body: 'stalk', kinds: [['aphid', 3]] });
  // ------- what grows about
  const soil = (s) => s.up.y > 0.5 && s.y > 4;
  m.scatter(['toadstool', 'sprout'], 'pot', 9, { ks: [0.8, 1.3], gap: 1.5, only: soil });
  m.scatter(['blade', 'blade', 'daisy', 'clover'], 'pot', 60, { ks: [0.7, 1.2], gap: 0.6, only: soil, solid: false });
  m.scatter(['pebble'], 'pot', 5, { ks: [0.5, 0.9], gap: 1.6, only: soil });
  m.scatter(['mushroom'], 'toad', 3, { ks: [0.9, 1.3], gap: 3.4, only: (s) => s.up.y > 0.8 });
  m.scatter(['toadstool', 'daisy', 'blade'], 'toad', 26, { ks: [0.7, 1.2], gap: 1.1, solid: false, only: (s) => s.up.y > 0.6 });
  m.scatter(['dew'], 'apple', 26, { ks: [0.5, 1.3], gap: 1, solid: false });
  m.scatter(['stone', 'mushroom'], 'apple', 7, { ks: [0.8, 1.2], gap: 3.6 });
  m.scatter(['dew', 'clover'], 'pod', 26, { ks: [0.5, 1.1], gap: 1, solid: false });
  m.scatter(['stone', 'toadstool'], 'pod', 8, { ks: [0.9, 1.4], gap: 3 });
  m.scatter(['mushroom', 'toadstool', 'stone'], 'snail', 11, { ks: [0.8, 1.3], gap: 3.4 });
  m.scatter(['blade', 'daisy', 'clover'], 'snail', 40, { ks: [0.6, 1.1], gap: 0.9, solid: false });
  m.scatter('tendril', 'stalk', 22, { ks: [0.8, 1.4], gap: 1.6, solid: false });
  for (let i = 1; i <= 3; i++) m.scatter(['dew', 'daisy'], `leaf${i}`, 8, { ks: [0.6, 1], gap: 1, solid: false });
  m.scatter('dew', 'pumpkin', 34, { ks: [0.6, 1.5], gap: 1.2, solid: false });
  m.scatter('tendril', 'pumpkin', 16, { ks: [1, 1.7], gap: 2.4, solid: false });
  // ------- forty winks
  const row = (key, off, dir, n, gap = 1.6) => m.winkRow(m.spot(key, off), dir, n, gap);
  row('stalk', v3(8, -18, 4), v3(0, 1, 0.5), 6, 2);
  row('stalk', v3(-10, 4, -6), v3(0, 1, 0), 6, 2);
  for (let i = 1; i <= 3; i++) row(`leaf${i}`, v3(0, 1, 0), v3(1, 0, 0.4), 2);
  row('pod', v3(-4, -6, 2), v3(1, 0, 0.3), 6);
  row('apple', v3(-11, 0, 0), v3(0, 1, 0.3), 6);
  row('snail', v3(10, 8, 6), v3(-0.4, 0.8, 0), 6);
  row('toad', v3(0, -6, 6), v3(1, 0, 0.2), 4);
  m.hideChests();
  return m.done();
}
