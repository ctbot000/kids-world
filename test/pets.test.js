// Pets: what a look keeps of one (any name, a coat of its kind, or none);
// a pet following a player about for ten minutes on every kind of island
// without getting into anything or falling far behind; sitting beside you
// when you stop, lying down, asleep at night; waiting under you while you
// fly; popping over to you when you go a long way at once, or up where it
// cannot follow; riding along; posing in front of you; tricks; a parrot on
// your head and a baby dragon beside you; and every pet's model in every
// state.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as THREE from '../public/vendor/three.module.js';
import { PetModel, petSeat } from '../public/js/render/pet-models.js';
import { CritterModel } from '../public/js/render/critter-models.js';
import * as B from '../public/js/shared/blocks.js';
import { CRITTER_INFO, CRITTER_TYPES, riderAt } from '../public/js/shared/critters.js';
import { bodyOverlapsSolid, makeBody, stepBody } from '../public/js/shared/physics.js';
import { EMOTE_TRICKS, makePet, PET_INFO, petPose, poseSpot, startTrick, stepPet, TRICKS } from '../public/js/shared/pets.js';
import { Rng } from '../public/js/shared/rng.js';
import { cleanLook, cleanPet, EMOTE_KEYS, NAME_MAX, PET_COATS, PETS, randomPetName } from '../public/js/shared/words.js';
import { World } from '../public/js/shared/world.js';
import { generate } from '../public/js/shared/worldgen.js';

const DT = 1 / 60;
const KINDS = PETS.map((p) => p.key);

// A meadow: magic floor, stone, and grass on top at y = 5 (so standing at 6).
function meadow(W = 48, D = 48) {
  const w = new World({ W, H: 40, D, sea: 3 });
  for (let x = 0; x < W; x++) {
    for (let z = 0; z < D; z++) {
      w.set(x, 0, z, B.MAGIC_FLOOR);
      for (let y = 1; y <= 5; y++) w.set(x, y, z, y === 5 ? B.GRASS : B.STONE);
    }
  }
  return w;
}

// You, standing on the ground at (x, y, z).
const standing = (x, y, z) => Object.assign(makeBody(x, y, z), { onGround: true });

// You, as a pet sees you: { x, y, z, yaw, ... } from a body, and what else.
function ownerOf(b, yaw = 0, extra = {}) {
  const speed = Math.hypot(b.vx, b.vz);
  return { x: b.x, y: b.y, z: b.z, yaw, speed, moving: speed > 0.5 || (!b.onGround && !b.inWater && !b.flying), flying: b.flying, swimming: b.inWater, riding: '', head: 1.41, headTaken: false, pose: false, ...extra };
}

// Steps you (moving as input says, and kicking up out of the water) and
// the pet together for a while; look(pet, ev, t) sees each step.
function together(world, me, pet, input, seconds, { night = false, extra = {}, look = () => {} } = {}) {
  let yaw = 0;
  for (let i = 0; i < seconds / DT; i++) {
    stepBody(world, me, { ...input, jump: input.jump || me.inWater }, DT);
    const speed = Math.hypot(me.vx, me.vz);
    if (speed > 0.3) yaw = Math.atan2(me.vx, me.vz);
    const ev = stepPet(world, pet, ownerOf(me, yaw, extra), DT, { night });
    look(pet, ev, i * DT);
  }
}

test('a look keeps a pet of a kind there is, with a coat it comes in and any name, or none', () => {
  const kid = { animal: 'cat', fur: 'orange', shirt: 3, hat: 'cap' };
  assert.deepEqual(cleanLook({ ...kid, pet: { kind: 'puppy', coat: 'brown', name: '  Biscuit  the   Brave ' } }), { ...kid, pet: { kind: 'puppy', coat: 'brown', name: 'Biscuit the Brave' } });
  // None, or one of no kind there is: no pet at all.
  assert.deepEqual(cleanLook(kid), kid);
  assert.deepEqual(cleanLook({ ...kid, pet: { kind: 'lion', coat: 'tan', name: 'Leo' } }), kid);
  assert.deepEqual(cleanLook({ ...kid, pet: 'puppy' }), kid);
  // A coat its kind never comes in, and a name that is none, are its own.
  assert.deepEqual(cleanPet({ kind: 'parrot', coat: 'tan', name: '' }), { kind: 'parrot', coat: 'green', name: 'Polly' });
  assert.deepEqual(cleanPet({ kind: 'kitten', coat: 'gray', name: 'x'.repeat(NAME_MAX + 1) }), { kind: 'kitten', coat: 'gray', name: 'Whiskers' });
  assert.equal(cleanPet({ kind: 'kitten', name: 'a​b' }).name, 'Whiskers', 'nothing invisible');
  // In any language, emoji and all.
  assert.equal(cleanPet({ kind: 'bunny', name: '콩이 🐰' }).name, '콩이 🐰');
  for (const p of PETS) {
    assert.ok(p.coats.every((c) => PET_COATS[c]), `${p.key}: every coat has a colour`);
    assert.ok(PET_INFO[p.key], `${p.key}: it knows how to get about`);
    assert.equal(Boolean(p.flies), Boolean(PET_INFO[p.key].flies));
    const name = randomPetName(p.key, Math.random, p.names[0]);
    assert.ok(p.names.includes(name) && name !== p.names[0], `${p.key}: a new name from its own`);
  }
  // Every emote has a trick.
  for (const e of EMOTE_KEYS) assert.ok(TRICKS[EMOTE_TRICKS[e]], `${e} has a trick`);
});

test('a pet follows a player about for ten minutes on every kind of island, never in a block and never far behind for long', () => {
  for (const theme of ['sunny', 'snowy', 'candy', 'flat']) {
    for (const seed of [7, 4242]) {
      const { world } = generate({ seed, theme });
      const s = world.spawn;
      for (const kind of KINDS) {
        const me = makeBody(s.x, s.y, s.z);
        const pet = makePet(kind, s.x + 1, s.y, s.z, { seed });
        const rng = new Rng(seed * 31 + kind.length);
        const where = `${theme} island ${seed}, a ${kind}`;
        let pops = 0;
        let far = 0;
        let inside = 0;
        const states = new Set();
        let input = { mx: 0, mz: 0 };
        let next = 0;
        let yaw = 0;
        for (let i = 0; i < 600 / DT; i++) {
          const t = i * DT;
          if (t >= next) {
            // Off somewhere for a few seconds, or standing still for a while.
            const a = rng.range(0, Math.PI * 2);
            input = rng.chance(0.35) ? { mx: 0, mz: 0 } : { mx: Math.sin(a), mz: Math.cos(a), run: rng.chance(0.3) };
            next = t + (input.mx ? rng.range(1, 6) : rng.range(2, 16));
          }
          stepBody(world, me, { ...input, jump: me.inWater && rng.chance(0.3) }, DT);
          const speed = Math.hypot(me.vx, me.vz);
          if (speed > 0.3) yaw = Math.atan2(me.vx, me.vz);
          const ev = stepPet(world, pet, ownerOf(me, yaw), DT, { night: t % 600 > 480 });
          if (ev.popped) pops++;
          states.add(petPose(pet));
          for (const v of [pet.x, pet.y, pet.z, pet.yaw]) assert.ok(Number.isFinite(v), `${where}: somewhere`);
          if (Math.hypot(pet.x - me.x, pet.z - me.z) > 8) far += DT;
          const walking = !pet.info.flies || pet.mode === 'land';
          if (walking && bodyOverlapsSolid(world, pet.body)) inside += DT;
          if (!walking && pet.mode === 'fly') assert.ok(!B.SOLID[world.get(Math.floor(pet.x), Math.floor(pet.y + 0.1), Math.floor(pet.z))], `${where}: never flies into a block`);
        }
        assert.ok(inside < 0.1, `${where}: in a block for ${inside.toFixed(2)}s`);
        assert.ok(far < 15, `${where}: far behind for ${far.toFixed(1)}s`);
        assert.ok(pops <= 8, `${where}: popped over ${pops} times`);
        if (pet.info.flies) assert.ok(states.has('fly') && (states.has('perch') || states.has('sit')), `${where}: flies about and settles: ${[...states]}`);
        else assert.ok(['walk', 'sit'].every((st) => states.has(st)), `${where}: walks and sits: ${[...states]}`);
      }
    }
  }
});

test('a pet sits beside you when you stop, looking up at you, lies down after a while, and sleeps at night', () => {
  const world = meadow();
  for (const kind of KINDS.filter((k) => !PET_INFO[k].flies)) {
    const me = makeBody(24.5, 6, 24.5);
    const pet = makePet(kind, 20.5, 6, 20.5);
    // A walk over to the other side...
    together(world, me, pet, { mx: 1, mz: 0 }, 2);
    const d = Math.hypot(pet.x - me.x, pet.z - me.z);
    assert.ok(d > 1 && d < 4, `${kind}: keeps up behind you, ${d.toFixed(2)} away`);
    // ...then standing still: it comes to sit beside you.
    const states = [];
    together(world, me, pet, { mx: 0, mz: 0 }, 6, { look: (p) => states.push(p.state) });
    assert.equal(pet.state, 'sit', kind);
    const side = Math.hypot(pet.x - me.x, pet.z - me.z);
    assert.ok(side > 0.7 && side < 1.6, `${kind}: beside you, ${side.toFixed(2)} away`);
    const look = Math.atan2(me.x - pet.x, me.z - pet.z);
    assert.ok(Math.abs(Math.atan2(Math.sin(look - pet.yaw), Math.cos(look - pet.yaw))) < 0.6, `${kind}: looking at you`);
    together(world, me, pet, { mx: 0, mz: 0 }, 12);
    assert.equal(pet.state, 'lie', `${kind}: lies down after a while`);
    together(world, me, pet, { mx: 0, mz: 0 }, 4, { night: true });
    assert.equal(pet.state, 'sleep', `${kind}: asleep at night`);
    // You go, and it is up and after you.
    together(world, me, pet, { mx: 0, mz: 1 }, 1);
    assert.ok(['walk', 'run'].includes(pet.state), `${kind}: up and after you: ${pet.state}`);
  }
});

test('a pet waits under you while you fly, and pops over to you when you go a long way at once or up where it cannot follow', () => {
  const world = meadow();
  const me = makeBody(24.5, 6, 24.5);
  const pet = makePet('puppy', 23.5, 6, 24.5);
  together(world, me, pet, { mx: 0, mz: 0 }, 2);
  // Up in the air: it waits below, looking up, and pops nowhere.
  me.flying = true;
  let popped = false;
  together(world, me, pet, { mx: 0, mz: 0, jump: true }, 1.5, { look: (p, ev) => (popped ||= Boolean(ev.popped)) });
  together(world, me, pet, { mx: 0, mz: 0 }, 3, { look: (p, ev) => (popped ||= Boolean(ev.popped)) });
  assert.ok(me.y > 12, 'up high');
  assert.equal(popped, false, 'it waits below');
  assert.ok(Math.abs(pet.y - 6) < 0.01 && Math.hypot(pet.x - me.x, pet.z - me.z) < 3, 'on the ground under you');
  // Down on top of a tower it cannot climb: up it pops, after a moment.
  for (let y = 6; y < 14; y++) for (let x = 30; x < 33; x++) for (let z = 23; z < 26; z++) world.set(x, y, z, B.STONE);
  Object.assign(me, { x: 31.5, y: 14, z: 24.5, vx: 0, vy: 0, vz: 0, flying: false });
  const pops = [];
  together(world, me, pet, { mx: 0, mz: 0 }, 6, { look: (p, ev) => ev.popped && pops.push(ev.popped) });
  assert.equal(pops.length, 1, `up it pops, once: ${pops}`);
  assert.ok(pet.y >= 14 && Math.hypot(pet.x - me.x, pet.z - me.z) < 2.5, 'beside you on top');
  // A long way at once (back to the start, say): there at once.
  Object.assign(me, { x: 8.5, y: 6, z: 8.5 });
  const at = [];
  together(world, me, pet, { mx: 0, mz: 0 }, DT, { look: (p, ev) => at.push(ev.popped) });
  assert.deepEqual(at, ['moved']);
  assert.ok(Math.hypot(pet.x - me.x, pet.z - me.z) < 2.5 && Math.abs(pet.y - 6) < 0.01, 'beside you, on the ground');
  assert.ok(!bodyOverlapsSolid(world, pet.body));
});

test('a pet swims after you, and climbs out after you onto the bank', () => {
  // A pond, a block below the grass, in the middle of the meadow.
  const world = meadow();
  for (let x = 16; x < 32; x++) for (let z = 16; z < 32; z++) for (let y = 3; y <= 5; y++) world.set(x, y, z, y === 3 ? B.SAND : B.WATER);
  for (const kind of ['puppy', 'hamster', 'duckling']) {
    const me = makeBody(12.5, 6, 24.5);
    const pet = makePet(kind, 10.5, 6, 24.5);
    const seen = new Set();
    let pops = 0;
    together(world, me, pet, { mx: 1, mz: 0 }, 10, { look: (p, ev) => {
      seen.add(p.state);
      if (ev.popped) pops++;
    } });
    assert.ok(seen.has('swim'), `${kind}: swims: ${[...seen]}`);
    assert.ok(me.x > 33, 'you are across');
    together(world, me, pet, { mx: 0, mz: 0 }, 5, { look: (p, ev) => (pops += ev.popped ? 1 : 0) });
    assert.equal(pops, 0, `${kind}: never popped`);
    assert.ok(pet.x > 32 && Math.abs(pet.y - 6) < 0.01, `${kind}: out on the far bank, at ${pet.x.toFixed(1)}, ${pet.y.toFixed(1)}`);
  }
});

test('a pet rides along with you, and is down beside you when you get off', () => {
  const world = meadow();
  const me = makeBody(24.5, 6, 24.5);
  const pet = makePet('kitten', 22.5, 6, 24.5);
  const events = [];
  const riding = (on) => ({ riding: on ? 'pony' : '' });
  together(world, me, pet, { mx: 0, mz: 0 }, 0.5);
  together(world, me, pet, { mx: 0, mz: 1, run: true }, 3, { extra: riding(true), look: (p, ev) => ev.boarded && events.push('on') });
  assert.deepEqual(events, ['on']);
  assert.equal(pet.mode, 'ride');
  assert.ok(Math.hypot(pet.x - me.x, pet.z - me.z) < 0.01, 'right with you');
  together(world, me, pet, { mx: 0, mz: 0 }, 2, { look: (p, ev) => ev.alighted && events.push('off') });
  assert.deepEqual(events, ['on', 'off']);
  assert.notEqual(pet.mode, 'ride');
  assert.ok(Math.hypot(pet.x - me.x, pet.z - me.z) < 2.6 && Math.abs(pet.y - 6) < 0.01, 'down beside you');
});

test('posing with you, a pet sits in front of you looking out the way you do', () => {
  const world = meadow();
  for (const kind of KINDS) {
    const me = standing(24.5, 6, 24.5);
    const pet = makePet(kind, 21.5, 6, 21.5);
    const yaw = 2.2;
    for (let i = 0; i < 5 / DT; i++) stepPet(world, pet, ownerOf(me, yaw, { pose: true }), DT);
    const spot = poseSpot(ownerOf(me, yaw));
    if (kind === 'parrot') {
      // A parrot sits on your head for the picture.
      assert.equal(pet.mode, 'perch');
      assert.ok(Math.abs(pet.y - 6 - 1.41) < 0.01);
      continue;
    }
    assert.ok(Math.hypot(pet.x - spot.x, pet.z - spot.z) < 0.35, `${kind}: in front of you, ${Math.hypot(pet.x - spot.x, pet.z - spot.z).toFixed(2)} from the spot`);
    assert.equal(pet.state, 'sit', kind);
    assert.ok(Math.abs(Math.atan2(Math.sin(pet.yaw - yaw), Math.cos(pet.yaw - yaw))) < 0.15, `${kind}: looking out with you`);
  }
});

test('a trick plays for a while, a jump leaves the ground, and walking off cuts it short', () => {
  const world = meadow();
  const me = makeBody(24.5, 6, 24.5);
  const pet = makePet('puppy', 23.5, 6, 24.5);
  together(world, me, pet, { mx: 0, mz: 0 }, 2);
  startTrick(pet, 'jump');
  let top = 0;
  together(world, me, pet, { mx: 0, mz: 0 }, 0.6, { look: (p) => (top = Math.max(top, p.y)) });
  assert.ok(top > 6.5, `up in the air: ${top.toFixed(2)}`);
  startTrick(pet, 'roll');
  together(world, me, pet, { mx: 0, mz: 0 }, 1);
  assert.equal(petPose(pet), 'roll');
  together(world, me, pet, { mx: 0, mz: 0 }, 1.2);
  assert.notEqual(petPose(pet), 'roll', 'done after a while');
  startTrick(pet, 'spin');
  together(world, me, pet, { mx: 1, mz: 0, run: true }, 1.5);
  assert.notEqual(petPose(pet), 'spin', 'you went: it comes along instead');
});

test('a parrot sits on your head while you stand still (beside you while a friend is there), and a baby dragon lands beside you', () => {
  const world = meadow();
  const me = standing(24.5, 6, 24.5);
  const parrot = makePet('parrot', 22, 8, 24.5);
  const dragon = makePet('dragon', 27, 8, 24.5);
  for (let i = 0; i < 4 / DT; i++) {
    stepPet(world, parrot, ownerOf(me, 0, { head: 1.6 }), DT);
    stepPet(world, dragon, ownerOf(me, 0), DT);
  }
  assert.equal(parrot.mode, 'perch');
  assert.ok(Math.hypot(parrot.x - me.x, parrot.z - me.z) < 0.01 && Math.abs(parrot.y - me.y - 1.6) < 0.01, 'on top of your hat');
  assert.equal(dragon.mode, 'land');
  assert.ok(Math.abs(dragon.y - 6) < 0.01 && Math.hypot(dragon.x - me.x, dragon.z - me.z) < 1.6, 'on the ground beside you');
  assert.equal(dragon.state, 'sit');
  // A bird you fed sits on your head: the parrot comes down beside you instead.
  for (let i = 0; i < 4 / DT; i++) stepPet(world, parrot, ownerOf(me, 0, { headTaken: true }), DT);
  assert.equal(parrot.mode, 'land');
  // Off you go: both fly after you, and never into the ground.
  for (let i = 0; i < 3 / DT; i++) {
    stepBody(world, me, { mx: 1, mz: 0 }, DT);
    for (const p of [parrot, dragon]) stepPet(world, p, ownerOf(me, Math.PI / 2), DT);
  }
  for (const p of [parrot, dragon]) {
    assert.equal(p.mode, 'fly');
    assert.ok(p.y > 6.5 && Math.hypot(p.x - me.x, p.z - me.z) < 3, `${p.kind}: flying along beside you`);
  }
});

test("every pet's model can be drawn in every coat and every pose, in its owner's colour", () => {
  const poses = ['idle', 'walk', 'run', 'jump', 'swim', 'sit', 'lie', 'sleep', 'fly', 'hover', 'perch', ...Object.keys(TRICKS)];
  for (const p of PETS) {
    for (const coat of p.coats) {
      const m = new PetModel({ kind: p.key, coat }, '#3a7bd5');
      assert.equal(`#${m.band.color.getHexString()}`, '#3a7bd5', `${p.key}: a collar in its owner's colour`);
      m.setCollar('#ff0000');
      assert.equal(`#${m.band.color.getHexString()}`, '#ff0000');
      for (const pose of poses) {
        for (let i = 0; i < 4; i++) {
          m.group.position.x += 0.1;
          m.update(0.3, pose);
        }
        m.group.updateMatrixWorld(true);
        m.group.traverse((o) => {
          if (o.isMesh) assert.ok(o.matrixWorld.elements.every(Number.isFinite), `${p.key} (${coat}), ${pose}: every part is somewhere`);
        });
      }
      assert.ok(m.height > 0.25 && m.height < 0.6 && m.pick > 0.2, `${p.key}: about as big as a pet`);
      m.dispose();
    }
  }
});

test('a pet riding along sits on the back of the animal or in the vehicle, behind its rider', () => {
  const up = new THREE.Vector3(0, 1, 0);
  for (const type of CRITTER_TYPES.filter((t) => CRITTER_INFO[t].ride)) {
    const mount = new CritterModel(type, 0);
    mount.group.position.set(10, 5, 10);
    mount.group.rotation.y = 0.7;
    const seat = petSeat(mount);
    const rider = riderAt(type, { x: 10, y: 5, z: 10, yaw: 0.7 });
    // Behind the rider's middle, the way it faces.
    const back = (seat.x - rider.x) * Math.sin(0.7) + (seat.z - rider.z) * Math.cos(0.7);
    assert.ok(back < -0.2, `${type}: behind its rider, ${back.toFixed(2)}`);
    assert.equal(seat.yaw, 0.7);
    // Right on top of it: the highest point of it under where the pet sits
    // (not the hit of one ray through the middle, which can fall into a dip).
    mount.group.updateMatrixWorld(true);
    let top = -Infinity;
    let middle = -Infinity;
    for (const dx of [-0.07, 0, 0.07]) {
      for (const dz of [-0.07, 0, 0.07]) {
        const ray = new THREE.Raycaster(new THREE.Vector3(seat.x + dx, seat.y + 3, seat.z + dz), up.clone().negate());
        const hit = ray.intersectObject(mount.group, true).find((h) => !mount.saddle || !h.object.parent || h.object.parent !== mount.saddle);
        if (hit) top = Math.max(top, hit.point.y);
        if (hit && !dx && !dz) middle = hit.point.y;
      }
    }
    assert.ok(Math.abs(top - seat.y) < 0.03, `${type}: sitting on it (${top.toFixed(2)} under ${seat.y.toFixed(2)})`);
    assert.ok(seat.y - middle < 0.35, `${type}: not up in the air over it`);
    mount.dispose();
  }
});
