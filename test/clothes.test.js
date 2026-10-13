// Clothes from the shop: tidied as kept, in the look the island sees only
// while worn, bought and put on through your profile, added up for a guest;
// the Hero Cape jumping up onto a wall two blocks tall, Knight Armor halving
// a bump at the host, the Fire Suit keeping the lava from burning; and each
// drawn on every kind of avatar, a cape flying out behind on the run.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as B from '../public/js/shared/blocks.js';
import { addProgress } from '../public/js/shared/keeper.js';
import { BUMP_HP, maxHp } from '../public/js/shared/monsters.js';
import { makeBody, MOVE, stepBody } from '../public/js/shared/physics.js';
import { PROTOCOL, Room } from '../public/js/shared/room.js';
import { CLOTHES, cleanGear, gearMove, hasPower, lookWithGear, outfitOf, wornOutfit } from '../public/js/shared/shop.js';
import { cleanLook } from '../public/js/shared/words.js';
import { ANIM, Avatar } from '../public/js/render/avatar.js';
import { World } from '../public/js/shared/world.js';

const LOOK = { animal: 'fox', fur: 'orange', shirt: 2, hat: 'none' };

test('clothes are tidied: only real ones, each once, and only one you have on', () => {
  assert.deepEqual(cleanGear({ clothes: ['robe', 'cape', 'tutu', 'cape', 3], outfit: 'robe' }).clothes, ['cape', 'robe'], 'in shop order');
  assert.equal(cleanGear({ clothes: ['robe'], outfit: 'robe' }).outfit, 'robe');
  assert.equal(cleanGear({ clothes: ['robe'], outfit: 'cape' }).outfit, '', 'not one of yours');
  assert.equal(cleanGear({ clothes: 'cape', outfit: 'cape' }).outfit, '');
  for (const c of CLOTHES) assert.ok(c.price > 0 && c.icon && c.does && outfitOf(c.key) === c, c.key);
  assert.ok(CLOTHES.some((c) => !c.power) && CLOTHES.some((c) => c.power), 'some for looks, some with a power');
});

test('clothes are in the look the island sees while you have them on, and only real ones', () => {
  assert.equal(lookWithGear(LOOK, cleanGear({ clothes: ['cape'], outfit: 'cape' })).outfit, 'cape');
  assert.equal(lookWithGear({ ...LOOK, outfit: 'cape' }, cleanGear({ clothes: ['cape'] })).outfit, undefined, 'taken off');
  assert.equal(lookWithGear({ ...LOOK, outfit: 'cape' }, cleanGear({})).outfit, undefined, 'not bought');
  assert.equal(cleanLook({ ...LOOK, outfit: 'armor' }).outfit, 'armor');
  assert.equal(cleanLook({ ...LOOK, outfit: 'tutu' }).outfit, undefined);
  assert.ok(hasPower({ outfit: 'firesuit' }, 'fireproof'));
  assert.ok(!hasPower({ outfit: 'robe' }, 'fireproof'));
  assert.ok(!hasPower(null, 'armor'));
});

test('buying clothes puts them on; any of yours can be put on, or none', async () => {
  const store = new Map();
  globalThis.localStorage = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k), key: (i) => [...store.keys()][i] ?? null, get length() { return store.size; } };
  try {
    const { Profile } = await import('../public/js/profile.js');
    const p = new Profile();
    p.earn(200);
    assert.equal(p.buyClothes('robe'), false, 'not enough coins');
    assert.equal(p.buyClothes('cape'), true);
    assert.equal(p.data.coins, 200 - outfitOf('cape').price);
    assert.equal(wornOutfit(p.data.gear).key, 'cape');
    assert.equal(p.shownLook.outfit, 'cape');
    assert.equal(p.buyClothes('cape'), false, 'once is enough');
    assert.equal(p.buyClothes('scarf'), true);
    assert.deepEqual(p.data.gear.clothes, ['scarf', 'cape']);
    assert.equal(p.data.gear.outfit, 'scarf');
    assert.equal(p.putOn('cape'), true);
    assert.equal(p.shownLook.outfit, 'cape');
    assert.equal(p.putOn('robe'), false, 'not yours');
    assert.equal(p.putOn(''), true);
    assert.equal(p.shownLook.outfit, undefined);
    assert.deepEqual(new Profile().data.gear.clothes, ['scarf', 'cape'], 'kept');
  } finally {
    delete globalThis.localStorage;
  }
});

test('a guest\'s clothes join a login\'s', () => {
  const gear = addProgress({ gear: { weapon: 1, pick: { weapon: 1 }, clothes: ['robe'], outfit: 'robe' } }, { gear: { weapon: 3, clothes: ['cape', 'robe'] } }).gear;
  assert.deepEqual(gear.clothes, ['cape', 'robe']);
  assert.equal(gear.outfit, 'robe');
  assert.equal(gear.weapon, 3);
  assert.deepEqual(gear.pick, { weapon: 1 }, 'the pick left as it was');
});

// How high a jump from flat ground goes, in the gear.
function jumpHeight(gear) {
  const w = new World({ W: 16, H: 20, D: 16, sea: 0 });
  for (let x = 0; x < 16; x++) for (let z = 0; z < 16; z++) w.set(x, 4, z, B.STONE);
  const b = makeBody(8, 5, 8);
  for (let i = 0; i < 30; i++) stepBody(w, b, {}, 1 / 60);
  let top = b.y;
  stepBody(w, b, { jump: true }, 1 / 60, { move: gearMove(gear, MOVE) });
  for (let i = 0; i < 120; i++) {
    stepBody(w, b, {}, 1 / 60, { move: gearMove(gear, MOVE) });
    top = Math.max(top, b.y);
  }
  return top - 5;
}

test('the Hero Cape jumps up onto a wall two blocks tall, which nobody can without it', () => {
  const plain = jumpHeight(cleanGear({}));
  const cape = jumpHeight(cleanGear({ clothes: ['cape'], outfit: 'cape' }));
  assert.ok(plain < 2, `${plain} without`);
  assert.ok(cape > 2.05, `${cape} with`);
  assert.equal(jumpHeight(cleanGear({ clothes: ['cape'] })), plain, 'taken off, as high as anyone');
  assert.equal(gearMove(cleanGear({ clothes: ['robe'], outfit: 'robe' }), MOVE), null, 'a robe is just for looks');
});

function conn() {
  const c = { inbox: [] };
  c.send = (text) => c.inbox.push(JSON.parse(text));
  c.close = () => {};
  c.last = (t) => [...c.inbox].reverse().find((m) => m.t === t);
  c.all = (t) => c.inbox.filter((m) => m.t === t);
  return c;
}

function join(room, outfit) {
  const c = conn();
  room.attach(c);
  room.receive(c, { t: 'join', protocol: PROTOCOL, name: 'Brave Dragon', look: { ...LOOK, ...(outfit ? { outfit } : {}) } });
  return c;
}

test('Knight Armor takes half of a monster\'s bump', () => {
  let t = 1_000_000;
  const room = new Room({ code: '123456', seed: 7, now: () => t, settings: {} });
  const plain = join(room);
  const knight = join(room, 'armor');
  for (const c of [plain, knight]) {
    const pid = c.last('welcome').you;
    const p = room.players.get(pid);
    room.hurt(pid, { id: 0, kind: 'blob', body: { x: p.s[0], z: p.s[2] + 1 } }, t);
  }
  const full = maxHp(1);
  const hpOf = (c) => c.all('bump').find((m) => m.pid === c.last('welcome').you).hp;
  assert.equal(hpOf(plain), full - BUMP_HP);
  assert.equal(hpOf(knight), full - BUMP_HP / 2);
});

test('lava never burns anyone in a Fire Suit', () => {
  let t = 1_000_000;
  const room = new Room({ code: '123456', theme: 'volcano', seed: 7, now: () => t, settings: {} });
  const w = new World({ W: 32, H: 24, D: 32, sea: 4, theme: 'volcano', spawn: { x: 4.5, y: 11, z: 16.5 } });
  for (let x = 0; x < 32; x++) for (let z = 0; z < 32; z++) {
    w.set(x, 0, z, B.MAGIC_FLOOR);
    for (let y = 1; y <= 10; y++) w.set(x, y, z, y === 10 ? B.BASALT : B.STONE);
  }
  for (let x = 14; x <= 18; x++) for (let z = 14; z <= 18; z++) for (const y of [11, 12]) w.set(x, y, z, B.LAVA);
  room.world = w;
  room.critters.list.length = 0;
  room.hookWorld();
  const plain = join(room);
  const suited = join(room, 'firesuit');
  for (let i = 0; i < 30; i++) {
    t += 100;
    for (const c of [plain, suited]) room.receive(c, { t: 'm', s: [16.5, 11.5, 16.5, 0, 0, 0] });
    room.tick();
  }
  assert.ok(plain.all('bump').some((m) => m.lava && m.pid === plain.last('welcome').you), 'it burns without one');
  assert.ok(!suited.all('bump').some((m) => m.lava && m.pid === suited.last('welcome').you), 'not in one');
});

test('every kind of clothes is drawn on every kind of avatar, and a cape flies out behind on the run', () => {
  for (const c of CLOTHES) {
    for (const animal of ['kid', 'grownup', 'bear']) {
      const plain = new Avatar({ ...LOOK, animal });
      const av = new Avatar({ ...LOOK, animal, outfit: c.key });
      const count = (a) => {
        let n = 0;
        a.root.traverse((o) => (n += o.isMesh ? 1 : 0));
        return n;
      };
      assert.ok(count(av) > count(plain), `${c.key} on ${animal}`);
      av.update(1 / 60, ANIM.idle, 0);
    }
  }
  const av = new Avatar({ ...LOOK, outfit: 'cape' });
  for (let i = 0; i < 60; i++) av.update(1 / 60, ANIM.idle, 0);
  const still = av.outfit.part.rotation.x;
  for (let i = 0; i < 60; i++) av.update(1 / 60, ANIM.run, 6);
  assert.ok(av.outfit.part.rotation.x > still + 0.4, `out behind running (${still} → ${av.outfit.part.rotation.x})`);
  assert.equal(new Avatar(LOOK).outfit, null);
});
