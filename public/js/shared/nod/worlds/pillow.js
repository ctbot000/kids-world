// Pillow Moons: the first dream of the Land of Nod, the Shepherd's — little
// round moons of patchwork, a bolster as long as a ship, a doughnut of a
// cushion, buttons as big as ponds, all hung in a lavender dusk over a great
// soft pillow with a night-light on it, where everyone arrives.
import { Body, Chain, Crate, Dot, Loop, v3 } from '../shape.js';
import { Maker } from '../maker.js';

export function pillow() {
  const bodies = [
    new Body('cradle', new Crate(v3(0, 0, 0), v3(1, 0, 0), v3(0, 1, 0), 7.5, 0.5, 6), 3.1, {
      skin: 'quilt',
      cell: 0.5,
      look: { uPatch: 3.2 },
      // Plump in the middle, a little pinched at its corners.
      ripple: (x, y, z) => 0.55 * Math.cos(Math.min(1.5, Math.abs(x) / 8)) * Math.cos(Math.min(1.5, Math.abs(z) / 7)) - 0.0035 * Math.abs(x * z),
    }),
    new Body('button', new Dot(v3(34, 5, -10)), 8.5, {
      skin: 'plain',
      look: { uColor: '#f3a9bd', uColor2: '#f7c3cf', uRough: 0.9, uFuzz: 0.9 },
      bumps: [
        { c: v3(37, -4.5, -13), r: 3, k: 2.6 },
        { c: v3(28, 8, -17), r: 2.4, k: 2.2 },
      ],
    }),
    new Body('bolster', new Chain([v3(26, -12, 30), v3(40, -9, 40), v3(55, -12, 44)]), 4.8, {
      skin: 'cord',
      look: { uColor: '#86a6ea', uColor2: '#b6a7f0', uWale: 4.6 },
      axis: v3(0.87, 0, 0.45),
      // Tied up tight at both ends, as a bolster is.
      bumps: [
        { c: v3(22.5, -13, 27.5), r: 2.4, k: 1.2 },
        { c: v3(59.5, -13, 45), r: 2.4, k: 1.2 },
      ],
    }),
    new Body('donut', new Loop(v3(-34, 4, 8), v3(0.28, 1, 0.12), 10.5), 4.3, {
      skin: 'knit',
      look: { uWool: ['#f58fa8', '#fff3e2', '#8fc7ee', '#fff3e2'], uRow: 1.9 },
    }),
    new Body('twins', new Chain([v3(-26, 16, -28), v3(-17, 19, -36), v3(-9, 22, -44)], [1.2, 0.45, 0.95]), 6, {
      skin: 'quilt',
      look: { uPatch: 2.2, uCloth: ['#a9d8a0', '#f4d27c', '#8fd0de', '#f2a884', '#dcecb0', '#b79ce6'] },
    }),
    new Body('moon', new Dot(v3(22, 24, -42)), 13, {
      skin: 'quilt',
      look: { uPatch: 3.6, uCloth: ['#7f9cf0', '#d99aea', '#f9cf8c', '#86d3dc', '#f29ab4', '#cfc6ff'] },
      bumps: [
        { c: v3(22, 38, -42), r: 3.4, k: 3 },
        { c: v3(33, 28, -50), r: 3.6, k: 3 },
        { c: v3(13, 22, -52.5), r: 3.2, k: 3 },
        { c: v3(26, 13, -35), r: 3.4, k: 3 },
        { c: v3(10.8, 26.8, -33), r: 3, k: 2, cut: true },
      ],
    }),
    // Overhead, where the last of them waits.
    new Body('ram', new Dot(v3(2, 48, 4)), 12, {
      skin: 'plain',
      look: { uColor: '#7d72c9', uColor2: '#a99be6', uRough: 0.95, uFuzz: 1 },
    }),
  ];
  const m = new Maker('pillow', bodies, 0x9c1);
  const top = v3(0, 1, 0);
  const cradle = m.body('cradle');
  m.start = m.spot(cradle, v3(0, 6, 5), v3(0, 0, -1));
  m.keep(m.start, 3);
  m.hub = m.put('nightlight', m.spot(cradle, v3(0, 6, -1), v3(0, 0, 1)), { keep: 3 });
  // ------- the springs
  const pad = (key, off, face = null) => m.spot(key, off, face);
  const cB = pad(cradle, v3(7.6, 5, -3.5), v3(-1, 0, 0.3));
  const cD = pad(cradle, v3(-7.6, 5, -1), v3(1, 0, 0.1));
  const cL = pad(cradle, v3(6.2, 5, 5.6), v3(-0.7, 0, -0.5));
  const cT = pad(cradle, v3(-4.6, 5, -6.2), v3(0.4, 0, 1));
  const cR = pad(cradle, v3(3.4, 6, -6), v3(-0.3, 0, 1));
  m.spring(cB, pad('button', v3(-7, 3.5, 4), v3(0.4, 0.8, -0.2)));
  m.spring(cD, pad('donut', v3(13, 1, -4), v3(-0.3, 0.4, -1)));
  m.spring(cL, pad('bolster', v3(-13, 3.5, -8), v3(0.8, 0.1, 0.5)));
  m.spring(cT, pad('twins', v3(-5, -2, 9), v3(0, 0.6, 0.2)));
  m.spring(pad('button', v3(-2, 6, -7), v3(0, 0.4, 0.8)), pad('moon', v3(5, -11, 6), v3(0.1, 0.5, 1)));
  m.spring(pad('twins', v3(9.5, 4, -4), v3(-0.4, 0.6, 0.4)), pad('moon', v3(-12, 3, 4), v3(0.2, 0.8, -0.3)));
  m.spring(cR, pad('ram', v3(0, -12, 3), v3(0, 0, 1)), { need: 'boss' });
  // ------- what is to be fought
  m.nightmares.push(
    { id: 1, body: 'bolster', at: m.spot('bolster', v3(0.5, 6, -1)), waves: [[['bunny', 5]], [['ram', 1], ['bunny', 3]], [['ram', 2]], [['ram', 2], ['bunny', 4]]] },
    { id: 2, body: 'donut', at: m.spot('donut', v3(-13, 2, 4)), waves: [[['thimble', 2]], [['moth', 3]], [['thimble', 2], ['moth', 2]]] },
    { id: 3, body: 'moon', at: m.spot('moon', v3(-2, 10, 12)), waves: [[['moth', 2], ['bunny', 5]], [['ram', 1], ['thimble', 2]], [['alarm', 1], ['bunny', 4]], [['ram', 1], ['thimble', 1], ['moth', 2]]] },
  );
  m.boss = { body: 'ram', kind: 'rambunctious', at: m.spot('ram', v3(0, 12, 0), v3(0, 0, 1)) };
  for (const n of m.nightmares) m.keep(n.at, 2.5);
  // The lamps round the night-light, one for each, and the last for the ram.
  for (let i = 0; i < 4; i++) {
    const a = -0.95 + i * 0.63;
    m.put('lamp', m.facing(m.spot(cradle, v3(Math.sin(a) * 4.4, 6, -1 + Math.cos(a) * 3.4)), m.hub), { lamp: i + 1, keep: 1 });
  }
  // ------- who is about
  m.roam.push({ body: 'button', kinds: [['bunny', 3], ['moth', 1]] }, { body: 'twins', kinds: [['bunny', 2], ['thimble', 1]] });
  // ------- what stands about
  for (const [x, z] of [[-6.8, -5.6], [6.9, -5.4], [-6.8, 5.4], [6.6, 5.3]]) m.put('tassel', m.spot(cradle, v3(x * 1.5, 0.1, z * 1.5), v3(x, 0, z)), { solid: false, k: 1.2 });
  m.put('button', m.spot('button', v3(0, 1, 0.15)), { k: 2.4, keep: 1.8 });
  // The ram's posts, to be bumped into.
  for (const [x, y, z] of [[1, 0.25, 0.2], [-1, 0.2, 0.3], [0.15, 0.1, 1], [-0.1, 0.3, -1], [0.5, 0.95, -0.2], [-0.45, -0.75, 0.5], [0.5, -0.7, -0.6]]) m.put('post', m.spot('ram', v3(x * 12, y * 12, z * 12)), { keep: 1.6 });
  m.scatter('cushion', 'cradle', 5, { ks: [0.7, 1.1], gap: 2.6, only: (s) => s.up.y > 0.9 });
  m.scatter(['button', 'pin'], 'button', 8, { ks: [0.5, 1], gap: 2.6 });
  m.scatter('cushion', 'bolster', 5, { ks: [0.8, 1.2], gap: 3.4 });
  m.scatter(['cushion', 'pin'], 'donut', 9, { ks: [0.7, 1.1], gap: 3.2 });
  m.scatter(['button', 'cushion', 'pin'], 'twins', 9, { ks: [0.6, 1.1], gap: 2.8 });
  m.scatter(['cushion', 'book', 'button'], 'moon', 14, { ks: [0.8, 1.3], gap: 3.4 });
  for (const key of ['cradle', 'button', 'bolster', 'donut', 'twins', 'moon']) m.scatter(['tuft', 'tuft', 'felt', 'felt'], key, key === 'moon' ? 70 : 40, { ks: [0.7, 1.3], gap: 0.9, solid: false });
  m.scatter('tuft', 'ram', 60, { ks: [0.8, 1.6], gap: 1, solid: false });
  // ------- forty winks
  const row = (key, off, dir, n) => m.winkRow(m.spot(key, off), dir, n);
  row('cradle', v3(-3.2, 5, 1.9), v3(1, 0, 0), 5);
  row('cradle', v3(0, -6, -3), v3(0, 0, 1), 4);
  row('button', v3(0, 2, 9), v3(0, 1, 0), 6);
  row('bolster', v3(-9, -5, -6), v3(0.8, 0, 0.5), 6);
  row('donut', v3(-6, 0, 0), v3(0, 1, 0), 6);
  row('twins', v3(0, -2, 0), v3(0.6, 0.2, -0.5), 5);
  row('moon', v3(-13, 0, 0), v3(0, -1, 0.2), 8);
  m.hideChests();
  return m.done();
}
