// The mightiest toy weapons (shared/shop.js), at the host and in the hand: each
// harder than everything before it, and each with a way of its own. A Thunder
// Spear's bolt leaping on from what it stabs, a Galaxy Blade's spin, a Rainbow
// Ray reaching furthest, and a Meteor Staff's meteor on everything in its blast.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as B from '../public/js/shared/blocks.js';
import { DRAGON_HEARTS } from '../public/js/shared/dragon.js';
import { ARM_REACH } from '../public/js/shared/monsters.js';
import { PROTOCOL, Room } from '../public/js/shared/room.js';
import { cleanGear, lookWithGear, METEOR_FALL_MS, nextLevel, WEAPONS, weaponOf, wornWeapon } from '../public/js/shared/shop.js';
import { cleanLook } from '../public/js/shared/words.js';
import { World } from '../public/js/shared/world.js';
import { Avatar, SWINGS, swingPose } from '../public/js/render/avatar.js';

const LOOK = { animal: 'cat', fur: 'orange', shirt: 3, hat: 'none' };

// A flat meadow with monsters on and someone on it with weapon in hand, facing
// the way z goes. monster(dx, dz, hearts): one held still that far from them.
function meadow(weapon) {
  const time = { t: 1_000_000 };
  const room = new Room({ code: '123456', theme: 'flat', seed: 7, now: () => time.t, settings: { monsters: true } });
  const W = 96;
  const w = new World({ W, H: 32, D: W, sea: 4, theme: 'flat', spawn: { x: W / 2 + 0.5, y: 11, z: W / 2 + 0.5 } });
  for (let x = 0; x < W; x++) for (let z = 0; z < W; z++) for (let y = 0; y <= 10; y++) w.set(x, y, z, y === 10 ? B.GRASS : B.DIRT);
  room.world = w;
  room.hookWorld();
  room.critters.list.length = 0;
  room.monsters.spawnAt = Infinity;
  const c = { inbox: [], close() {} };
  c.send = (text) => c.inbox.push(JSON.parse(text));
  c.all = (t, kind) => c.inbox.filter((m) => m.t === t && (!kind || m.kind === kind));
  room.attach(c);
  room.receive(c, { t: 'join', protocol: PROTOCOL, name: 'Brave Otter', look: { ...LOOK, ...(weapon ? { weapon } : {}) } });
  const { x, z } = w.spawn;
  room.receive(c, { t: 'm', s: [x, 11, z, 0, 0, 0] });
  const monster = (dx, dz, hearts = 30) => {
    const m = room.monsters.add(w, x + dx, 11, z + dz);
    Object.assign(m.body, { x: x + dx, y: 11, z: z + dz, vx: 0, vy: 0, vz: 0 });
    m.giggle = Infinity;
    m.hearts = hearts;
    m.max = hearts;
    return m;
  };
  return { room, time, w, c, x, z, monster, pid: c.all('welcome')[0].you };
}

test('the mightiest go last, each dearer and harder than everything before it, so saved weapons stay what they were', () => {
  assert.deepEqual(
    WEAPONS.map((w) => w.key),
    ['sword', 'blaster', 'hammer', 'lavablade', 'bombrod', 'bow', 'thunderspear', 'galaxyblade', 'rainbowray', 'meteorstaff'],
  );
  for (const [i, w] of WEAPONS.entries()) {
    if (i < 6) continue;
    for (const before of WEAPONS.slice(0, i)) {
      assert.ok(w.price > before.price, `${w.name} dearer than the ${before.name}`);
      assert.ok(w.power > before.power, `${w.name} takes more hearts than the ${before.name}`);
      assert.ok(w.king > before.king, `a boss feels the ${w.name} more than the ${before.name}`);
    }
    assert.ok(w.does.length > 20 && w.icon && w.uses > 0, w.name);
  }
  // Bought one after another, and each in the look friends and the island see.
  const look = { ...LOOK };
  for (const [i, w] of WEAPONS.entries()) {
    assert.equal(nextLevel(cleanGear({ weapon: i }), 'weapon').key, w.key);
    assert.equal(wornWeapon(cleanGear({ weapon: i + 1 })).key, w.key);
    assert.equal(cleanLook(lookWithGear(look, cleanGear({ weapon: i + 1 }))).weapon, w.key);
  }
  assert.equal(nextLevel(cleanGear({ weapon: WEAPONS.length }), 'weapon'), null, 'the Meteor Staff is the best there is');
  // A Lava Blade picked before they came is still what is in your hand.
  assert.equal(wornWeapon(cleanGear({ weapon: 10, pick: { weapon: 4 } })).key, 'lavablade');
});

test('a Thunder Spear\'s bolt leaps on from what it stabs to the nearest three, each taking its blow, as the stabber\'s', () => {
  const { room, c, monster, pid } = meadow('thunderspear');
  const stabbed = monster(0, 3);
  const a = monster(3, 3);
  const b = monster(3, 6);
  const d = monster(0, 7);
  const fourth = monster(-3, 8);
  const far = monster(30, 3);
  c.inbox.length = 0;
  room.receive(c, { t: 'bop', id: stabbed.id });
  const { power } = weaponOf('thunderspear');
  for (const m of [stabbed, a, b, d]) assert.equal(m.hearts, 30 - power, `${m.id} took the spear's blow`);
  assert.equal(fourth.hearts, 30, 'three leaps and no more');
  assert.equal(far.hearts, 30, 'and only to those nearby');
  // Everyone is told the way it went, and each hit is the stabber's.
  assert.deepEqual(c.all('fx', 'bolt').map((m) => m.ids), [[stabbed.id, a.id, b.id, d.id]]);
  assert.equal(c.all('fx', 'bolt')[0].pid, pid);
  for (const m of [a, b, d]) assert.ok(c.all('mhit').some((hit) => hit.id === m.id && hit.by === pid));
  assert.ok(a.body.vx > 0, 'knocked on the way the bolt went');
});

test('a Thunder Spear\'s bolt pops what it has the last hearts of, goes through no wall and never finds a mole underground', () => {
  const { room, w, c, x, z, monster } = meadow('thunderspear');
  const stabbed = monster(0, 3, 4);
  const little = monster(3, 3, 2);
  // Behind a wall from the one stabbed, and from the little one too.
  const walled = monster(-3, 3);
  for (let y = 11; y < 15; y++) for (let dz = -3; dz <= 9; dz++) w.set(Math.floor(x - 2), y, Math.floor(z + dz), B.STONE);
  const mole = monster(1, 5);
  mole.under = true;
  c.inbox.length = 0;
  room.receive(c, { t: 'bop', id: stabbed.id });
  assert.equal(room.monsters.get(stabbed.id), null, 'the one stabbed pops');
  assert.equal(room.monsters.get(little.id), null, 'and the one it leapt to');
  assert.equal(c.all('pop').length, 2);
  assert.equal(walled.hearts, 30, 'no bolt through a wall');
  assert.equal(mole.hearts, 30, 'none into the ground');
  assert.deepEqual(c.all('fx', 'bolt')[0].ids, [stabbed.id, little.id]);
  // Any other weapon's bop stays on the one it hit.
  const sword = meadow('sword');
  const one = sword.monster(0, 2);
  const other = sword.monster(2, 2);
  sword.room.receive(sword.c, { t: 'bop', id: one.id });
  assert.equal(one.hearts, 30 - weaponOf('sword').power);
  assert.equal(other.hearts, 30);
  assert.equal(sword.c.all('fx', 'bolt').length, 0);
});

test('a Rainbow Ray reaches further than anything else, and a Galaxy Blade pops a monster from all round you', () => {
  for (const w of WEAPONS) if (w.key !== 'rainbowray') assert.ok(weaponOf('rainbowray').reach > w.reach, `further than the ${w.name}`);
  const ray = meadow('rainbowray');
  const inLine = [ray.monster(0, 3), ray.monster(0, 5), ray.monster(0, ARM_REACH + weaponOf('rainbowray').reach)];
  for (const m of inLine) ray.room.receive(ray.c, { t: 'bop', id: m.id });
  for (const m of inLine) assert.equal(m.hearts, 30 - weaponOf('rainbowray').power, 'each along the beam');
  const tooFar = ray.monster(0, ARM_REACH + weaponOf('rainbowray').reach + 2.5);
  ray.room.receive(ray.c, { t: 'bop', id: tooFar.id });
  assert.equal(tooFar.hearts, 30, 'but not across the meadow');
  const blade = meadow('galaxyblade');
  const round = [[0, 2.4], [2.4, 0], [0, -2.4], [-2.4, 0]].map(([dx, dz]) => blade.monster(dx, dz));
  for (const m of round) blade.room.receive(blade.c, { t: 'bop', id: m.id });
  for (const m of round) assert.equal(m.hearts, 30 - weaponOf('galaxyblade').power, 'in front, behind and to each side');
});

test('a Meteor Staff\'s meteor comes down a moment on, on everything in a blast far wider than a bomb\'s', () => {
  const { room, time, c, x, z, monster, pid } = meadow('meteorstaff');
  const { power, blast } = weaponOf('meteorstaff');
  const under = monster(0, 4);
  const side = monster(blast - 0.2, 4);
  const little = monster(-2, 5, 5);
  const far = monster(blast + 4, 4);
  c.inbox.length = 0;
  room.receive(c, { t: 'bomb', d: 4 });
  assert.ok(c.all('fx', 'meteor').some((m) => m.pid === pid && m.tz === Math.floor(z + 4) + 0.5), 'friends see it called');
  assert.equal(under.hearts, 30, 'nothing while it falls');
  time.t += METEOR_FALL_MS - 50;
  room.tick();
  assert.equal(c.all('fx', 'blast').length, 0, 'not until it lands');
  time.t += 50;
  room.tick();
  const [boom] = c.all('fx', 'blast');
  assert.ok(boom?.meteor, 'it lands, and everyone is told it was a meteor');
  assert.equal(boom.by, pid);
  assert.equal(boom.x, Math.floor(x) + 0.5);
  assert.equal(boom.z, Math.floor(z + 4) + 0.5);
  assert.equal(under.hearts, 30 - power);
  assert.equal(side.hearts, 30 - power, 'right out to the edge of the blast');
  assert.equal(room.monsters.get(little.id), null, 'and pops what it is enough for');
  assert.equal(far.hearts, 30, 'none beyond it');
  // No further off than it can be called, whatever it is asked.
  c.inbox.length = 0;
  room.receive(c, { t: 'bomb', d: 99 });
  time.t += METEOR_FALL_MS;
  room.tick();
  assert.equal(c.all('fx', 'blast')[0].z, Math.floor(z + 7) + 0.5);
});

test('a meteor needs the staff in hand; a bomb is still a bomb', () => {
  for (const weapon of [null, 'sword', 'galaxyblade']) {
    const { room, time, c } = meadow(weapon);
    c.inbox.length = 0;
    room.receive(c, { t: 'bomb', d: 4 });
    time.t += METEOR_FALL_MS;
    room.tick();
    assert.equal(c.all('fx').length, 0, `nothing with ${weapon}`);
  }
  const { room, time, c } = meadow('bombrod');
  c.inbox.length = 0;
  room.receive(c, { t: 'bomb', d: 4 });
  time.t += METEOR_FALL_MS;
  room.tick();
  assert.equal(c.all('fx', 'lob').length, 1);
  assert.equal(c.all('fx', 'meteor').length, 0);
  assert.equal(c.all('fx', 'blast')[0].meteor, undefined);
});

test('a meteor shakes the jewels out of gem rocks further round than a bomb, and digs and breaks nothing', () => {
  const { room, time, w, c, x, z } = meadow('meteorstaff');
  const [cx, cz] = [Math.floor(x), Math.floor(z + 4)];
  const gem = B.GEM_ROCKS[0];
  w.set(cx + 3, 10, cz, gem);
  w.set(cx + 1, 11, cz, B.TOY_BRICKS[0]);
  c.inbox.length = 0;
  room.receive(c, { t: 'bomb', d: 4 });
  time.t += METEOR_FALL_MS;
  room.tick();
  assert.deepEqual(c.all('fx', 'blast')[0].gems, [gem]);
  assert.equal(w.get(cx + 3, 10, cz), B.AIR);
  assert.equal(w.get(cx, 10, cz), B.GRASS, 'the ground is never dug');
  assert.equal(w.get(cx + 1, 11, cz), B.TOY_BRICKS[0], 'a toy brick stands');
});

test('a meteor catches a wild dragon too, as a bomb never does', () => {
  const dragonOn = (weapon) => {
    const m = meadow(weapon);
    const dragon = m.room.critters.add('dragon', m.x, 11, m.z + 5, 'Ember', 0);
    m.c.inbox.length = 0;
    m.room.receive(m.c, { t: 'bomb', d: 4 });
    m.time.t += METEOR_FALL_MS;
    m.room.tick();
    return { ...m, dragon };
  };
  const hit = dragonOn('meteorstaff');
  assert.equal(hit.dragon.fight.hearts, DRAGON_HEARTS - weaponOf('meteorstaff').power);
  assert.ok(hit.c.all('dhit').some((m) => m.id === hit.dragon.id));
  const bombed = dragonOn('bombrod');
  assert.equal(bombed.c.all('dhit').length, 0);
});

test('the Galaxy Blade spins you right round once and ends where it began; no other swing turns you', () => {
  for (const [kind, swing] of Object.entries(SWINGS)) {
    for (const k of [0, 0.3, 0.5, 0.9]) if (kind !== 'galaxyblade') assert.equal(swingPose(swing, k).spin, 0, kind);
  }
  const swing = SWINGS.galaxyblade;
  assert.equal(swingPose(swing, 0).spin, 0);
  assert.equal(swingPose(swing, 1).spin, Math.PI * 2, 'one whole turn: nothing to see as it stops');
  const at = (k) => swingPose(swing, k).spin;
  assert.ok(at(swing.strike) > Math.PI * 1.7, 'round to the front again as it lands');
  for (let k = 0; k < 1; k += 0.01) assert.ok(at(k + 0.01) >= at(k), 'always the one way');
  const av = new Avatar({ animal: 'kid', shirt: 1, hat: 'none', weapon: 'galaxyblade' });
  av.update(1 / 60, 0, 0);
  assert.equal(av.body.rotation.y, 0);
  av.swing();
  av.update(swing.secs * 0.45, 0, 0);
  assert.ok(Math.abs(av.body.rotation.y) > 1, `turning: ${av.body.rotation.y}`);
  av.update(swing.secs, 0, 0);
  assert.equal(av.body.rotation.y, 0, 'and back as it was');
});

test('what shoots has a muzzle, out in front of you at the end of it; what does not, has none', () => {
  for (const key of ['thunderspear', 'rainbowray', 'meteorstaff']) {
    const av = new Avatar({ animal: 'kid', shirt: 1, hat: 'none', weapon: key });
    av.update(1 / 60, 0, 0);
    av.root.updateMatrixWorld(true);
    const at = av.muzzle();
    assert.ok(at && at.z > 0.3, `${key}: ${at?.z}`);
  }
  for (const key of ['sword', 'galaxyblade']) assert.equal(new Avatar({ animal: 'kid', shirt: 1, hat: 'none', weapon: key }).muzzle(), null, key);
  assert.equal(new Avatar({ animal: 'kid', shirt: 1, hat: 'none' }).muzzle(), null, 'an empty hand');
});
