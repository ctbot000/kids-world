// The players: every animal, every kid and every grown-up (each hair style
// under each hat, and each grown-up's face) can be drawn in every pose, and a flying friend on someone's head sits on
// their hair or their hat, neither in it nor above it.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as THREE from '../public/vendor/three.module.js';
import { ANIM, Avatar } from '../public/js/render/avatar.js';
import { headTop } from '../public/js/shared/critters.js';
import { ANIMALS, cleanLook, EMOTE_KEYS, FACES, GROWN_TALL, GROWN_UP, HAIR_COLORS, HAIRS, HATS, isPerson, KID, lookHair, lookIcon, lookTall, randomLook, SKIN_TONES } from '../public/js/shared/words.js';

const LOOKS = ANIMALS.flatMap((a) =>
  HATS.flatMap((hat, i) =>
    isPerson({ animal: a.key })
      ? HAIRS.map((hair, j) => ({
          animal: a.key,
          fur: a.fur,
          shirt: i,
          hat: hat.key,
          skin: Object.keys(SKIN_TONES)[j % 6],
          hair: hair.key,
          hairColor: Object.keys(HAIR_COLORS)[(i + j) % 10],
          ...(a.key === GROWN_UP ? { face: FACES[(i + j) % FACES.length].key } : {}),
        }))
      : [{ animal: a.key, fur: a.fur, shirt: i, hat: hat.key }],
  ),
);
const named = (look) => `${look.animal}${look.hair ? ` with ${look.hair} hair` : ''}${look.face ? ` and ${look.face}` : ''} in a ${look.hat} hat`;

test('every animal, kid and grown-up can be drawn in every pose', () => {
  for (const look of LOOKS) {
    const a = new Avatar(look);
    const poses = [...Object.values(ANIM).map((anim) => [anim, null]), ...EMOTE_KEYS.map((emote) => [ANIM.idle, emote])];
    for (const [anim, emote] of poses) {
      if (emote) a.playEmote(emote);
      for (let i = 0; i < 3; i++) a.update(0.25, anim, 3);
      a.root.updateMatrixWorld(true);
      a.root.traverse((o) => {
        if (o.isMesh) assert.ok(o.matrixWorld.elements.every(Number.isFinite), `${named(look)}, ${emote ?? anim}: every part is somewhere`);
      });
    }
    a.dispose();
  }
  // Bunches swing; bob and long hair cover the ears.
  const kid = (hair) => new Avatar({ animal: KID, fur: 'tan', shirt: 1, hat: 'none', skin: 'tan', hair, hairColor: 'black' });
  assert.deepEqual(['ponytail', 'pigtails', 'short'].map((hair) => kid(hair).sway.length), [1, 2, 0]);
  // An alien's two antennae bob the same way; no other animal has any.
  assert.deepEqual(['alien', 'bunny'].map((animal) => new Avatar({ animal, fur: 'lime', shirt: 1, hat: 'none' }).sway.length), [2, 0]);
  const meshes = (hair) => {
    let n = 0;
    kid(hair).skull.traverse((o) => (n += o.isMesh ? 1 : 0));
    return n;
  };
  assert.ok(new Set(HAIRS.map((h) => meshes(h.key))).size > 4, 'the hair styles are made differently');
});

test('a toy weapon in hand: the other hand waves and goes to your heart, and arms up hold it up to the sky', () => {
  const at = (o, y = 0) => o.localToWorld(new THREE.Vector3(0, y, 0)).y;
  const pose = (weapon, emote) => {
    const a = new Avatar({ animal: 'bunny', fur: 'white', shirt: 1, hat: 'none', ...(weapon ? { weapon } : {}) });
    a.playEmote(emote);
    for (let i = 0; i < 4; i++) a.update(0.15, ANIM.idle, 0);
    a.root.updateMatrixWorld(true);
    // The hands, and the far end of what is in the right one.
    return { left: at(a.hands[0]), right: at(a.hands[1]), tip: a.weapon ? at(a.weapon, 0.45) : null };
  };
  const bare = pose(null, 'wave');
  assert.ok(bare.right > bare.left + 0.5, 'without one, the right hand waves');
  for (const weapon of ['sword', 'blaster', 'hammer', 'lavablade']) {
    const wave = pose(weapon, 'wave');
    assert.ok(wave.left > wave.right + 0.5, `${weapon}: the left hand waves`);
    const hearts = pose(weapon, 'hearts');
    assert.ok(hearts.tip < hearts.left, `${weapon}: kept down while the left hand is on your heart`);
    const cheer = pose(weapon, 'cheer');
    assert.ok(cheer.tip > cheer.right + 0.2, `${weapon}: held up to the sky`);
  }
});

test('running shoes and flying gear show: their own shoes, wings that beat flying, flames from a jet pack flying and rocket boots running', () => {
  const look = { animal: KID, fur: 'tan', shirt: 1, hat: 'none', skin: 'tan', hair: 'short', hairColor: 'black' };
  const colours = (a) => {
    const seen = new Set();
    a.knees[0].traverse((o) => o.isMesh && seen.add(o.material.color.getHexString()));
    return [...seen].sort().join();
  };
  const plain = new Avatar(look);
  const kinds = ['bouncy', 'zoomy', 'rocket'].map((shoes) => colours(new Avatar({ ...look, shoes })));
  assert.equal(new Set([colours(plain), ...kinds]).size, 4, 'each pair its own colours');
  assert.equal(plain.wings, null);
  for (const wings of ['feather', 'fairy', 'jetpack']) {
    for (const outfit of [undefined, 'cape']) {
      const a = new Avatar({ ...look, wings, ...(outfit ? { outfit } : {}) });
      assert.ok(a.wings, wings);
      a.update(0.1, ANIM.idle, 0);
      const resting = a.wings.sides.map((w) => w.rotation.y);
      assert.ok(a.wings.flames.every((f) => !f.visible), `${wings}: no flames standing`);
      for (let i = 0; i < 5; i++) a.update(0.037, ANIM.fly, 6);
      assert.ok(a.wings.flames.every((f) => f.visible), `${wings}: flames flying`);
      if (wings !== 'jetpack') assert.notDeepEqual(a.wings.sides.map((w) => w.rotation.y), resting, `${wings}: they beat flying`);
      a.root.updateMatrixWorld(true);
      a.root.traverse((o) => o.isMesh && assert.ok(o.matrixWorld.elements.every(Number.isFinite), wings));
    }
  }
  const boots = new Avatar({ ...look, shoes: 'rocket' });
  assert.equal(boots.flames.length, 2);
  boots.update(0.1, ANIM.walk, 2);
  assert.ok(boots.flames.every((f) => !f.visible), 'walking, no flames');
  boots.update(0.1, ANIM.run, 9);
  assert.ok(boots.flames.every((f) => f.visible), 'running, flames');
});

test('roller skates: wheels under a boot of their own colours, which stand you up on them, roll as you go and push you along side to side', () => {
  const look = { animal: KID, fur: 'tan', shirt: 1, hat: 'none', skin: 'tan', hair: 'short', hairColor: 'black' };
  const plain = new Avatar(look);
  assert.equal(plain.wheels.length, 0);
  assert.equal(plain.skateLift, 0);
  const kinds = ['roller', 'glowy'].map((skates) => new Avatar({ ...look, skates }));
  for (const a of kinds) {
    assert.equal(a.wheels.length, 8, 'four wheels a foot');
    assert.ok(a.skateLift > 0.03);
  }
  // Glowing wheels on the Light-up Skates only.
  assert.ok(kinds[1].wheels.every((w) => w.material.emissiveIntensity > 0 && w.material.emissive.getHex() !== 0));
  assert.ok(kinds[0].wheels.every((w) => !w.material.emissive || w.material.emissive.getHex() === 0));
  assert.notEqual(kinds[0].wheels[0].material.color.getHexString(), kinds[1].wheels[0].material.color.getHexString());
  // Skates win over shoes.
  assert.equal(new Avatar({ ...look, skates: 'roller', shoes: 'rocket' }).flames.length, 0);
  // Up on the wheels standing: the lowest wheel just touches the ground.
  const a = kinds[0];
  a.update(0.1, ANIM.idle, 0);
  a.root.updateMatrixWorld(true);
  const lowest = Math.min(...a.wheels.map((w) => new THREE.Box3().setFromObject(w).min.y));
  assert.ok(Math.abs(lowest) < 0.012, `lowest wheel at ${lowest}`);
  // Rolling and pushing out to the side as you go; sitting, down off them.
  const spun = a.wheels[0].rotation.x;
  for (let i = 0; i < 30; i++) a.update(1 / 30, ANIM.run, 8);
  assert.notEqual(a.wheels[0].rotation.x, spun, 'the wheels roll');
  let out = 0;
  for (let i = 0; i < 60; i++) {
    a.update(1 / 60, ANIM.run, 8);
    out = Math.max(out, Math.abs(a.legs[0].rotation.z), Math.abs(a.legs[1].rotation.z));
  }
  assert.ok(out > 0.3, `a leg pushes out ${out}`);
  a.update(0.1, ANIM.sit, 0);
  assert.ok(a.body.position.y < a.skateLift / 2, 'not up on wheels in a seat');
});

test("a flying friend on someone's head sits on top of their hair or their hat", () => {
  // The highest point of the head (or hat) under the middle of a bird sitting
  // there: straight down onto every part, at the middle and round it. Most
  // parts are the same shape in the same place look after look (an animal's
  // head under every hat, a kid's under every hat and hair style, whatever
  // their colours), and as high as they were the first time, so each is only
  // looked at once.
  const rays = [];
  for (const r of [0, 0.025, 0.05]) {
    for (let i = 0; i < (r ? 12 : 1); i++) rays.push(new THREE.Raycaster(new THREE.Vector3(Math.cos((i * Math.PI) / 6) * r, 5, Math.sin((i * Math.PI) / 6) * r), new THREE.Vector3(0, -1, 0)));
  }
  const tops = new Map();
  const top = (avatar) => {
    avatar.root.updateMatrixWorld(true);
    let best = -Infinity;
    avatar.root.traverse((o) => {
      if (!o.isMesh) return;
      const part = `${o.geometry.uuid} ${o.material.side} ${o.matrixWorld.elements}`;
      if (!tops.has(part)) tops.set(part, Math.max(...rays.map((ray) => ray.intersectObject(o, false)[0]?.point.y ?? -Infinity)));
      best = Math.max(best, tops.get(part));
    });
    return best;
  };
  // A bow sits to one side, where the bird does not.
  for (const look of LOOKS.filter((l) => l.hat !== 'bow')) {
    const sits = headTop(look.hat, lookHair(look), lookTall(look));
    const t = top(new Avatar(look));
    assert.ok(sits >= t && sits <= t + 0.03, `${named(look)}: sits at ${sits}, the top is at ${t.toFixed(3)}`);
  }
});

test("a kid's look: skin and hair, as chosen, as a kid starts out, or at random; and none for an animal", () => {
  const kid = { animal: KID, fur: 'tan', shirt: 3, hat: 'cap', skin: 'deep', hair: 'bun', hairColor: 'pink' };
  assert.deepEqual(cleanLook(kid), kid);
  assert.deepEqual(cleanLook({ ...kid, skin: 'green', hair: 'mohawk', hairColor: '#ff0000' }), { ...kid, skin: 'golden', hair: 'short', hairColor: 'brown' });
  assert.deepEqual(cleanLook({ ...kid, animal: 'cat', fur: 'orange' }), { animal: 'cat', fur: 'orange', shirt: 3, hat: 'cap' });
  // However it comes out at random, it is a whole look.
  for (let i = 0; i < 200; i++) {
    const look = randomLook();
    assert.deepEqual(cleanLook(look), look);
  }
  // In lists: the kid with your skin, or your animal.
  assert.equal(lookIcon(kid), '🧒🏿');
  assert.equal(lookIcon({ ...kid, skin: 'fair' }), '🧒🏻');
  assert.equal(lookIcon({ animal: 'cat' }), '🐱');
  assert.equal(lookIcon(null), '🙂');
});

test("a grown-up: a kid's skin and hair, a face of their own, and taller", () => {
  const grown = { animal: GROWN_UP, fur: 'tan', shirt: 3, hat: 'cap', skin: 'brown', hair: 'curly', hairColor: 'silver', face: 'glasses-beard' };
  assert.deepEqual(cleanLook(grown), grown);
  assert.deepEqual(cleanLook({ ...grown, face: 'monocle' }), { ...grown, face: 'none' });
  // A kid has no face to choose, and becoming a grown-up keeps the skin and hair.
  const { face: _, ...kid } = { ...grown, animal: KID };
  assert.deepEqual(cleanLook({ ...grown, animal: KID }), kid);
  assert.deepEqual(cleanLook({ ...kid, animal: GROWN_UP }), { ...grown, face: 'none' });
  assert.equal(lookIcon(grown), '🧔🏾');
  assert.equal(lookIcon({ ...grown, face: 'glasses' }), '🧑🏾');
  // As tall as they are drawn, standing; sitting dizzy or riding, their hips where a kid's are.
  const height = (look) => {
    const a = new Avatar(look);
    a.update(0.1, ANIM.idle, 0);
    a.root.updateMatrixWorld(true);
    return new THREE.Box3().setFromObject(a.skull).max.y;
  };
  const small = { ...kid, hat: 'none', hair: 'short' };
  assert.ok(Math.abs(height({ ...small, animal: GROWN_UP }) - height(small) - GROWN_TALL) < 0.02);
  assert.ok(height({ ...small, animal: GROWN_UP }) < 2 - 0.2, 'under a doorway two blocks high');
  assert.equal(lookTall(small), 0);
  for (const anim of [ANIM.ride, ANIM.dizzy]) {
    const hips = (look) => {
      const a = new Avatar(look);
      a.update(0.1, anim, 0);
      a.root.updateMatrixWorld(true);
      return a.legs[0].getWorldPosition(new THREE.Vector3()).y;
    };
    assert.ok(Math.abs(hips({ ...small, animal: GROWN_UP }) - hips(small)) < 1e-9);
  }
  // Glasses, a moustache and a beard are made differently.
  const parts = (face) => {
    let n = 0;
    new Avatar({ ...grown, face }).skull.traverse((o) => (n += o.isMesh ? 1 : 0));
    return n;
  };
  assert.equal(new Set(FACES.map((f) => parts(f.key))).size, FACES.length);
});

test('at the piano, jointed hands play palm down with fingers arched, the finger that struck pushing down, and the resting hands and what is in hand come back after', () => {
  const a = new Avatar({ animal: KID, fur: 'tan', shirt: 1, hat: 'none', skin: 'tan', hair: 'short', hairColor: 'black', weapon: 'sword' });
  const meshes = () => {
    let n = 0;
    a.root.traverse((o) => o.isMesh && n++);
    return n;
  };
  a.update(0.1, ANIM.idle, 0);
  const resting = meshes();
  assert.ok(a.weapon?.parent, 'a sword in hand');
  a.update(0.1, ANIM.piano, 0);
  for (const hand of a.hands) {
    assert.equal(hand.userData.rest.parent, null, 'the resting hand put away');
    assert.equal(hand.userData.piano.group.parent, hand, 'the playing hand on');
  }
  assert.equal(a.weapon.parent, null, 'the sword put away to play');
  // Palm down: the palm's own down (-z) points at the floor, the fingers
  // forward of the wrist and curled down under the knuckles.
  a.root.updateMatrixWorld(true);
  for (const hand of a.hands) {
    const { group, fingers } = hand.userData.piano;
    const down = new THREE.Vector3(0, 0, -1).transformDirection(group.matrixWorld);
    assert.ok(down.y < -0.9, `palm down (${down.y.toFixed(2)})`);
    const knuckle = fingers[1].knuckle.getWorldPosition(new THREE.Vector3());
    const tip = fingers[1].joint.localToWorld(new THREE.Vector3(0, -0.02, 0));
    assert.ok(tip.y < knuckle.y - 0.02, 'the fingertip below its knuckle');
    assert.ok(tip.z > hand.getWorldPosition(new THREE.Vector3()).z, 'and out in front of the wrist');
  }
  // A key struck by the low hand's middle finger: it pushes down, the others do not.
  const tipY = (f) => {
    a.root.updateMatrixWorld(true);
    return a.hands[1].userData.piano.fingers[f].joint.localToWorld(new THREE.Vector3(0, -0.02, 0)).y;
  };
  const before = tipY(1);
  a.pianoNote(62);
  a.update(1 / 60, ANIM.piano, 0);
  const palm = a.hands[1].getWorldPosition(new THREE.Vector3()).y;
  assert.equal(a.keys[0].finger, 2);
  assert.ok(tipY(1) < before - 0.005 && tipY(1) - palm < -0.03, 'the middle finger pushes down');
  // Up from the piano: as before, nothing of it left on you.
  a.update(0.1, ANIM.idle, 0);
  for (const hand of a.hands) assert.equal(hand.userData.rest.parent, hand);
  assert.equal(a.weapon.parent, a.hands[1]);
  assert.equal(meshes(), resting);
  a.dispose();
});
