// The Music Box: the third dream of the Land of Nod, the Fiddler's — a drum to
// land on, a gramophone record as wide as a field with two sides to it, the
// barrel of a music box to run round the inside of, a ring of piano keys, a
// trumpet and a cymbal, all lit like a stage, and high over them a podium.
import { Body, Can, Chain, Loop, Plate, v3 } from '../shape.js';
import { Maker } from '../maker.js';

export function music() {
  const bodies = [
    new Body('drum', new Plate(v3(0, 0, 0), v3(0, 1, 0), 8), 3, { skin: 'drum', cell: 0.45, look: { uR: 8 } }),
    new Body('record', new Plate(v3(40, 4, -8), v3(0.24, 1, 0.12), 15.5), 0.9, { skin: 'vinyl', cell: 0.42, look: { uR: 15.5 } }),
    new Body('barrel', new Can(v3(-44, 4, 2), v3(1, 0.05, 0.3), 12, 15), 1.3, { skin: 'brass', cell: 0.55, look: { uColor: '#e0aa4a', uDark: '#6e4a1c' } }),
    new Body('keys', new Loop(v3(4, 14, -46), v3(0.12, 0.35, 1), 14), 4, { skin: 'keys', cell: 0.5, look: { uR: 14 } }),
    new Body('horn', new Chain([v3(-10, -16, 30), v3(0, -13, 36), v3(12, -11, 40), v3(22, -11, 41), v3(29, -12, 41)], [0.42, 0.45, 0.55, 0.85, 1.75]), 4, { skin: 'brass', axis: v3(1, 0, 0.2), look: { uColor: '#f0c04a', uDark: '#8a5c1c', uEngrave: 0 } }),
    new Body('cymbal', new Plate(v3(30, 26, 22), v3(-0.25, 1, 0.2), 8.5), 0.45, { skin: 'brass', cell: 0.36, look: { uColor: '#f2cc62', uDark: '#8a6220', uEngrave: 0 }, bumps: [{ c: v3(30, 26.2, 22), r: 2.2, k: 1.2 }] }),
    new Body('podium', new Plate(v3(0, 46, 0), v3(0, 1, 0), 13.5), 1.6, { skin: 'velvet', cell: 0.45, look: { uR: 13.5 } }),
  ];
  const m = new Maker('music', bodies, 0x3d5);
  const drum = m.body('drum');
  m.start = m.spot(drum, v3(0, 8, 5.5), v3(0, 0, -1));
  m.keep(m.start, 2.6);
  m.hub = m.put('nightlight', m.spot(drum, v3(0, 8, -0.6), v3(0, 0, 1)), { keep: 2.8 });
  const pad = (key, off, face = null) => m.spot(key, off, face);
  m.spring(pad(drum, v3(7, 8, -1.5), v3(-1, 0, 0)), pad('record', v3(-12, 6, 5), v3(0.8, 0, -0.3)));
  // (Down into the barrel, to land on the inside of it.)
  m.spring(pad(drum, v3(-7, 8, 0), v3(1, 0, 0)), pad('barrel', v3(10, -9, 3), v3(-1, 0, -0.3)), { lift: 14 });
  m.spring(pad(drum, v3(0.5, 8, -7), v3(0, 0, 1)), pad('keys', v3(2, -18, 4), v3(1, 0.2, 0)));
  m.spring(pad(drum, v3(-5, 8, 5.6), v3(0.6, 0, -0.6)), pad('horn', v3(-14, 5, -8), v3(1, 0.1, 0.4)));
  m.spring(pad('horn', v3(19.4, 4.3, 7.5)), pad('cymbal', v3(-4.4, 6, 5.1)), { face: true });
  m.spring(pad('cymbal', v3(5, 4, -4), v3(-0.5, 0, 0.6)), pad('record', v3(8, 6, 10), v3(-0.5, 0, -0.5)));
  m.spring(pad('record', v3(-2, 6, -13.5), v3(0, 0, 1)), pad('keys', v3(17, -4, 5), v3(0, 0.8, 0.2)));
  m.spring(pad(drum, v3(5.4, 8, -5.2), v3(-0.6, 0, 0.6)), pad('podium', v3(0, -4, 11), v3(0, 0, 1)), { need: 'boss' });
  m.nightmares.push(
    { id: 1, body: 'record', at: m.spot('record', v3(3, 8, -2)), waves: [[['drummer', 1], ['quaver', 2]], [['drummer', 2]], [['drummer', 1], ['clam', 1], ['quaver', 2]]] },
    { id: 2, body: 'barrel', at: m.spot('barrel', v3(0, -9, 0)), waves: [[['quaver', 3]], [['metronome', 1], ['quaver', 2]], [['metronome', 2]], [['metronome', 1], ['drummer', 1], ['quaver', 2]]] },
    { id: 3, body: 'keys', at: m.spot('keys', v3(-18, 4, 2)), waves: [[['clam', 2]], [['clam', 1], ['quaver', 3]], [['drummer', 1], ['clam', 2]], [['metronome', 1], ['clam', 1], ['quaver', 2]]] },
  );
  m.boss = { body: 'podium', kind: 'maestro', at: m.spot('podium', v3(0, 6, 0), v3(0, 0, 1)) };
  for (const n of m.nightmares) m.keep(n.at, 2.6);
  for (let i = 0; i < 4; i++) {
    const a = -0.95 + i * 0.63;
    m.put('lamp', m.facing(m.spot(drum, v3(Math.sin(a) * 4.6, 8, -0.6 + Math.cos(a) * 3.6)), m.hub), { lamp: i + 1, keep: 1 });
  }
  m.roam.push({ body: 'horn', kinds: [['quaver', 2]] }, { body: 'cymbal', kinds: [['clam', 1]] });
  // ------- what stands about
  m.scatter('drumlet', 'record', 4, { ks: [0.9, 1.3], gap: 5, only: (s) => s.up.y > 0 });
  m.scatter('drumlet', 'record', 4, { ks: [0.9, 1.3], gap: 5, only: (s) => s.up.y < 0 });
  m.scatter('peg', 'barrel', 22, { ks: [0.8, 1.3], gap: 4.2 });
  m.scatter('peg', 'keys', 4, { ks: [0.8, 1.1], gap: 6 });
  m.scatter(['fork', 'bell'], 'horn', 4, { ks: [0.6, 0.8], gap: 4 });
  m.scatter('bell', 'cymbal', 3, { ks: [0.6, 0.9], gap: 4 });
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + 0.5;
    m.put('stand', m.facing(m.spot('podium', v3(Math.sin(a) * 11.4, 4, Math.cos(a) * 11.4)), v3(0, 48, 0)), { keep: 1.2 });
  }
  for (const key of ['drum', 'record', 'barrel', 'horn', 'cymbal', 'podium']) m.scatter('notelet', key, key === 'barrel' ? 34 : 18, { ks: [0.7, 1.2], gap: 1.4, solid: false });
  // ------- forty winks
  const row = (key, off, dir, n, gap = 1.6) => m.winkRow(m.spot(key, off), dir, n, gap);
  row('drum', v3(-6, 8, -4), v3(1, 0, -0.3), 4);
  row('record', v3(10, 8, -8), v3(-0.6, 0, 1), 6);
  row('record', v3(-6, -8, -6), v3(1, 0, 0.8), 6);
  row('barrel', v3(0, 9, 4), v3(0, 0, 1), 7, 2.2);
  row('keys', v3(14, 12, 4), v3(-0.5, 0.8, 0), 7, 2);
  row('horn', v3(-4, 4, -3), v3(1, 0.1, 0.3), 6);
  row('cymbal', v3(2, -4, 2), v3(1, 0, 0), 4);
  m.hideChests();
  return m.done();
}
