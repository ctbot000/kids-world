// Twinkle Sky, the fourth story of the Storybook: a bedtime story up in the
// night sky, where nothing falls half as fast, so every jump goes higher and
// further. Up the clouds, along the Milky Way and on to the cheese moon,
// where King Nibbles has been nibbling.
import { TILE } from '../level.js';
import { Maker } from '../maker.js';

export function starry() {
  const m = new Maker({ key: 'starry', gravity: 0.55, jump: 0.82, seed: 0x73746172 });
  const skin = { walker: 'mouse', hopper: 'bunny', spiky: 'spikestar', flyer: 'owl', roller: 'cheese' };
  const foe = (kind, x, opts = {}) => m.foe(kind, x, { skin: skin[kind], ...opts });
  const C = TILE.BLOCK;

  // ---- Page 1: Cloud Steps.
  m.run(14, 4, (x) => m.stars(x + 6, x + 10, 5));
  m.gap(4, (x) => m.arc(x - 1, x + 5, 5.4, 2.6, 4, 7));
  m.run(6, 6, (x) => m.stars(x + 1, x + 4, 7));
  m.gap(5, (x) => m.arc(x - 1, x + 6, 7.6, 2.6, 4, 9));
  m.run(6, 8, (x) => foe('walker', x + 3, { range: 2 }));
  m.gap(10, (x) => {
    m.mover(x + 3, 7, 4, { dx: 2, period: 6, kind: 'cloud' });
    m.stars(x + 3.6, x + 6.4, 8.4);
  });
  m.run(8, 6, (x) => foe('hopper', x + 4, { range: 3 }));
  m.gap(5, (x) => m.arc(x - 1, x + 6, 7.2, 2.4, 4));
  m.run(12, 5, (x) => {
    m.plank(x + 3, x + 9, 7).stars(x + 3.5, x + 8.5, 9.6);
    m.mark(x + 10);
  });

  // ---- Page 2: The Milky Way.
  m.run(16, 5, (x) => {
    foe('spiky', x + 8, { range: 5 });
    m.stars(x + 2, x + 6, 6.2);
  });
  m.gap(6, (x) => m.arc(x - 1, x + 7, 6.4, 3, 5));
  m.run(14, 5, (x) => {
    foe('hopper', x + 5, { range: 4 });
    m.plank(x + 7, x + 12, 7).stars(x + 7.5, x + 11.5, 9.6);
    foe('walker', x + 11, { range: 2 });
  });
  m.gap(7, (x) => {
    m.plank(x + 2, x + 5, 4);
    m.stars(x + 2.5, x + 4.5, 5.4);
  });
  m.run(18, 5, (x) => {
    foe('spiky', x + 6, { range: 4 });
    foe('spiky', x + 13, { range: 3 });
    m.arc(x + 4, x + 9, 6.4, 3.2, 5).arc(x + 11, x + 16, 6.4, 3.2, 5);
  });
  m.run(6, 5, (x) => m.mark(x + 3));

  // ---- Page 3: The Cheese Moon.
  m.run(10, 4, (x) => {
    foe('walker', x + 5);
    m.decor('moonhouse', x + 7, { back: true });
  }, C);
  m.gap(3);
  m.run(12, 4, (x) => {
    foe('roller', x + 6, { range: 6 });
    m.stars(x + 2, x + 9, 7.2, 1.4);
  }, C);
  m.gap(4, (x) => m.arc(x - 1, x + 5, 5.4, 2.8, 4, 7));
  m.run(8, 6, (x) => foe('walker', x + 4, { range: 3 }), C);
  m.run(8, 8, (x) => m.stars(x + 1, x + 6, 9.2), C);
  m.gap(3);
  m.run(14, 6, (x) => {
    foe('roller', x + 7, { range: 6 });
    foe('hopper', x + 11, { range: 2 });
  }, C);
  m.gap(4);
  m.run(8, 4, (x) => m.mark(x + 5), C);

  // ---- Page 4: Comet Corner: wide, wide gaps, and owls to bounce across on.
  m.run(8, 4);
  m.gap(12, (x) => {
    m.plank(x + 5, x + 7, 4);
    foe('flyer', x + 6, { y: 8.4, ax: 3.4, ay: 0.6, period: 4.2 });
    m.stars(x + 1.5, x + 3.5, 8).stars(x + 8.5, x + 10.5, 8);
  });
  m.run(5, 5);
  m.gap(10, (x) => {
    m.mover(x + 3.5, 5, 3, { dx: 2, period: 5.2, kind: 'cloud' });
    foe('flyer', x + 7, { y: 8, ax: 1, ay: 0.8, period: 3.4 });
  });
  m.run(6, 6, (x) => foe('spiky', x + 3, { range: 1.5 }));
  m.gap(12, (x) => {
    foe('flyer', x + 3.5, { y: 6.4, ax: 0.8, ay: 0.6, period: 3.6 });
    foe('flyer', x + 8.5, { y: 6.4, ax: 0.8, ay: 0.6, period: 3.6, phase: 0.5 });
    m.plank(x + 5, x + 7, 3);
    m.stars(x + 3, x + 9, 9, 1.5);
  });
  m.run(10, 5, (x) => m.mark(x + 7));

  // ---- The boss's page: the back of the moon.
  m.run(3, 4, null, C);
  m.arena(28, 4, 'nibbles', (x) => {
    m.plank(x + 4, x + 8, 6).plank(x + 19, x + 23, 6);
  }, C);

  m.scatter(['crater', 'twinkle', 'twinkle'], 0, m.L.arena.x0, { gap: 4 });
  m.scatter(['crater'], m.L.arena.x0 + 1, m.L.arena.x1 - 1, { gap: 5 });
  // Where its treasure chests may stand (tale.js): each [column, ground].
  for (const [x, y] of [[20, 6], [62, 8], [109, 5], [113, 5], [177, 8], [205, 4], [233, 5], [258, 4], [266, 5]]) m.chest(x, y);
  return m.done(3);
}
