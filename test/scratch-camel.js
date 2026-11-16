import { startRide, stepRide, rideState } from '../public/js/shared/riding.js';
import * as B from '../public/js/shared/blocks.js';
import { World } from '../public/js/shared/world.js';
const w = new World({ W: 48, H: 32, D: 48, sea: 3 });
for (let x = 0; x < 48; x++) for (let z = 0; z < 48; z++) { w.set(x, 0, z, B.MAGIC_FLOOR); for (let y = 1; y <= 5; y++) w.set(x, y, z, y === 5 ? B.GRASS : B.STONE); }
for (const type of ['pony', 'camel']) {
  const r = startRide(w, type, 10.5, 6, 20.5);
  for (let i = 0; i < 60; i++) stepRide(w, r, { mx: 1, mz: 0 }, 1 / 60);
  console.log(type, 'state', rideState(r), 'vx', r.body.vx.toFixed(2), 'y', r.body.y, 'onGround', r.body.onGround);
}
