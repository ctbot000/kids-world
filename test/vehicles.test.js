// Vehicles: where they start out (a car, a boat and a digger on every
// island, and rails with a mine cart in every mine), parked where they were
// left, driven (the car and the boat honking, the digger digging through the
// ground and out jewels, a mine cart rolling along rails, round corners and
// up slopes), brought and sent away, saved, and given to islands from before
// them; and rails drawn joined up.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as B from '../public/js/shared/blocks.js';
import { CRITTER_INFO, CritterSim, fits, onRails, swimmable, VEHICLES, waterColumn } from '../public/js/shared/critters.js';
import { bodyOverlapsSolid } from '../public/js/shared/physics.js';
import { drillCells, getOffAt, railNext, rideState, startRide, stepRide } from '../public/js/shared/riding.js';
import { PROTOCOL, Room } from '../public/js/shared/room.js';
import { STAT_KEYS, STICKERS } from '../public/js/shared/stickers.js';
import { applyCells, drillEdit } from '../public/js/shared/tools.js';
import { World } from '../public/js/shared/world.js';
import { generate } from '../public/js/shared/worldgen.js';
import { meshChunk } from '../public/js/render/mesher.js';

const FL = Math.floor;

// A meadow: magic floor, stone, and grass on top at y = 5 (so standing at 6).
function meadow(W = 48, D = 48) {
  const w = new World({ W, H: 32, D, sea: 3 });
  for (let x = 0; x < W; x++) {
    for (let z = 0; z < D; z++) {
      w.set(x, 0, z, B.MAGIC_FLOOR);
      for (let y = 1; y <= 5; y++) w.set(x, y, z, y === 5 ? B.GRASS : B.STONE);
    }
  }
  return w;
}

const ride = (world, type, x, y, z, yaw = 0) => startRide(world, type, { x, y, z, yaw });
const go = (world, r, input, seconds) => {
  const events = [];
  for (let i = 0; i < seconds * 60; i++) events.push(stepRide(world, r, input, 1 / 60));
  return events;
};
// Drives the digger, making what its drill digs as the page does.
const dig = (world, r, input, seconds) => {
  const found = [];
  for (let i = 0; i < seconds * 60; i++) {
    const ev = stepRide(world, r, input, 1 / 60);
    if (!ev.dig) continue;
    const e = drillEdit(world, ev.dig);
    applyCells(world, e.cells);
    found.push(...e.collected);
  }
  return found;
};

test('every island starts with a car, a boat and a digger, and a mine cart on rails in every mine', () => {
  for (const theme of ['sunny', 'snowy', 'candy', 'flat']) {
    for (const [seed, size] of [
      [4242, 'small'],
      [7, 'small'],
      [7, 'big'],
      [99, 'huge'],
    ]) {
      const where = `${theme} ${seed} ${size}`;
      const { world, critters, mines } = generate({ seed, theme, size });
      const of = (type) => critters.filter((c) => c.type === type);
      assert.equal(of('car').length, 1, `${where}: a car`);
      assert.equal(of('boat').length, 1, `${where}: a boat`);
      assert.equal(of('digger').length, 1, `${where}: a digger`);
      assert.equal(of('minecart').length, mines.length, `${where}: a mine cart in each mine`);
      for (const c of [...of('car'), ...of('digger')]) {
        assert.ok(fits(world, c.type, c.x, c.y, c.z), `${where}: the ${c.type} has room for itself and a driver`);
        assert.ok(!waterColumn(world, c.x, c.z), `${where}: the ${c.type} on dry land`);
      }
      const [boat] = of('boat');
      assert.ok(swimmable(world, 'boat', boat.x, boat.z) && waterColumn(world, boat.x, boat.z).top === world.sea, `${where}: the boat on the sea`);
      for (const [i, cart] of of('minecart').entries()) {
        assert.ok(onRails(world, cart.x, cart.y, cart.z), `${where}: mine cart ${i} on its rails`);
        // Facing into its mine: pushed on, it rolls in, away from the way in.
        const r = startRide(world, 'minecart', cart);
        const m = mines[i];
        const out = m.way[0];
        const from = Math.hypot(cart.x - out.x, cart.z - out.z);
        go(world, r, { mx: Math.sin(cart.yaw), mz: Math.cos(cart.yaw) }, 1.5);
        assert.ok(Math.hypot(r.body.x - out.x, r.body.z - out.z) > from + 3, `${where}: mine cart ${i} rolls into its mine`);
        assert.equal(world.get(FL(cart.x), FL(cart.y), FL(cart.z)), B.RAIL);
      }
      // Rails all the way along each mine: one line, from the foot into the end.
      for (const m of mines) {
        let line = 0;
        for (let x = 0; x < world.W; x++) for (let z = 0; z < world.D; z++) if (world.get(x, m.y, z) === B.RAIL && Math.hypot(x - m.x, z - m.z) < 30) line++;
        assert.ok(line >= 10, `${where}: ${line} rails in the mine at ${m.x},${m.z}`);
      }
    }
  }
});

test('a new island keeps its vehicles facing the way they were made', () => {
  const room = new Room({ code: '123456', theme: 'sunny', seed: 4242, now: () => 1000 });
  const { critters } = generate({ seed: 4242, theme: 'sunny' });
  for (const type of VEHICLES) {
    const made = critters.find((c) => c.type === type);
    if (!made) continue;
    const c = room.critters.list.find((o) => o.type === type);
    assert.equal(c.yaw, made.yaw, type);
  }
});

test('a parked vehicle stays where it was left, honks when tapped, and never follows anyone for fruit', () => {
  const { world, critters } = generate({ seed: 4242, theme: 'sunny' });
  const sim = new CritterSim(1);
  for (const c of critters) if (CRITTER_INFO[c.type].vehicle) sim.add(c.type, c.x, c.y, c.z, null, c.yaw);
  const start = sim.list.map((c) => ({ x: c.x, y: c.y, z: c.z, yaw: c.yaw }));
  const you = { x: start[0].x + 3, y: start[0].y, z: start[0].z, yaw: 0 };
  sim.feed(sim.list[0].id, 7, you, 0);
  for (let i = 0; i < 1200; i++) sim.step(world, 0.1, i * 100, new Map([[7, { ...you, x: you.x + i * 0.05 }]]), i % 600 > 480);
  sim.list.forEach((c, i) => {
    assert.ok(Math.hypot(c.x - start[i].x, c.z - start[i].z) < 0.01 && Math.abs(c.y - start[i].y) < 0.01, `the ${c.type} stayed put`);
    assert.equal(c.state, 'idle');
  });
  const car = sim.list.find((c) => c.type === 'car');
  sim.pet(car.id, you, 200000);
  sim.step(world, 0.1, 200100, new Map());
  assert.equal(car.state, 'happy', 'honking');
  // Its ground dug away: it falls onto what is under it.
  const w = meadow();
  const sim2 = new CritterSim(2);
  const digger = sim2.add('digger', 20.5, 6, 20.5);
  for (let x = 19; x <= 21; x++) for (let z = 19; z <= 21; z++) w.set(x, 5, z, B.AIR);
  for (let i = 0; i < 30; i++) sim2.step(w, 0.1, i * 100, new Map());
  assert.equal(digger.y, 5, 'down in the hole');
});

test('a car drives faster than you run, honks instead of jumping, and hops up a step', () => {
  const w = meadow();
  for (let z = 0; z < 48; z++) for (let x = 30; x < 48; x++) w.set(x, 6, z, B.GRASS);
  const r = ride(w, 'car', 10.5, 6, 20.5);
  const [first] = go(w, r, { jump: true }, 1 / 60);
  assert.ok(first.trick && !first.jumped, 'a honk, not a jump');
  assert.ok(!go(w, r, { jump: true }, 0.5).some((ev) => ev.trick), 'once for each press');
  go(w, r, { mx: 1, mz: 0 }, 1);
  assert.ok(Math.abs(r.body.vx - CRITTER_INFO.car.ride.walk) < 0.01, `driving at ${r.body.vx}`);
  go(w, r, { mx: 1, mz: 0, run: true }, 3);
  assert.equal(r.body.y, 7, 'up the step');
  assert.ok(Math.abs(r.yaw - Math.PI / 2) < 0.05, 'facing the way it goes');
  assert.ok(!bodyOverlapsSolid(w, r.body));
});

test('a boat stays on the water, at the top of it, and honks', () => {
  const w = new World({ W: 64, H: 32, D: 48, sea: 12 });
  for (let x = 0; x < w.W; x++) {
    for (let z = 0; z < w.D; z++) {
      w.set(x, 0, z, B.MAGIC_FLOOR);
      for (let y = 1; y <= 12; y++) w.set(x, y, z, x >= 40 ? B.SAND : y < 10 ? B.SAND : B.WATER);
    }
  }
  const r = ride(w, 'boat', 20.5, 12.875, 20.5);
  go(w, r, { mx: 1, mz: 0, run: true }, 6);
  assert.ok(r.body.x < 40 && swimmable(w, 'boat', r.body.x, r.body.z), `still on the water, at ${r.body.x.toFixed(2)}`);
  assert.ok(Math.abs(r.body.y - 12.875) < 0.05, 'at the top of it');
  go(w, r, { down: true }, 1);
  assert.ok(Math.abs(r.body.y - 12.875) < 0.05, 'a boat does not dive');
  assert.ok(go(w, r, { jump: true }, 0.2).some((ev) => ev.trick), 'a toot');
  const off = getOffAt(w, r);
  assert.ok(Math.hypot(off.x - r.body.x, off.z - r.body.z) > 0.8, 'getting out beside it, into the water');
});

test('the digger digs a tunnel into a hill, up and down steps, and jewels out of the rock into the basket', () => {
  const w = meadow();
  // A hill of stone, five high, from x = 20 on, with a ruby rock in the way
  // and a brick wall further in.
  for (let x = 20; x < 48; x++) for (let z = 0; z < 48; z++) for (let y = 6; y <= 10; y++) w.set(x, y, z, B.STONE);
  w.set(23, 7, 20, B.GEM_ROCKS[0]);
  for (let z = 0; z < 48; z++) for (let y = 6; y <= 10; y++) w.set(30, y, z, B.TOY_BRICKS[0]);
  const r = ride(w, 'digger', 15.5, 6, 20.5, Math.PI / 2);
  const found = dig(w, r, { mx: 1, mz: 0 }, 6);
  assert.deepEqual(found, [B.GEM_ROCKS[0]], 'the ruby went in the basket');
  assert.ok(r.body.x > 28 && r.body.x < 30 - r.body.radius + 1e-3, `through the stone to the bricks, at ${r.body.x.toFixed(2)}`);
  assert.equal(w.get(30, 7, 20), B.TOY_BRICKS[0], 'never through anything built');
  assert.equal(r.body.y, 6, 'on the level');
  // Three across and three high.
  for (const z of [19, 20, 21]) for (const y of [6, 7, 8]) assert.equal(w.get(25, y, z), B.AIR, `dug at 25,${y},${z}`);
  assert.equal(w.get(25, 9, 20), B.STONE, 'and no higher');
  // Down: straight down while standing still, then down a step as it goes.
  dig(w, r, { down: true }, 0.2);
  go(w, r, {}, 0.5);
  assert.equal(r.body.y, 5, 'down a block');
  const back = ride(w, 'digger', r.body.x, r.body.y, r.body.z, -Math.PI / 2);
  dig(w, back, { mx: -1, mz: 0, down: true }, 0.8);
  assert.ok(back.body.y <= 4, `down a step, at ${back.body.y}`);
  // Up a step at a time, with jump held, until it is out on top of the hill.
  const up = ride(w, 'digger', 26.5, 6, 20.5, 0);
  dig(w, up, { mx: 0, mz: 1, jump: true }, 4);
  go(w, up, {}, 1);
  assert.equal(up.body.y, 11, 'up out on top of the hill');
  assert.ok(!bodyOverlapsSolid(w, up.body));
  // Never the magic floor.
  assert.deepEqual(drillCells(w, { x: 2.5, y: 1, z: 2.5, radius: 0.6 }, 0, 0, 'below'), []);
});

test('a mine cart rolls along its rails, round a corner, up a slope and back down it, and stops at the end of the line', () => {
  const w = meadow();
  // East along z = 10 from x = 10 to 20, a step up at x = 21 (on a stone
  // block), on to x = 24, then a corner north to z = 16.
  const rails = [];
  for (let x = 10; x <= 20; x++) rails.push([x, 6, 10]);
  for (let x = 21; x <= 24; x++) {
    w.set(x, 6, 10, B.STONE);
    rails.push([x, 7, 10]);
  }
  for (let z = 11; z <= 16; z++) {
    w.set(24, 6, z, B.STONE);
    rails.push([24, 7, z]);
  }
  for (const [x, y, z] of rails) w.set(x, y, z, B.RAIL);
  assert.deepEqual(railNext(w, 20, 6, 10, 0), { x: 21, y: 7, z: 10 }, 'the rail a step up');
  const r = ride(w, 'minecart', 12.5, 6, 10.5, 1.4);
  let rolled = 0;
  let bumped = false;
  let high = 0;
  for (const ev of go(w, r, { mx: 1, mz: 0.2 }, 6)) {
    rolled += ev.rolled ?? 0;
    bumped ||= ev.bumped;
    high = Math.max(high, r.body.y);
    assert.ok(r.rail, 'on its rails');
  }
  assert.ok(Math.abs(r.body.x - 24.5) < 1e-6 && Math.abs(r.body.z - 16.5) < 1e-6, `round the corner to the end, at ${r.body.x.toFixed(2)}, ${r.body.z.toFixed(2)}`);
  assert.equal(r.body.y, 7, 'up the slope');
  assert.ok(bumped, 'with a bump at the end');
  assert.ok(Math.abs(rolled - 18) < 1e-6, `${rolled.toFixed(2)} along the rails`);
  assert.equal(rideState(r), 'idle');
  assert.ok(Math.abs(Math.cos(r.yaw)) > 0.99, 'facing along them');
  // Back, and left to roll down the slope by itself: it goes on, and on past
  // the bottom of it, slowing down.
  go(w, r, { mx: 0, mz: -1 }, 1.4);
  go(w, r, {}, 4);
  assert.equal(r.body.y, 6, 'down the slope');
  assert.ok(r.body.x < 20.5, `rolled on past the bottom, to ${r.body.x.toFixed(2)}`);
  // Off the rails, it only creeps along.
  const off = ride(w, 'minecart', 30.5, 6, 30.5);
  go(w, off, { mx: 1, mz: 0 }, 1);
  assert.equal(off.rail, null);
  assert.ok(Math.abs(off.body.vx - CRITTER_INFO.minecart.ride.walk) < 0.01);
});

test('vehicles are brought where there is room for them (a boat on the water), sent away, honked at, and saved facing the way they were', () => {
  let n = 1;
  const room = new Room({ code: '123456', theme: 'sunny', seed: 42, now: () => 1_000_000 + n++ * 10 });
  const inbox = [];
  const c = { send: (t) => inbox.push(JSON.parse(t)), close() {} };
  room.attach(c);
  room.receive(c, { t: 'join', protocol: PROTOCOL, name: 'Driver', look: { animal: 'cat', fur: 'orange', shirt: 3, hat: 'cap' } });
  const last = (t) => [...inbox].reverse().find((m) => m.t === t);
  const w = room.world;
  const s = w.spawn;
  room.receive(c, { t: 'critter', op: 'invite', type: 'car', x: s.x + 4, y: s.y, z: s.z });
  const car = room.critters.get(last('cadd').critter.id);
  assert.ok(fits(w, 'car', car.x, car.y, car.z), 'with room for it');
  assert.ok(Math.abs(Math.atan2(s.x - car.x, s.z - car.z) - car.yaw) < 0.3, 'facing you');
  // On land, there is no water for a boat; by the shore, it is on the water.
  const added = inbox.filter((m) => m.t === 'cadd').length;
  room.receive(c, { t: 'critter', op: 'invite', type: 'boat', x: s.x, y: s.y, z: s.z });
  assert.equal(inbox.filter((m) => m.t === 'cadd').length, added);
  assert.match(last('notice').text, /A boat needs water/);
  let shore = null;
  for (let x = FL(s.x); x < w.W && !shore; x++) if (w.get(x, w.sea, FL(s.z)) === B.WATER) shore = { x: x - 2.5, z: s.z };
  room.receive(c, { t: 'critter', op: 'invite', type: 'boat', x: shore.x, y: w.sea + 1, z: shore.z });
  const boat = room.critters.get(last('cadd').critter.id);
  assert.equal(boat?.type, 'boat');
  assert.ok(swimmable(w, 'boat', boat.x, boat.z), 'on the nearest water');
  // Fruit for a car: only a honk.
  room.receive(c, { t: 'critter', op: 'feed', id: car.id, fruit: 'apple' });
  assert.equal(last('cfx').fx, 'pet');
  assert.equal(car.follow, 0);
  // Driven, a honk goes to everyone.
  room.players.get(1).s = [car.x, car.y, car.z, 0, 0, 0];
  room.receive(c, { t: 'critter', op: 'ride', id: car.id });
  assert.equal(car.rider, 1);
  room.receive(c, { t: 'critter', op: 'trick' });
  assert.equal(last('cfx').fx, 'honk');
  room.receive(c, { t: 'critter', op: 'off' });
  car.yaw = 1.25;
  const save = JSON.parse(JSON.stringify(room.exportSave()));
  const again = new Room({ code: '123456', save, now: () => 2_000_000 });
  const back = again.critters.list.find((o) => o.type === 'car' && Math.abs(o.x - car.x) < 0.01 && Math.abs(o.z - car.z) < 0.01);
  assert.equal(back.yaw, 1.25, 'facing the way it was left');
  room.receive(c, { t: 'critter', op: 'bye', id: car.id });
  assert.equal(room.critters.get(car.id), null, 'sent away');
});

test('an island from before the vehicles gets a car, a boat and a digger, once', () => {
  const room = new Room({ code: '123456', theme: 'snowy', seed: 77, now: () => 1000 });
  const save = JSON.parse(JSON.stringify(room.exportSave()));
  assert.equal(save.v, 8);
  const count = (r) => r.critters.list.filter((c) => VEHICLES.includes(c.type)).length;
  const load = (s) => new Room({ code: '123456', save: JSON.parse(JSON.stringify(s)), now: () => 2000 });
  const old = load({ ...save, v: 6, critters: save.critters.filter((c) => !VEHICLES.includes(c.type)) });
  // (And the bus and the ferry, which came after them.)
  assert.deepEqual(old.critters.list.filter((c) => VEHICLES.includes(c.type)).map((c) => c.type).sort(), ['boat', 'bus', 'car', 'digger', 'ferry']);
  assert.equal(count(load(JSON.parse(JSON.stringify(old.exportSave())))), 5, 'and only once');
  assert.equal(count(load(save)), count(room), 'a new island keeps its own');
});

test('rails are drawn flat and joined: straight, round a corner, and up a slope', () => {
  const w = meadow(16, 16);
  // Straight along x at z = 2; a corner at (8, 8) from +x to +z; a slope at
  // (4, 6, 12) up to a rail at (5, 7, 12).
  for (let x = 1; x <= 3; x++) w.set(x, 6, 2, B.RAIL);
  w.set(8, 6, 8, B.RAIL);
  w.set(9, 6, 8, B.RAIL);
  w.set(8, 6, 9, B.RAIL);
  w.set(4, 6, 12, B.RAIL);
  w.set(5, 6, 12, B.STONE);
  w.set(5, 7, 12, B.RAIL);
  const faceLayer = new Int16Array(256 * 3);
  faceLayer[B.RAIL * 3] = 1;
  faceLayer[B.RAIL * 3 + 1] = 2;
  const light = { skyAt: () => 15, lampAt: () => 0 };
  const m = meshChunk(w, light, { faceLayer, tint: new Uint8Array(256 * 3).fill(255), studTint: new Uint8Array(256 * 3).fill(255) }, 0, 0);
  const quads = [];
  const p = m.plants;
  for (let q = 0; q < p.verts / 4; q++) {
    const vs = [0, 1, 2, 3].map((k) => ({ x: p.pos[(q * 4 + k) * 3], y: p.pos[(q * 4 + k) * 3 + 1], z: p.pos[(q * 4 + k) * 3 + 2], u: p.uvl[(q * 4 + k) * 3], v: p.uvl[(q * 4 + k) * 3 + 1], layer: p.uvl[(q * 4 + k) * 3 + 2] }));
    quads.push(vs);
  }
  const at = (x, z) => quads.find((vs) => Math.min(...vs.map((v) => v.x)) === x && Math.min(...vs.map((v) => v.z)) === z);
  // Straight along x: the texture's way down it (v) goes with x.
  const straight = at(2, 2);
  assert.ok(straight.every((v) => v.layer === 1 && Math.abs(v.y - 6.03) < 1e-5));
  assert.ok(straight.every((v) => Math.abs(v.v - (v.x - 2)) < 1e-6), 'along x');
  // The corner uses the corner picture.
  assert.ok(at(8, 8).every((v) => v.layer === 2));
  // The slope rises a block across its cell, up to the rail beside it.
  const slope = at(4, 12);
  for (const v of slope) assert.ok(Math.abs(v.y - (6.03 + (v.x - 4))) < 1e-5, `at x ${v.x}: ${v.y}`);
});

test('driving earns stickers of its own', () => {
  for (const key of ['drives', 'drilled', 'railed']) assert.ok(STAT_KEYS.includes(key), key);
  const test = (key, stats) => STICKERS.find((s) => s.key === key).test(Object.fromEntries(STAT_KEYS.map((k) => [k, stats[k] ?? 0])));
  assert.ok(test('driver', { drives: 1 }) && !test('driver', {}));
  assert.ok(test('tunneler', { drilled: 100 }) && !test('tunneler', { drilled: 99 }));
  assert.ok(test('mine-train', { railed: 100 }) && !test('mine-train', { railed: 99 }));
});
