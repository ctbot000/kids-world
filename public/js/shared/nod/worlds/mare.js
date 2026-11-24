// The Dark Side: the last dream of the Land of Nod, the one nobody wants — one
// little warm moon with a night-light on it, and all round it in the dark a
// broken moon, a ribbon of night with one side only, a bed as big as a house
// with something under it; and over it all the Night Mare's own black moon.
import { Band, Block, Body, Crate, Dot, v3 } from '../shape.js';
import { Maker } from '../maker.js';

export function mare() {
  const bodies = [
    new Body('light', new Dot(v3(0, 0, 0)), 8.6, { skin: 'plain', look: { uColor: '#c98fa8', uColor2: '#8f78c9', uRough: 0.95, uFuzz: 1 }, bumps: [{ c: v3(-5, -6, 4), r: 2.8, k: 2.4 }] }),
    new Body('ribbon', new Band(v3(-40, 8, -6), v3(0.3, 1, 0.1), 16, 4, 0.5), 0.8, { skin: 'satin', cell: 0.4 }),
    new Body('bed', new Crate(v3(36, 0, 10), v3(1, 0, 0.1), v3(0.06, 1, 0), 7.5, 0.4, 12), 1.9, { skin: 'quilt', cell: 0.5, look: { uPatch: 3.4, uCloth: ['#4a3f7a', '#5f4f9a', '#37305f', '#6a4a8f', '#453a78', '#7a5fa8'], uThread: '#c9b8f2' } }),
    new Body('broken', new Dot(v3(4, 12, -48)), 13, {
      skin: 'dusk',
      cell: 0.5,
      // Cracked right across, and a bite gone out of it.
      bumps: [
        { a: v3(-12, 24, -40), b: v3(20, 4, -34), r: 1.5, k: 0.9, cut: true },
        { a: v3(4, 28, -50), b: v3(18, 10, -60), r: 1.4, k: 0.9, cut: true },
        { a: v3(-10, 8, -56), b: v3(6, -4, -42), r: 1.4, k: 0.9, cut: true },
        { c: v3(-9, 22, -58), r: 5.5, k: 1.6, cut: true },
        { c: v3(19, 20, -46), r: 3, k: 1.2 },
        { c: v3(2, -3, -52), r: 3.4, k: 1.6 },
      ],
    }),
    new Body('crumb', new Dot(v3(-18, -10, 30)), 6, { skin: 'dusk', look: { uGlow: '#5fa8ff' }, bumps: [{ c: v3(-22, -6, 27), r: 2.4, k: 1.2 }] }),
    new Body('crumb2', new Dot(v3(22, 30, -14)), 4.6, { skin: 'dusk', look: { uGlow: '#ff6fc0' }, bumps: [{ c: v3(25, 33, -16), r: 1.8, k: 1 }] }),
    new Body('moon', new Dot(v3(0, 54, 2)), 14.5, { skin: 'dusk', cell: 0.55, look: { uColor: '#1d1833', uColor2: '#332a5a', uGlow: '#8f5cff' }, bumps: [{ c: v3(10, 63, 10), r: 3, k: 2.4, cut: true }, { c: v3(-12.3, 47.3, 9.8), r: 3.2, k: 2.4, cut: true }, { c: v3(2, 41, -9), r: 3, k: 2.2, cut: true }] }),
  ];
  // The bed's headboard and foot, and its four posts.
  const bed = bodies[2];
  bed.addProp(new Block(v3(36.2, 4.4, -4.4), v3(1, 0, 0.1), v3(0.06, 1, 0), v3(8.4, 5.4, 0.35), 0.35));
  bed.addProp(new Block(v3(35, 1.8, 24.2), v3(1, 0, 0.1), v3(0.06, 1, 0), v3(8.4, 2.8, 0.35), 0.35));
  const m = new Maker('mare', bodies, 0x5ee);
  const light = m.body('light');
  m.start = m.spot(light, v3(0, 7, 5.5), v3(0, 0, -1));
  m.keep(m.start, 2.4);
  m.hub = m.put('nightlight', m.spot(light, v3(0, 9, -0.5), v3(0, 0, 1)), { keep: 2.8 });
  const pad = (key, off, face = null) => m.spot(key, off, face);
  m.spring(pad(light, v3(-7, 4.4, 0.6), v3(1, 0.6, 0)), pad('ribbon', v3(17, 2, 6), v3(-0.3, 0, -1)));
  m.spring(pad(light, v3(7, 4.4, 1.4), v3(-1, 0.6, 0)), pad('bed', v3(-6.5, 5, 6), v3(0.8, 0, -0.2)));
  m.spring(pad(light, v3(0.6, 4.4, -7), v3(0, 0.6, 1)), pad('broken', v3(-2, -5, 13), v3(0, 0.8, 0.3)));
  m.spring(pad(light, v3(-4.6, 4, 6), v3(0.5, 0.6, -0.5)), pad('crumb', v3(4, 3, -4), v3(-0.3, 0.6, 0.4)));
  m.spring(pad('crumb', v3(-3, 5, 0), v3(0.6, 0, 0)), pad('ribbon', v3(12, -4, 14), v3(-0.6, 0, -0.5)));
  m.spring(pad('bed', v3(4, 4, -9), v3(-0.3, 0, 1)), pad('crumb2', v3(1, -4, 3), v3(0, 0.6, 0.4)));
  m.spring(pad('crumb2', v3(-3, 3, -3), v3(0.4, 0.4, 0.4)), pad('broken', v3(10, 9, 6), v3(-0.4, -0.2, 0.3)));
  m.spring(pad(light, v3(5.2, 5.4, -4.6), v3(-0.6, 0.6, 0.6)), pad('moon', v3(2, -14, 4), v3(0, 0.2, 1)), { need: 'boss' });
  m.nightmares.push(
    { id: 1, body: 'ribbon', at: m.spot('ribbon', v3(-16, 3, -2)), waves: [[['inkling', 6]], [['twin', 1], ['inkling', 3]], [['twin', 2]], [['twin', 2], ['inkling', 4]]] },
    { id: 2, body: 'bed', at: m.spot('bed', v3(0, -5, 2)), waves: [[['grabber', 2], ['inkling', 2]], [['inkling', 4], ['grabber', 2]], [['grabber', 2], ['nightmoth', 2]], [['grabber', 2], ['twin', 1], ['nightmoth', 1]]] },
    { id: 3, body: 'broken', at: m.spot('broken', v3(4, 12, 6)), waves: [[['watcher', 1], ['inkling', 4]], [['nightmoth', 3]], [['watcher', 2], ['inkling', 3]], [['watcher', 1], ['nightmoth', 2], ['twin', 1]]] },
  );
  m.boss = { body: 'moon', kind: 'mare', at: m.spot('moon', v3(0, 14, 0), v3(0, 0, 1)), lights: [v3(1, 0.5, 0.2), v3(-0.6, 0.4, 0.9), v3(-0.3, 0.1, -1)].map((d) => m.spot('moon', v3(d.x * 14, d.y * 14, d.z * 14))) };
  for (const n of m.nightmares) m.keep(n.at, 2.6);
  for (let i = 0; i < 4; i++) {
    const a = -1.05 + i * 0.7;
    m.put('lamp', m.facing(m.spot(light, v3(Math.sin(a) * 4.4, 8, -0.5 + Math.cos(a) * 3.6)), m.hub), { lamp: i + 1, keep: 1 });
  }
  m.roam.push({ body: 'crumb', kinds: [['inkling', 3]] }, { body: 'crumb2', kinds: [['nightmoth', 1]] });
  // ------- what stands about
  for (const [x, z] of [[-9, -14.4], [9, -14.4], [-9, 14.4], [9, 14.4]]) m.put('bedpost', m.spot('bed', v3(x * 0.92, 4, z * 0.96)), { keep: 1.4, k: 1.2 });
  for (const l of m.boss.lights) m.put('lantern', l, { keep: 3 });
  m.scatter('shard', 'broken', 12, { ks: [0.8, 1.6], gap: 3.2 });
  m.scatter('shard', 'crumb', 5, { ks: [0.6, 1], gap: 2.6 });
  m.scatter('shard', 'crumb2', 4, { ks: [0.5, 0.9], gap: 2.4 });
  m.scatter('shard', 'moon', 9, { ks: [0.8, 1.5], gap: 5.5 });
  m.scatter('cushion', 'bed', 5, { ks: [1.1, 1.6], gap: 4.4, only: (s) => s.up.y > 0.8 });
  m.scatter('book', 'bed', 4, { ks: [0.8, 1.1], gap: 4, only: (s) => s.up.y < -0.8 });
  m.scatter(['tuft', 'felt'], 'light', 40, { ks: [0.7, 1.2], gap: 0.9, solid: false });
  for (const key of ['ribbon', 'broken', 'moon', 'crumb', 'crumb2']) m.scatter('spark', key, key === 'moon' ? 40 : 22, { ks: [0.6, 1.3], gap: 1.2, solid: false });
  // ------- forty winks
  const row = (key, off, dir, n, gap = 1.6) => m.winkRow(m.spot(key, off), dir, n, gap);
  row('light', v3(0, -8, 3), v3(1, 0, 0.4), 6);
  row('ribbon', v3(0, 3, 16), v3(1, 0, 0), 7, 2.2);
  row('ribbon', v3(0, -2, -16), v3(-1, 0, 0), 6, 2.2);
  row('bed', v3(0, -4, -8), v3(0, 0, 1), 7, 2);
  row('broken', v3(-13, -2, 2), v3(0, -0.8, 0.4), 7);
  row('crumb', v3(0, -6, 2), v3(1, 0, 0), 4);
  row('crumb2', v3(0, 4, 3), v3(1, 0.2, 0), 3);
  return m.done();
}
