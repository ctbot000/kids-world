// Inkwell Keep, the last story of the Storybook: Count Inkblot's own home at
// the back of the book, all ink, where every one of his foes is out at once,
// and quicker than ever. Through the blotted pages, the forest of quills, over
// the ink falls and up to his keep.
import { TILE } from '../level.js';
import { Maker } from '../maker.js';

export function inkwell() {
  const m = new Maker({ key: 'inkwell', seed: 0x696e6b77 });
  const skin = { walker: 'blotling', hopper: 'inkfrog', spiky: 'quillback', flyer: 'inkmoth', popper: 'splat', shooter: 'inkpot', dropper: 'drip', roller: 'barrel' };
  const foe = (kind, x, opts = {}) => m.foe(kind, x, { skin: skin[kind], ...opts });
  const B = TILE.BLOCK;

  // ---- Page 1: The Blotted Pages.
  m.run(12, 4, (x) => m.stars(x + 5, x + 9, 5));
  m.run(10, 4, (x) => {
    foe('walker', x + 3, { range: 3 });
    foe('walker', x + 8, { range: 2 });
  });
  m.gap(3, (x) => m.arc(x - 1, x + 4, 5.2, 2.2, 4));
  m.run(10, 5, (x) => {
    foe('hopper', x + 5, { range: 3 });
    m.thorns(x + 8, x + 10, 5);
  });
  m.run(8, 5, (x) => foe('spiky', x + 4, { range: 3 }));
  m.gap(4, (x) => {
    foe('flyer', x + 2, { y: 7, ax: 1.2, ay: 0.5, period: 3.4 });
    m.arc(x - 1, x + 5, 6.2, 2.4, 4);
  });
  m.run(12, 5, (x) => {
    m.crate(x + 3, null, true);
    foe('walker', x + 8, { range: 3 });
    m.mark(x + 10);
  });

  // ---- Page 2: The Quill Forest.
  m.run(14, 5, (x) => {
    foe('popper', x + 5);
    foe('dropper', x + 9, { y: 10, deep: 3.6 });
    for (const k of [2, 9, 13]) m.decor('quill', x + k, { back: true });
  });
  m.gap(3);
  m.run(12, 5, (x) => {
    foe('popper', x + 3);
    foe('popper', x + 8, { phase: 0.5 });
    m.plank(x + 2, x + 10, 8).stars(x + 2.5, x + 9.5, 9.6);
    foe('dropper', x + 6, { y: 13, deep: 3.6, phase: 0.3 });
  });
  m.run(6, 7, (x) => m.thorns(x + 1, x + 2, 7));
  m.gap(4, (x) => m.arc(x - 2, x + 5, 8.5, 2, 4));
  m.run(14, 5, (x) => {
    foe('spiky', x + 5, { range: 4 });
    foe('dropper', x + 10, { y: 10, deep: 3.8, phase: 0.6 });
    for (const k of [3, 12]) m.decor('quill', x + k, { back: true });
  });
  m.run(6, 5, (x) => m.mark(x + 3));

  // ---- Page 3: The Ink Falls: rafts that rise and sink, and inkpots spitting.
  m.run(5, 5);
  m.gap(31, (x) => {
    m.mover(x + 2, 5, 3, { dy: 1.2, period: 3.4, kind: 'raft' });
    m.mover(x + 8, 5, 3, { dy: 1.2, period: 3.4, phase: 0.5, kind: 'raft' });
    m.block(x + 14, 0, 3, 7, TILE.GROUND);
    foe('shooter', x + 15.5, { y: 7, face: -1 });
    m.mover(x + 20, 6, 3, { dx: 1.5, dy: 0.8, period: 4.4, kind: 'raft' });
    m.mover(x + 26, 6, 3, { dy: 1.4, period: 3, phase: 0.25, kind: 'raft' });
    m.stars(x + 2.5, x + 4.5, 7.6).stars(x + 8.5, x + 10.5, 7.6).stars(x + 20.5, x + 22.5, 8.4).stars(x + 26.5, x + 28.5, 8.8);
  });
  m.run(10, 6, (x) => {
    foe('shooter', x + 8, { face: -1, phase: 0.4 });
    m.mark(x + 5);
  });

  // ---- Page 4: The Count's Keep: up the stairs, past rolling barrels.
  m.run(6, 6);
  m.run(16, 6, (x) => {
    foe('roller', x + 8, { range: 7 });
    m.stars(x + 3, x + 13, 7.4, 2);
  }, B);
  m.run(4, 8, null, B).run(4, 10, null, B);
  m.run(14, 10, (x) => {
    foe('spiky', x + 3, { range: 2 });
    m.thorns(x + 6, x + 8, 10);
    foe('flyer', x + 7, { y: 12.6, ax: 2.2, ay: 0.5, period: 3.8 });
  }, B);
  m.gap(4, (x) => m.arc(x - 1, x + 5, 11.2, 2.4, 4));
  m.run(12, 9, (x) => {
    foe('roller', x + 6, { range: 5 });
    m.crate(x + 2, null, true);
  }, B);
  m.run(4, 7, null, B).run(8, 5, (x) => m.mark(x + 5), B);

  // ---- The boss's page: the Count's own room.
  m.run(3, 5, null, B);
  m.arena(28, 5, 'inkblot', (x) => {
    // (Planks to get up on out of his flood: the side ones a jump up from
    // the floor, the middle one a hop up from either.)
    m.plank(x + 3, x + 7, 6).plank(x + 10, x + 17, 7).plank(x + 20, x + 24, 6);
  }, B);

  m.scatter(['blot', 'quilltuft', 'blot'], 0, m.L.arena.x0, { gap: 3.4 });
  m.scatter(['bottle', 'quill'], 0, m.L.arena.x0, { gap: 14, back: true });
  return m.done(3);
}
