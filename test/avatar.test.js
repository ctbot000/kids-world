// The players: every animal and every kid (each hair style under each hat)
// can be drawn in every pose, and a flying friend on someone's head sits on
// their hair or their hat, neither in it nor above it.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as THREE from '../public/vendor/three.module.js';
import { ANIM, Avatar } from '../public/js/render/avatar.js';
import { headTop } from '../public/js/shared/critters.js';
import { ANIMALS, cleanLook, EMOTE_KEYS, HAIR_COLORS, HAIRS, HATS, KID, lookIcon, randomLook, SKIN_TONES } from '../public/js/shared/words.js';

const LOOKS = ANIMALS.flatMap((a) =>
  HATS.flatMap((hat, i) =>
    a.key === KID
      ? HAIRS.map((hair, j) => ({ animal: KID, fur: a.fur, shirt: i, hat: hat.key, skin: Object.keys(SKIN_TONES)[j % 6], hair: hair.key, hairColor: Object.keys(HAIR_COLORS)[(i + j) % 10] }))
      : [{ animal: a.key, fur: a.fur, shirt: i, hat: hat.key }],
  ),
);
const named = (look) => `${look.animal}${look.hair ? ` with ${look.hair} hair` : ''} in a ${look.hat} hat`;

test('every animal and every kid can be drawn in every pose', () => {
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
  const meshes = (hair) => {
    let n = 0;
    kid(hair).skull.traverse((o) => (n += o.isMesh ? 1 : 0));
    return n;
  };
  assert.ok(new Set(HAIRS.map((h) => meshes(h.key))).size > 4, 'the hair styles are made differently');
});

test("a flying friend on someone's head sits on top of their hair or their hat", () => {
  // The highest point of the head (or hat) under the middle of a bird sitting there.
  const top = (avatar) => {
    avatar.root.updateMatrixWorld(true);
    let best = -Infinity;
    for (const r of [0, 0.025, 0.05]) {
      for (let i = 0; i < (r ? 12 : 1); i++) {
        const ray = new THREE.Raycaster(new THREE.Vector3(Math.cos((i * Math.PI) / 6) * r, 5, Math.sin((i * Math.PI) / 6) * r), new THREE.Vector3(0, -1, 0));
        best = Math.max(best, ray.intersectObject(avatar.root, true)[0]?.point.y ?? -Infinity);
      }
    }
    return best;
  };
  // A bow sits to one side, where the bird does not.
  for (const look of LOOKS.filter((l) => l.hat !== 'bow')) {
    const sits = headTop(look.hat, look.animal === KID ? look.hair : '');
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
