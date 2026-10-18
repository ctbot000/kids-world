import assert from 'node:assert/strict';
import test from 'node:test';
import { canStepDown, QUALITY_CHOICES, RUNGS, startRung } from '../public/js/quality.js';
import { QUALITY } from '../public/js/render/renderer.js';
import { finish, toon, ToyMaterial } from '../public/js/render/toon.js';

const levelOf = (choice, device) => RUNGS[startRung(choice, device)].level;

test('auto starts a computer on the best picture, a tablet in the middle, a phone or a browser without a GPU on the plainest', () => {
  assert.equal(levelOf('auto', { fine: true, shortSide: 900 }), 'high');
  assert.equal(levelOf('auto', { fine: false, shortSide: 820 }), 'medium');
  assert.equal(levelOf('auto', { fine: false, shortSide: 390 }), 'low');
  assert.equal(levelOf('auto', { fine: true, shortSide: 900, software: true }), 'low');
  // A picture chosen in Settings is kept, whatever the device.
  for (const level of ['high', 'medium', 'low']) assert.equal(levelOf(level, { fine: false, shortSide: 390, software: true }), level);
  // Anything else is auto.
  assert.equal(levelOf('sparkly', { fine: true, shortSide: 900 }), 'high');
});

test('slow frames step auto all the way down the ladder, a chosen picture only to fewer pixels and no studs', () => {
  const walk = (choice, rung) => {
    const seen = [rung];
    while (canStepDown(choice, rung)) seen.push(++rung);
    return seen;
  };
  assert.deepEqual(walk('auto', 0), [0, 1, 2, 3, 4]);
  assert.deepEqual(walk('auto', 1), [1, 2, 3, 4]);
  assert.deepEqual(walk('high', 0), [0]);
  assert.deepEqual(walk('medium', 1), [1]);
  assert.deepEqual(walk('low', 2), [2, 3, 4]);
  // The last rungs give up sharpness, then the studs (and how far you see).
  assert.deepEqual(
    RUNGS.map((r) => [r.level, r.sharp, r.studs]),
    [
      ['high', true, true],
      ['medium', true, true],
      ['low', true, true],
      ['low', false, true],
      ['low', false, false],
    ],
  );
  for (const choice of QUALITY_CHOICES) assert.ok(choice === 'auto' || QUALITY[choice], choice);
});

test('each picture quality gives up the costliest finishing first: soft focus, then sharp shading and shadows, then all of it', () => {
  const { high, medium, low } = QUALITY;
  assert.ok(high.dof && !medium.dof && !low.dof);
  assert.ok(high.ao > medium.ao && medium.ao > 0 && low.ao === 0);
  assert.ok(high.aoSamples >= medium.aoSamples);
  assert.ok(high.shadows > medium.shadows && medium.shadows > 0 && low.shadows === 0);
  assert.ok(high.post && medium.post && !low.post);
});

test('everything that moves is a glossy toy: jelly is wet, the darkest parts shine, the rest is satin', () => {
  const satin = toon('#ff8844');
  assert.ok(satin instanceof ToyMaterial && satin.isMeshPhysicalMaterial);
  assert.equal(toon('#ff8844'), satin, 'one shared per colour');
  assert.ok(satin.clearcoat > 0 && satin.roughness > 0.3 && satin.metalness === 0);
  const jelly = toon('#9b6bff', { transparent: true, opacity: 0.82 });
  assert.ok(jelly.transparent && jelly.opacity === 0.82);
  assert.ok(jelly.roughness < satin.roughness && jelly.clearcoat === 1);
  const eye = toon('#2b2530');
  assert.ok(eye.roughness < satin.roughness && eye.clearcoat === 1);
  assert.deepEqual(finish('#ffffff'), finish('#ff0000'), 'any bright colour is satin');
  // A glow of its own (a lamp's copy) keeps the toy's shader and its light.
  const glow = toon('#ffcc33', { emissive: 0.3 }).clone();
  assert.ok(glow instanceof ToyMaterial);
  assert.equal(glow.emissiveIntensity, 0.3);
  assert.equal(glow.emissive.getHexString(), 'ffcc33');
});
