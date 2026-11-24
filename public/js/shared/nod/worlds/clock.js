// Tick-Tock Skies: the fourth dream of the Land of Nod, the Clockmaker's — a
// pocket watch to land on, great brass gears, a globe in a ring, an hourglass
// and a pendulum, all brass and starlight, and over them Old Tock's great dial,
// with a side to it that nobody looks at.
import { Body, Chain, Dot, Loop, Plate, v3 } from '../shape.js';
import { Maker } from '../maker.js';

// Teeth round a wheel's rim, n of them, tooth high, on axis y of its own.
function teeth(c, axis, R, n, tooth) {
  const l = Math.hypot(axis.x, axis.y, axis.z);
  const Y = v3(axis.x / l, axis.y / l, axis.z / l);
  let X = Math.abs(Y.y) < 0.9 ? v3(0, 1, 0) : v3(1, 0, 0);
  const k = X.x * Y.x + X.y * Y.y + X.z * Y.z;
  X = v3(X.x - Y.x * k, X.y - Y.y * k, X.z - Y.z * k);
  const xl = Math.hypot(X.x, X.y, X.z);
  X = v3(X.x / xl, X.y / xl, X.z / xl);
  const Z = v3(X.y * Y.z - X.z * Y.y, X.z * Y.x - X.x * Y.z, X.x * Y.y - X.y * Y.x);
  return (x, y, z) => {
    const px = x - c.x;
    const py = y - c.y;
    const pz = z - c.z;
    const a = px * X.x + py * X.y + pz * X.z;
    const b = px * Z.x + py * Z.y + pz * Z.z;
    const r = Math.hypot(a, b);
    const rim = Math.max(0, Math.min(1, (r - R + 1.2) / 1.6));
    const s = Math.sin(Math.atan2(b, a) * n);
    // (Rounded teeth, and a middle a little sunk.)
    const t = s / Math.sqrt(0.18 + s * s);
    const k = Math.min(1, Math.max(0, (r - 3) / 1.6)) * Math.min(1, Math.max(0, (R - 2.4 - r) / 1.6));
    return rim * rim * (3 - 2 * rim) * tooth * (t * 0.5 - 0.1) - 0.2 * k;
  };
}

export function clock() {
  const g1 = { c: v3(36, -2, -4), axis: v3(0.1, 1, -0.06), R: 10.5 };
  const g2 = { c: v3(52, 8, 12), axis: v3(-0.5, 1, 0.3), R: 8 };
  const bodies = [
    new Body('watch', new Plate(v3(0, 0, 0), v3(0, 1, 0), 8.6), 1.9, { skin: 'dial', cell: 0.45, look: { uR: 10.2 }, bumps: [{ a: v3(0, 0, -9), b: v3(0, 0, -13), r: 0.9, rb: 1.3, k: 0.8 }, { c: v3(0, 0, -14.5), r: 1.6, k: 0.4 }] }),
    new Body('gear', new Plate(g1.c, g1.axis, g1.R), 1.7, { skin: 'brass', cell: 0.34, look: { uColor: '#d9a24a', uDark: '#5f3f18' }, ripple: teeth(g1.c, g1.axis, g1.R, 14, 1.2), bumps: [{ c: v3(36, -2, -4), r: 3, k: 0.8 }] }),
    new Body('gear2', new Plate(g2.c, g2.axis, g2.R), 1.3, { skin: 'brass', cell: 0.34, look: { uColor: '#b98a5a', uDark: '#4a2f1c' }, ripple: teeth(g2.c, g2.axis, g2.R, 11, 1.1) }),
    new Body('globe', new Dot(v3(-38, 6, -8)), 9.6, { skin: 'brass', look: { uColor: '#c98f4a', uDark: '#4f2f14' } }),
    new Body('hoop', new Loop(v3(-38, 6, -8), v3(0.35, 1, 0.2), 15.5), 1.25, { skin: 'brass', cell: 0.45, look: { uColor: '#f2cc62', uDark: '#7a561c', uEngrave: 0 } }),
    new Body('glass', new Chain([v3(6, -10, -44), v3(6, 0, -44), v3(6, 6, -44), v3(6, 10, -44), v3(6, 14, -44), v3(6, 20, -44), v3(6, 30, -44)], [1.35, 1.35, 0.95, 0.4, 0.95, 1.35, 1.35]), 6.4, { skin: 'sandglass', cell: 0.5, axis: v3(0, 1, 0) }),
    new Body('bob', new Dot(v3(-20, -6, 34)), 7.4, { skin: 'brass', look: { uColor: '#f0c04a', uDark: '#7a5a20' } }),
    new Body('rod', new Chain([v3(-20, 0, 34), v3(-19, 14, 31), v3(-18, 28, 28)]), 0.9, { skin: 'brass', cell: 0.4, look: { uColor: '#c9a05a', uDark: '#6a4a20', uEngrave: 0 } }),
    new Body('dial', new Plate(v3(0, 50, 0), v3(0, 1, 0), 15.5), 1.2, { skin: 'dial', cell: 0.45, look: { uR: 16.2 } }),
  ];
  const m = new Maker('clock', bodies, 0x71c);
  const watch = m.body('watch');
  m.start = m.spot(watch, v3(0, 8, 6), v3(0, 0, -1));
  m.keep(m.start, 2.6);
  m.hub = m.put('nightlight', m.spot(watch, v3(0, 8, -0.6), v3(0, 0, 1)), { keep: 2.8 });
  const pad = (key, off, face = null) => m.spot(key, off, face);
  m.spring(pad(watch, v3(7.4, 8, -1), v3(-1, 0, 0)), pad('gear', v3(-8.4, 5, 2), v3(0.8, 0, -0.2)));
  m.spring(pad(watch, v3(-7.6, 7.5, -0.7)), pad('globe', v3(10.3, 0.2, 5.7)), { face: true });
  m.spring(pad(watch, v3(1, 8, -7.2), v3(0, 0, 1)), pad('glass', v3(1, -11, 9), v3(0, 0.8, 0.2)));
  m.spring(pad(watch, v3(-5, 8, 6), v3(0.6, 0, -0.6)), pad('bob', v3(3, 2, -7), v3(0, 0.8, 0.2)));
  m.spring(pad('gear', v3(7.4, 5.6, 4.6)), pad('gear2', v3(-3, 3, -6.9)), { face: true });
  m.spring(pad('gear2', v3(5, 5, -5), v3(-0.5, 0, 0.4)), pad('glass', v3(8, 13, 4), v3(0, -0.8, 0.2)));
  m.spring(pad('globe', v3(-6.1, 6.4, 5.2)), pad('hoop', v3(-14.2, 5.4, 6.5)), { face: true });
  m.spring(pad(watch, v3(5.4, 8, -5), v3(-0.6, 0, 0.6)), pad('dial', v3(0, -4, 13), v3(0, 0, 1)), { need: 'boss' });
  m.nightmares.push(
    { id: 1, body: 'gear', at: m.spot('gear', v3(4, 6, 0)), waves: [[['cogling', 4], ['windup', 1]], [['windup', 2]], [['windup', 2], ['cogling', 4]], [['windup', 2], ['jack', 1], ['cuckoo', 1]]] },
    { id: 2, body: 'globe', at: m.spot('globe', v3(0, 8, 8)), waves: [[['cuckoo', 2], ['cogling', 2]], [['cuckoo', 2], ['cogling', 4]], [['windup', 2], ['cuckoo', 1]], [['jack', 1], ['cuckoo', 2], ['windup', 1]]] },
    { id: 3, body: 'glass', at: m.spot('glass', v3(-8, -12, 5)), waves: [[['jack', 1], ['cogling', 4]], [['jack', 2], ['cuckoo', 1]], [['windup', 2], ['cuckoo', 2]], [['jack', 2], ['windup', 1], ['cogling', 3]]] },
  );
  m.boss = { body: 'dial', kind: 'tock', at: m.spot('dial', v3(0, 6, 0), v3(0, 0, 1)), back: m.spot('dial', v3(0, -6, 0), v3(0, 0, 1)) };
  for (const n of m.nightmares) m.keep(n.at, 2.6);
  for (let i = 0; i < 4; i++) {
    const a = -0.95 + i * 0.63;
    m.put('lamp', m.facing(m.spot(watch, v3(Math.sin(a) * 4.8, 8, -0.6 + Math.cos(a) * 3.8)), m.hub), { lamp: i + 1, keep: 1 });
  }
  m.roam.push({ body: 'bob', kinds: [['cogling', 3]] }, { body: 'gear2', kinds: [['windup', 1]] }, { body: 'hoop', kinds: [['cogling', 2]] });
  // ------- what stands about
  m.scatter(['cog', 'chimney'], 'gear', 6, { ks: [0.8, 1.2], gap: 4.4 });
  m.scatter('cog', 'gear2', 4, { ks: [0.7, 1], gap: 4 });
  m.scatter(['chimney', 'key'], 'globe', 8, { ks: [0.8, 1.1], gap: 4 });
  m.scatter(['cog', 'key'], 'glass', 7, { ks: [0.8, 1.2], gap: 4.4 });
  m.scatter(['cog'], 'bob', 4, { ks: [0.6, 0.9], gap: 4 });
  m.scatter('cog', 'dial', 5, { ks: [1, 1.4], gap: 5, only: (s) => s.up.y < -0.5 });
  for (const key of ['watch', 'gear', 'gear2', 'globe', 'glass', 'bob', 'dial']) m.scatter('screw', key, 16, { ks: [0.7, 1.3], gap: 1.4, solid: false });
  // ------- forty winks
  const row = (key, off, dir, n, gap = 1.6) => m.winkRow(m.spot(key, off), dir, n, gap);
  row('watch', v3(-6, -8, -4), v3(1, 0, 0.5), 5);
  row('gear', v3(-4, -6, -5), v3(1, 0, 0.5), 5);
  row('gear2', v3(0, -5, 4), v3(1, 0, -0.4), 4);
  row('globe', v3(-9, -2, -4), v3(0, 0.8, 0), 6);
  row('hoop', v3(15, 0, -4), v3(0, 0, 1), 8, 2.4);
  row('glass', v3(8, 2, 3), v3(0, 1, 0), 6);
  row('rod', v3(2, 4, 0), v3(0, 1, 0), 6, 2);
  return m.done();
}
