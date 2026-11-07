// Dogs: every breed a pet kind with its own coats, as big as a real one;
// the skin sculpted over its bones (nothing missing, every point held by its
// bones); standing as it was sculpted, on the ground; sitting, lying down and
// trotting with its paws where paws go; and the shapes that tell one breed
// from another.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as THREE from '../public/vendor/three.module.js';
import { breedOf } from '../public/js/render/dog-breeds.js';
import { bakeBreed, coatOn, DogRig } from '../public/js/render/dog-model.js';
import { CritterModel } from '../public/js/render/critter-models.js';
import { PetModel } from '../public/js/render/pet-models.js';
import { DOG_COATS, DOGS } from '../public/js/shared/dog-kinds.js';
import { makePet, PET_INFO } from '../public/js/shared/pets.js';
import { cleanPet, FUR_COLORS, PET_COATS, PETS, petKind } from '../public/js/shared/words.js';

const ALL = ['puppy', ...DOGS.map((d) => d.key)];
const at = new THREE.Vector3();
const worldOf = (o) => {
  o.updateWorldMatrix(true, false);
  return at.setFromMatrixPosition(o.matrixWorld).clone();
};
// A rig that has settled into a pose.
function settled(key, pose = 'idle', { coat, hs = 0, size } = {}) {
  const rig = new DogRig(key, coat, size ?? breedOf(key).size);
  for (let i = 0; i < 90; i++) rig.play(1 / 30, pose, hs);
  rig.group.updateMatrixWorld(true);
  return rig;
}
const pawsOf = (rig) => rig.legBones.map((leg) => worldOf(rig.bones[leg.at(-1)]));

test('every dog is a kind of pet, in the coats its breed comes in', () => {
  assert.ok(DOGS.length >= 24, 'plenty of breeds');
  assert.equal(new Set(DOGS.map((d) => d.key)).size, DOGS.length, 'each only once');
  for (const d of DOGS) {
    const kind = petKind(d.key);
    assert.ok(kind?.dog, `${d.key}: a pet`);
    assert.ok(PET_INFO[d.key], `${d.key}: knows how to get about`);
    assert.ok(!kind.flies, `${d.key}: stays on the ground`);
    assert.deepEqual(Object.keys(breedOf(d.key).coats).sort(), [...d.coats].sort(), `${d.key}: the coats it is painted in are the ones you can pick`);
    for (const coat of d.coats) {
      assert.ok(PET_COATS[coat], `${d.key}: ${coat} has a swatch`);
      assert.equal(cleanPet({ kind: d.key, coat, name: 'Bo' }).coat, coat);
    }
    assert.equal(cleanPet({ kind: d.key, coat: 'purple', name: 'Bo' }).coat, d.coats[0], `${d.key}: its own first coat, for one that it never comes in`);
  }
  // A dog's coats leave the other pets' colours as they are.
  for (const key of Object.keys(DOG_COATS)) assert.ok(!FUR_COLORS[key] && key !== 'green' && key !== 'red' && key !== 'blue', `${key}: not another pet's colour by another name`);
  // Old pets keep their coats.
  assert.deepEqual(petKind('puppy').coats, ['tan', 'brown', 'cream', 'white', 'gray', 'charcoal']);
  assert.equal(PETS[0].key, 'puppy');
  assert.ok(PETS.filter((p) => p.dog).at(-1) === petKind(DOGS.at(-1).key), 'the dogs together in My pet');
});

test('a dog stands as tall as a real one of its breed would by a child, and fits through the world as they do', () => {
  const sizes = DOGS.map((d) => d.size);
  assert.deepEqual(sizes, [...sizes].sort((a, b) => a - b), 'smallest first');
  assert.ok(sizes[0] < 0.3 && sizes.at(-1) > 0.85, 'from a Chihuahua to a Great Dane');
  for (const d of DOGS) {
    const info = PET_INFO[d.key];
    // Never taller than you (1.41) or wider than a gap you fit through.
    assert.ok(info.height < 1.35 && info.radius <= 0.3 && info.radius >= 0.12, `${d.key}: ${info.height} tall, ${info.radius} wide`);
    assert.ok(info.float > 0.1 && info.float < info.height, `${d.key}: its back out of the water as it swims`);
    const pet = makePet(d.key, 10.5, 6, 10.5);
    assert.equal(pet.kind, d.key);
    assert.equal(pet.body.radius, info.radius);
  }
});

test("every breed's skin is whole: every point on it, held by its bones, with its fur and its colours", () => {
  for (const key of ALL) {
    const b = bakeBreed(key);
    const g = b.geometry;
    const count = g.attributes.position.count;
    // Dense enough to be a dog, not so dense it costs too much in every layer of fur.
    assert.ok(count > 3000 && g.index.count / 3 < 22000, `${key}: ${g.index.count / 3} triangles`);
    assert.ok(g.index.array.every((i) => i < count), `${key}: no triangle out of its skin`);
    const weights = g.attributes.skinWeight;
    const bones = g.attributes.skinIndex;
    const fur = g.attributes.aFur;
    const normal = g.attributes.normal;
    const ao = g.attributes.aAO;
    for (let i = 0; i < count; i++) {
      const sum = weights.getX(i) + weights.getY(i) + weights.getZ(i) + weights.getW(i);
      assert.ok(Math.abs(sum - 1) < 1e-4, `${key}: point ${i} is held by its bones (${sum})`);
      assert.ok(bones.getX(i) < b.inverses.length, `${key}: by a bone it has`);
      const len = Math.hypot(normal.getX(i), normal.getY(i), normal.getZ(i));
      assert.ok(Math.abs(len - 1) < 1e-3, `${key}: point ${i} knows which way is out`);
      assert.ok(fur.getW(i) >= 0 && fur.getW(i) < 0.25, `${key}: fur of ${fur.getW(i)}`);
      assert.ok(ao.getX(i) >= 0 && ao.getX(i) <= 1);
    }
    // The feet on the ground, and the whole of it about the height it should be.
    assert.ok(Math.abs(g.boundingBox.min.y) < 0.02, `${key}: its paws at the ground (${g.boundingBox.min.y.toFixed(3)})`);
    assert.ok(g.boundingBox.max.y > 1.05 && g.boundingBox.max.y < 2, `${key}: its head over its back (${g.boundingBox.max.y.toFixed(2)})`);
    const breed = breedOf(key);
    for (const name of Object.keys(breed.coats)) {
      const c = coatOn(key, name);
      assert.ok(c.geometry.attributes.aCoat.array.every(Number.isFinite), `${key} ${name}: painted all over`);
      assert.equal(c.geometry.attributes.position, g.attributes.position, `${key} ${name}: the very same skin`);
      assert.equal(c.furry.attributes.position, g.attributes.position, `${key} ${name}: its fur on the very same skin`);
      assert.ok(c.coat.palette.length >= 2 || name.includes('white'), `${key} ${name}: colours`);
    }
  }
});

test('a dog stands just as it was sculpted, its paws on the ground, and sits and lies down as a dog does', () => {
  for (const key of ALL) {
    const size = breedOf(key).size;
    const rig = settled(key, 'idle');
    // Its legs where they started, not a joint out of place.
    for (const leg of rig.legBones) for (const bone of leg) assert.ok(Math.abs(rig.bones[bone].rotation.x) < 0.012, `${key}: bone ${bone} at rest, at ${rig.bones[bone].rotation.x.toFixed(3)}`);
    const paws = pawsOf(rig);
    for (const p of paws) assert.ok(p.y > 0 && p.y < 0.12 * size, `${key}: on its paws, at ${p.y.toFixed(3)}`);
    // Sitting: its rump down at the ground, its chest still up on straight front legs, its head higher than its rump.
    const sit = settled(key, 'sit');
    const rump = worldOf(sit.bones[0]);
    const chest = worldOf(sit.bones[2]);
    const head = worldOf(sit.bones[5]);
    assert.ok(rump.y < 0.42 * size, `${key}: rump down, at ${(rump.y / size).toFixed(2)}`);
    assert.ok(chest.y > rump.y + 0.1 * size, `${key}: chest up`);
    assert.ok(head.y > chest.y, `${key}: head up`);
    for (const p of pawsOf(sit)) assert.ok(Math.abs(p.y - paws[0].y) < 0.07 * size, `${key}: its paws still on the ground, at ${p.y.toFixed(3)}`);
    // Lying down: all of it low, its front paws out in front.
    const lie = settled(key, 'lie');
    const [front] = pawsOf(lie);
    assert.ok(worldOf(lie.bones[2]).y < 0.45 * size, `${key}: chest down`);
    assert.ok(front.z > paws[0].z, `${key}: paws out in front`);
    for (const r of [rig, sit, lie]) r.dispose();
  }
});

test('a trotting dog has paws on the ground and paws in the air, and goes as fast as its stride', () => {
  for (const key of ['chihuahua', 'dachshund', 'corgi', 'golden', 'greatdane', 'puppy']) {
    const size = breedOf(key).size;
    const rig = new DogRig(key, undefined, size);
    const rest = pawsOf(rig);
    let aloft = 0;
    let onGround = 0;
    for (let i = 0; i < 90; i++) {
      rig.play(1 / 60, 'walk', 4.6);
      rig.group.updateMatrixWorld(true);
      for (const [n, p] of pawsOf(rig).entries()) {
        assert.ok(p.y > rest[n].y - 0.03 * size, `${key}: never through the ground, at ${p.y.toFixed(3)}`);
        if (p.y > rest[n].y + 0.02 * size) aloft++;
        else onGround++;
      }
    }
    assert.ok(aloft > 20 && onGround > aloft * 0.5, `${key}: stepping (${aloft} up, ${onGround} down)`);
    rig.dispose();
  }
});

test('the shapes that tell one breed from another', () => {
  const lengthOf = (k) => breedOf(k).len;
  assert.ok(lengthOf('dachshund') > lengthOf('greatdane') * 1.7, 'a sausage dog is long');
  assert.ok(lengthOf('corgi') > lengthOf('golden') * 1.3, 'and a corgi longer than most');
  assert.ok(breedOf('pug').head.muzzle < breedOf('golden').head.muzzle * 0.5, 'a pug has next to no muzzle');
  assert.ok(breedOf('greyhound').tuck < breedOf('labrador').tuck * 0.7, "a greyhound's waist goes right in");
  assert.ok(breedOf('samoyed').fur.body > breedOf('dalmatian').fur.body * 5, 'a samoyed is all fluff, a dalmatian sleek');
  assert.equal(breedOf('gsd').ear.type, 'prick');
  assert.equal(breedOf('beagle').ear.type, 'drop');
  assert.equal(breedOf('shiba').tail.type, 'curl');
  assert.equal(breedOf('corgi').tail.type, 'bob');
  assert.equal(breedOf('dalmatian').coats.spotted.pattern, 1, 'spots');
  assert.ok(new THREE.Color(breedOf('husky').coats['black-white'].eye).b > new THREE.Color(breedOf('golden').head.eyeColor ?? '#3d2413').b, "a husky's blue eyes");
});

test('a dog pet does what every pet does, and tells you how big it is', () => {
  for (const key of ALL) {
    const m = new PetModel({ kind: key }, '#123456');
    assert.equal(m.kind, key);
    assert.equal(`#${m.band.color.getHexString()}`, '#123456', `${key}: a collar in its owner's colour`);
    const size = breedOf(key).size;
    assert.ok(m.height > size && m.height < size * 2.2, `${key}: its head over its back (${m.height.toFixed(2)})`);
    m.dispose();
  }
  // None of a kind there is: a puppy.
  const stray = new PetModel({ kind: 'lion', coat: 'tan' });
  assert.equal(stray.kind, 'puppy');
  stray.dispose();
  // Its fur draws no shadow of its own, and a tap never measures its skin.
  const dog = new PetModel({ kind: 'golden' });
  assert.ok(dog.dog.fur.userData.noShadow);
  const hits = new THREE.Raycaster(new THREE.Vector3(0, 3, 0), new THREE.Vector3(0, -1, 0)).intersectObject(dog.dog.skin, false);
  assert.equal(hits.length, 0);
  dog.dispose();
});

test('the big dogs you ride are real breeds too, as big as ponies, and a rider sits on their backs', () => {
  const seen = new Set();
  for (let id = 0; id < 10; id++) {
    const m = new CritterModel('dog', id);
    seen.add(m.dogRig.b.key);
    assert.ok(m.height > 1.2 && m.height < 2.2, `dog ${id}: ${m.height.toFixed(2)} tall`);
    assert.equal(m.saddle.visible, false);
    m.setRider('#ff0000');
    assert.equal(m.saddle.visible, true);
    assert.equal(`#${m.pad.color.getHexString()}`, '#ff0000');
    // Goes as its state says: a gallop when it is fast, its tongue out for it.
    m.group.position.x = 0;
    for (let i = 0; i < 20; i++) {
      m.group.position.x += 0.25;
      m.update(1 / 30, 'run', true, 0);
    }
    assert.equal(m.dogRig.pose, 'run');
    m.update(1 / 30, 'sleep', false, 0);
    assert.equal(m.dogRig.pose, 'sleep');
    m.dispose();
  }
  assert.ok(seen.size >= 5, `a good few breeds (${[...seen]})`);
});
