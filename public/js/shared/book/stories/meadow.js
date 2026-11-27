// Hopscotch Meadow, the first story of the Storybook: green hills, a puddly
// lane, a windmill up on the hill and a bridge over the brambles, with the
// friendliest of foes to learn on. Grumbleweed waits at the end.
import { Maker } from '../maker.js';

export function meadow() {
  const m = new Maker({ key: 'meadow', seed: 0x6d656164 });
  const skin = { walker: 'inkling', hopper: 'hoppit', spiky: 'burr', flyer: 'buzzer', popper: 'molly' };
  const foe = (kind, x, opts = {}) => m.foe(kind, x, { skin: skin[kind], ...opts });

  // ---- Page 1: The Garden Gate. Run, jump, and stomp an Inkling.
  m.run(20, 4, (x) => {
    m.stars(x + 7, x + 12, 5);
    m.decor('gate', x + 16);
    m.decor('sign', x + 5);
  });
  m.run(8, 5, (x) => m.arc(x + 1, x + 6, 6.2, 1.2, 4));
  m.run(10, 4, (x) => foe('walker', x + 5));
  m.gap(2, (x) => m.arc(x - 2, x + 4, 5.2, 2.2, 4));
  m.run(22, 4, (x) => {
    m.plank(x + 4, x + 10, 5).stars(x + 4.6, x + 9.4, 7.3);
    m.crate(x + 13, null, true);
    foe('hopper', x + 17);
    m.mark(x + 20);
  });

  // ---- Page 2: Puddle Lane. Pits, a lily pad that floats, and a spring.
  m.run(6, 4);
  m.gap(3, (x) => m.arc(x - 1.5, x + 4.5, 5.2, 2.4, 4));
  m.run(5, 4);
  m.run(8, 6, (x) => m.stars(x + 1, x + 7, 7.2));
  m.run(10, 4, (x) => foe('spiky', x + 5, { range: 4 }));
  m.gap(9, (x) => {
    m.mover(x + 3, 4, 3, { dx: 1, period: 4.4, kind: 'lily' });
    m.stars(x + 3.6, x + 5.4, 5.6, 0.9);
  });
  m.run(14, 4, (x) => {
    foe('flyer', x + 5, { y: 5.7, ax: 2.2, ay: 0.4, period: 4 });
    foe('walker', x + 11);
  });
  m.run(12, 4, (x) => {
    m.spring(x + 5);
    m.plank(x + 2, x + 10, 10).stars(x + 2.6, x + 9.4, 11.8);
    m.mark(x + 10);
  });

  // ---- Page 3: Windmill Hill. Up the hill and down the other side.
  m.run(10, 4, (x) => foe('hopper', x + 5));
  m.run(9, 6, (x) => m.stars(x + 2, x + 7, 7));
  m.run(12, 8, (x) => {
    foe('popper', x + 7);
    m.stars(x + 1, x + 4, 9);
    m.decor('windmill', x + 9, { back: true, s: 1.2 });
  });
  m.gap(7, (x) => {
    m.plank(x + 2, x + 5, 7);
    m.arc(x - 0.5, x + 3.5, 9.2, 1.6, 3).arc(x + 3.5, x + 7.5, 9.2, 1.6, 3);
  });
  m.run(10, 7, (x) => {
    m.crate(x + 3, null, true).crate(x + 3, 8, false).crate(x + 4, null, false);
    foe('walker', x + 8, { range: 2 });
  });
  m.run(14, 5, (x) => {
    foe('popper', x + 6);
    m.stars(x + 9, x + 13, 6);
  });
  m.run(6, 4, (x) => m.mark(x + 3));

  // ---- Page 4: Bramble Bridge. Thorns, and the bridge over the brambles.
  m.run(10, 4);
  m.run(3, 4, (x) => {
    m.thorns(x, x + 3, 4);
    m.arc(x - 1.5, x + 4.5, 5.4, 2.6, 4);
  });
  m.run(6, 4);
  m.gap(16, (x) => {
    m.thorns(x, x + 16, 0);
    m.plank(x + 1, x + 5, 3).plank(x + 6, x + 10, 4).plank(x + 11, x + 15, 3);
    foe('flyer', x + 5.5, { y: 6.7, ax: 0.3, ay: 0.55, period: 3.2 });
    foe('flyer', x + 10.5, { y: 6.7, ax: 0.3, ay: 0.55, period: 3.2, phase: 0.5 });
    m.stars(x + 2, x + 4, 5).stars(x + 7, x + 9, 6).stars(x + 12, x + 14, 5);
  });
  m.run(16, 4, (x) => {
    foe('walker', x + 4);
    foe('spiky', x + 11, { range: 3 });
  });
  m.run(2, 5).run(2, 6).run(5, 7, (x) => m.stars(x + 1, x + 4, 8.4));
  m.run(9, 4, (x) => m.mark(x + 5));

  // ---- The boss's page: Grumbleweed's garden.
  m.run(3, 4);
  // (Its planks between its three flower pots: boss.js grumbleweed pots.)
  m.arena(26, 4, 'grumbleweed', (x) => {
    m.plank(x + 8, x + 11, 5).plank(x + 15, x + 18, 5);
  });

  // Drawn about for show.
  m.scatter(['tulip', 'daisy', 'grass', 'bush'], 0, m.L.arena.x0, { gap: 2.6 });
  m.scatter(['tree', 'tree', 'fence'], 0, m.L.arena.x0, { gap: 11, back: true, s: [0.9, 1.4] });
  m.scatter(['tulip', 'daisy', 'grass'], m.L.arena.x0 + 1, m.L.arena.x1 - 1, { gap: 3 });
  return m.done(3);
}
