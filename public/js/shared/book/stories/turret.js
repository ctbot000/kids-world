// Once-upon Castle, the third story of the Storybook: over the moat and the
// drawbridge, through the great hall under its rafters, up the tower stairs
// and along the battlements to the roof, where the Paper Dragon nests.
import { TILE } from '../level.js';
import { Maker } from '../maker.js';

export function turret() {
  const m = new Maker({ key: 'turret', h: 26, seed: 0x74757272 });
  const skin = { walker: 'knight', hopper: 'toad', spiky: 'thistle', flyer: 'bat', dropper: 'spider', shooter: 'cannon' };
  const foe = (kind, x, opts = {}) => m.foe(kind, x, { skin: skin[kind], ...opts });
  const B = TILE.BLOCK;

  // ---- Page 1: The Drawbridge.
  m.run(16, 4, (x) => {
    foe('hopper', x + 10);
    m.stars(x + 5, x + 8, 5);
  });
  m.gap(8, (x) => {
    m.plank(x, x + 8, 3);
    foe('spiky', x + 4, { y: 4, range: 2 });
    m.arc(x + 1.5, x + 6.5, 5.2, 2.4, 4);
  });
  m.run(6, 4, (x) => m.decor('gatehouse', x + 3, { back: true }));
  m.run(30, 4, (x) => {
    foe('walker', x + 5);
    m.stairs(x + 9, 2, { w: 2 });
    m.block(x + 13, 4, 6, 2);
    foe('walker', x + 16, { y: 6, range: 2 });
    m.crate(x + 21, null, true);
    foe('shooter', x + 27, { face: -1 });
    m.stars(x + 13.5, x + 18.5, 7.2);
  }, TILE.GROUND);
  m.run(6, 4, (x) => m.mark(x + 2));

  // ---- Page 2: The Great Hall, under its rafters.
  m.run(48, 4, (x) => {
    m.block(x, 11, 48, 4);
    foe('dropper', x + 6, { y: 10, deep: 4.4 });
    foe('walker', x + 11);
    m.plank(x + 14, x + 20, 6).stars(x + 14.5, x + 19.5, 8);
    foe('dropper', x + 17, { y: 10, deep: 2.4, phase: 0.4 });
    foe('spiky', x + 24, { range: 3 });
    foe('dropper', x + 29, { y: 10, deep: 4.4, phase: 0.7 });
    m.crate(x + 33, null, false).crate(x + 34, null, true).crate(x + 33, 5, false);
    foe('walker', x + 40);
    foe('dropper', x + 44, { y: 10, deep: 4.4, phase: 0.2 });
    for (const k of [3, 13, 23, 37, 46]) m.decor('candle', x + k, { y: 8.5, back: true });
    m.stars(x + 26, x + 31, 5);
  }, TILE.GROUND);
  m.run(4, 4, (x) => m.mark(x + 1));

  // ---- Page 3: The Tower Stairs: up the inside of the tower, plank by plank.
  m.run(3, 4);
  m.run(16, 4, (x) => {
    // Its walls, a way in at the foot of one and out at the top of the other.
    m.block(x, 7, 1, 19);
    m.block(x + 15, 4, 1, 11);
    m.plank(x + 9, x + 14, 5).plank(x + 2, x + 7, 7).plank(x + 9, x + 14, 9).plank(x + 2, x + 7, 11).plank(x + 9, x + 15, 13);
    foe('flyer', x + 7.5, { y: 10.5, ax: 2.4, ay: 0.6, period: 4 });
    foe('flyer', x + 7.5, { y: 14.5, ax: 2.4, ay: 0.6, period: 4.4, phase: 0.5 });
    m.stars(x + 3, x + 6, 8.9).stars(x + 10, x + 13, 10.9).stars(x + 3, x + 6, 12.9);
  }, TILE.GROUND);
  m.run(10, 15, (x) => {
    m.stars(x + 2, x + 8, 16.4);
    m.mark(x + 7);
  }, B);

  // ---- Page 4: The Battlements: along the top of the wall, tower to tower.
  m.gap(4, (x) => m.arc(x - 1, x + 5, 16.4, 1.6, 4));
  m.run(8, 15, (x) => foe('walker', x + 4, { range: 3 }), B);
  m.gap(10, (x) => {
    m.mover(x + 3, 12, 3, { dy: 3, period: 4.4, kind: 'lift' });
    m.stars(x + 3.6, x + 5.4, 17, 0.9);
  });
  m.run(6, 16, (x) => foe('spiky', x + 3, { range: 2 }), B);
  m.run(3, 15, null, B);
  m.run(8, 17, (x) => {
    m.block(x + 3, 17, 2, 1);
    m.stars(x + 1, x + 7, 18.4);
  }, B);
  m.gap(4, (x) => m.arc(x - 1, x + 5, 18, 1.4, 4));
  m.run(6, 16, (x) => foe('shooter', x + 4, { face: -1 }), B);
  m.gap(9, (x) => {
    m.mover(x + 2, 15, 3, { dx: 2, period: 4.8, kind: 'lift' });
    foe('flyer', x + 4.5, { y: 19, ax: 2, ay: 0.5, period: 3.6 });
  });
  m.run(10, 15, (x) => m.mark(x + 7), B);

  // ---- The boss's page: the roof, where the Paper Dragon nests.
  m.run(3, 15, null, B);
  m.arena(26, 15, 'paperdragon', (x) => {
    m.plank(x + 4, x + 8, 16).plank(x + 17, x + 21, 16);
    m.decor('nest', x + 20, { back: true });
  }, B);

  m.scatter(['grass', 'daisy', 'bush'], 0, 62, { gap: 3 });
  m.scatter(['banner', 'window'], 62, m.L.arena.x0, { gap: 9, back: true });
  m.scatter(['flag'], m.L.arena.x0 + 1, m.L.arena.x1 - 1, { gap: 8, back: true });
  // Where its treasure chests may stand (tale.js): each [column, ground].
  for (const [x, y] of [[26, 4], [41, 6], [80, 7], [105, 4], [124, 12], [134, 10], [141, 15], [181, 18], [190, 16]]) m.chest(x, y);
  return m.done(3);
}
