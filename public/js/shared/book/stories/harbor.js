// Paper Boat Harbor, the second story of the Storybook: an old pier, paper
// boats bobbing on the waves, the rocks round the lighthouse and an old
// shipwreck, and all of it over the sea. Captain Crumple waits in his cove.
import { TILE } from '../level.js';
import { Maker } from '../maker.js';

export function harbor() {
  const m = new Maker({ key: 'harbor', seed: 0x68617262 });
  const skin = { walker: 'pinch', spiky: 'urchin', flyer: 'gull', shooter: 'squirt', popper: 'clam' };
  const foe = (kind, x, opts = {}) => m.foe(kind, x, { skin: skin[kind], ...opts });

  // ---- Page 1: The Old Pier.
  m.run(14, 4, (x) => {
    m.stars(x + 6, x + 9, 5);
    foe('popper', x + 11);
    m.decor('sign', x + 4);
  });
  m.gap(40, (x) => {
    m.plank(x, x + 12, 4).plank(x + 15, x + 26, 4).plank(x + 28, x + 40, 4);
    foe('walker', x + 6, { y: 5 });
    foe('spiky', x + 21, { y: 5, range: 3 });
    foe('walker', x + 34, { y: 5 });
    foe('flyer', x + 27, { y: 8.2, ax: 3, ay: 0.5, period: 4.6 });
    m.stars(x + 2, x + 5, 6).arc(x + 11, x + 16, 6, 1.8, 4).arc(x + 25, x + 29, 6, 1.6, 3).stars(x + 36, x + 39, 6);
    for (let k = 1; k < 40; k += 4) m.decor('post', x + k, { y: 0, back: true });
  });
  m.run(10, 4, (x) => m.mark(x + 6));

  // ---- Page 2: Bobbing Boats.
  m.run(5, 4);
  m.gap(46, (x) => {
    m.mover(x + 2, 4, 4, { dy: 0.7, period: 3.2, kind: 'boat' });
    m.mover(x + 9, 4.5, 4, { dy: 0.8, period: 3.6, phase: 0.3, kind: 'boat' });
    m.block(x + 16, 0, 4, 5, TILE.GROUND);
    foe('shooter', x + 18, { y: 5, face: -1 });
    m.mover(x + 23, 4.5, 4, { dx: 1.5, dy: 0.5, period: 5, kind: 'boat' });
    m.mover(x + 31, 5, 4, { dy: 1, period: 3, phase: 0.6, kind: 'boat' });
    m.block(x + 38, 0, 5, 6, TILE.GROUND);
    foe('shooter', x + 41, { y: 6, face: -1, phase: 0.5 });
    m.arc(x + 6, x + 9.5, 6.5, 1.5, 3).arc(x + 13, x + 16.5, 6.6, 1.5, 3).arc(x + 20, x + 23.5, 6.6, 1.5, 3).arc(x + 27.5, x + 31.5, 7, 1.5, 3).arc(x + 35, x + 38.5, 7.5, 1.5, 3);
  });
  m.run(9, 4, (x) => {
    foe('walker', x + 4, { range: 3 });
    m.mark(x + 7);
  });

  // ---- Page 3: Lighthouse Rocks.
  m.run(6, 4);
  m.gap(3);
  m.run(5, 6, (x) => m.stars(x + 1, x + 4, 7));
  m.gap(2);
  m.run(5, 8, (x) => foe('flyer', x + 2.5, { y: 11, ax: 2, ay: 0.6, period: 4 }));
  m.gap(3);
  m.run(6, 7, (x) => {
    m.spring(x + 3);
    m.arc(x + 2.5, x + 5.5, 9, 4, 3);
  });
  m.run(7, 12, (x) => {
    m.decor('lighthouse', x + 3.5, { back: true });
    m.stars(x + 1, x + 6, 13);
  });
  m.run(6, 9, (x) => foe('spiky', x + 3, { range: 2 }));
  m.gap(3, (x) => m.arc(x - 1, x + 4, 10, 1.6, 3, 8.5));
  m.run(8, 7, (x) => foe('walker', x + 4));
  m.run(6, 5);
  m.run(6, 4, (x) => m.mark(x + 4));

  // ---- Page 4: The Shipwreck.
  m.run(6, 4);
  m.gap(4, (x) => m.arc(x - 1, x + 5, 7, 1.8, 4));
  m.run(14, 6, (x) => {
    m.block(x + 6, 6, 4, 2);
    m.crate(x + 2, null, true).crate(x + 3, null, false);
    foe('walker', x + 12, { range: 2 });
    m.stars(x + 6.5, x + 9.5, 9);
  }, TILE.BLOCK);
  m.gap(11, (x) => {
    m.plank(x + 2, x + 5, 6).plank(x + 7, x + 10, 6);
    foe('flyer', x + 6, { y: 0.5, ax: 0, ay: 3.6, period: 2.8, skin: 'leaper' });
    m.stars(x + 2.5, x + 4.5, 8).stars(x + 7.5, x + 9.5, 8);
    for (const k of [3.5, 8.5]) m.decor('mast', x + k, { y: 0, back: true });
  });
  m.run(12, 6, (x) => {
    foe('shooter', x + 10, { y: 6, face: -1 });
    m.crate(x + 4, null, true);
  }, TILE.BLOCK);
  m.run(6, 4, (x) => m.mark(x + 4));

  // ---- The boss's page: Captain Crumple's cove.
  m.run(3, 4);
  m.arena(26, 4, 'crumple', (x) => {
    m.plank(x + 5, x + 9, 5).plank(x + 16, x + 20, 5);
  });

  m.scatter(['shell', 'grass', 'rock'], 0, m.L.arena.x0, { gap: 3.2 });
  m.scatter(['palm', 'hut'], 0, m.L.arena.x0, { gap: 18, back: true });
  m.scatter(['shell', 'rock'], m.L.arena.x0 + 1, m.L.arena.x1 - 1, { gap: 4 });
  // Where its treasure chests may stand (tale.js): each [column, ground].
  for (const [x, y] of [[29, 5], [57, 4], [65, 4], [107, 6], [133, 6], [140, 8], [156, 12], [208, 8], [225, 6]]) m.chest(x, y);
  return m.done(3);
}
