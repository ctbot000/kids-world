// Dog breeds: the shape of each one's body, head, ears and tail, the fur it
// has, and the colours of its coats, all as a real one of that breed has
// them. Everything in the dog's own height at the shoulders.
import { DOGS } from '../shared/dog-kinds.js';
import { smooth } from './dog-sculpt.js';

// A middling dog, about a Labrador: what a breed says nothing about.
const BASE = {
  len: 1.08,
  elbow: 0.52,
  croup: 0.975,
  chestW: 0.155,
  waistW: 0.125,
  hipW: 0.135,
  tuck: 0.7,
  rump: 0.82,
  bone: 1.1,
  paw: 1,
  angle: 1,
  neck: { len: 0.32, r0: 0.13, r1: 0.094, up: 0.82, flat: 0.86 },
  head: { len: 0.45, muzzle: 0.45, skullW: 0.125, skullH: 0.1, stop: 0.42, muzzleW: 0.08, muzzleH: 0.07, taper: 0.9, lobes: 0.6, flews: 0.25, noseUp: 0.08, noseW: 0.036, cheek: 0.6, brow: 0.55, pitch: 0.16, eyeX: 0.078, eyeY: 0.024, eyeZ: 0.93, eyeR: 0.023, eyeOut: 0.42, eyeUp: 0.06 },
  ear: { type: 'drop', len: 0.19, wide: 0.06, x: 0.86, y: 0.62, z: 0.34 },
  tail: { type: 'saber', len: 0.62, r: 0.036, tipR: 0.016 },
  fur: { body: 0.02, chest: 0.024, neck: 0.022, throat: 0.02, skull: 0.008, cheek: 0.01, muzzle: 0.005, lip: 0.004, chin: 0.005, nose: 0, ear: 0.008, tail: 0.02, thigh: 0.018, shoulder: 0.014, armU: 0.01, armL: 0.007, legU: 0.011, legL: 0.007, paw: 0.005 },
};

// Coats of each length, to start from.
const SLEEK = { body: 0.008, chest: 0.009, neck: 0.009, throat: 0.008, skull: 0.005, cheek: 0.006, muzzle: 0.003, lip: 0.003, chin: 0.003, ear: 0.004, tail: 0.008, thigh: 0.007, shoulder: 0.007, armU: 0.005, armL: 0.004, legU: 0.005, legL: 0.004, paw: 0.003, cell: 0.0036, locks: 0.05, lie: 2.2, droop: 0.1 };
const SHORT = { body: 0.016, chest: 0.018, neck: 0.017, throat: 0.016, skull: 0.007, cheek: 0.009, muzzle: 0.004, lip: 0.003, chin: 0.004, ear: 0.006, tail: 0.018, thigh: 0.015, shoulder: 0.012, armU: 0.009, armL: 0.006, legU: 0.009, legL: 0.006, paw: 0.004, cell: 0.0042, locks: 0.1, lie: 1.9, droop: 0.15 };
const DOUBLE = { body: 0.042, chest: 0.06, neck: 0.056, throat: 0.05, skull: 0.012, cheek: 0.024, muzzle: 0.005, lip: 0.004, chin: 0.006, ear: 0.012, tail: 0.075, thigh: 0.044, shoulder: 0.032, armU: 0.016, armL: 0.009, legU: 0.018, legL: 0.008, paw: 0.006, pants: 0.03, cell: 0.005, locks: 0.16, lie: 1.25 };
const SILKY = { body: 0.085, chest: 0.09, neck: 0.085, throat: 0.08, skull: 0.05, cheek: 0.05, muzzle: 0.022, lip: 0.018, chin: 0.03, ear: 0.075, tail: 0.1, thigh: 0.08, shoulder: 0.07, armU: 0.06, armL: 0.06, legU: 0.06, legL: 0.055, paw: 0.03, cell: 0.0048, locks: 0.2, lie: 1.5, droop: 1.15, stretch: 5 };

const ss = smooth;
// Masks: how much of a part of it there is at a point.
const under = (v, a = -0.15, b = -0.7) => ss(a, b, v.up) * (v.tag.torso + v.tag.thigh * 0.4 + v.tag.shoulder * 0.3);
const legsBelow = (v, h, soft = 0.04) => ss(h + soft, h - soft, v.y) * (v.tag.armL + v.tag.armU + v.tag.legL + v.tag.legU + v.tag.paw);
const hindInside = (v) => (v.tag.thigh + v.tag.legU) * ss(0.12, 0.02, Math.abs(v.x));
const saddle = (v, low = 0.05) => ss(low - 0.1, low + 0.12, v.up + (v.noise(9) - 0.5) * 0.25) * (v.tag.torso + v.tag.shoulder * 0.85 + v.tag.thigh * 0.5 * ss(0.5, 0.75, v.y));
const crest = (v, low = 0) => ss(low - 0.08, low + 0.1, v.nape) * (v.tag.neck + v.tag.throat * 0.3);
// Its snout, from a to b along it: 0 at the stop, 1 at the tip of its nose.
const snout = (v, a = 0.05, b = 0.35) => ss(a, b, v.snoutT) * v.head;
const blaze = (v, w = 0.03) => ss(w * 1.5, w * 0.7, Math.abs(v.fx) + (v.noise(40) - 0.5) * 0.012) * v.head * ss(-0.2, 0.05, v.fy + 0.2);
const browDots = (v, r = 0.05) => ss(r, r * 0.55, v.browD) * v.head;
const chestPatch = (v) => v.tag.chest * ss(0.1, -0.35, v.chestUp + (v.noise(14) - 0.5) * 0.2);
const tailTip = (v, a = 0.72) => v.tag.tail * ss(a - 0.08, a + 0.05, v.tailT);
const tailUnder = (v) => v.tag.tail * ss(0.15, -0.5, v.ny);
const collarRing = (v, a = 0.25, b = 0.75) => (v.tag.neck + v.tag.throat) * ss(a - 0.08, a + 0.05, v.neckT + (v.noise(13) - 0.5) * 0.14) * ss(b + 0.05, b - 0.08, v.neckT + (v.noise(13) - 0.5) * 0.14);
const earsOf = (v) => v.tag.ear;

// The same, for a tan-pointed dog (a Rottweiler, a Yorkie): tan over the eyes,
// on its cheeks and muzzle, chest, legs and under its tail.
function tanPoints(v, set, i, { legs = 0.3 } = {}) {
  set(i, browDots(v));
  set(i, snout(v, 0.05, 0.3) * ss(0.02, -0.04, v.fy - v.muzzleTop));
  set(i, v.tag.cheek * ss(0.0, -0.08, v.fy));
  set(i, v.tag.chin + v.tag.lip * 0.9);
  set(i, ss(0.02, -0.04, v.fy - v.mouthY) * (v.tag.cheek + v.tag.throat));
  set(i, chestPatch(v) * ss(0.2, 0.05, Math.abs(v.x) + (v.noise(11) - 0.5) * 0.1) * 0.9);
  set(i, legsBelow(v, legs));
  set(i, hindInside(v) * 0.8);
  set(i, tailUnder(v) * ss(0.45, 0.15, v.tailT));
}

// A white-marked dog: white up its face, round its neck, its chest and belly,
// its feet, the tip of its tail.
function whiteMarks(v, set, i, { face = 0.03, muzzle = true, collar = true, socks = 0.25, tip = true, chest = true, belly = 0.9 } = {}) {
  if (face) set(i, blaze(v, face));
  if (muzzle) set(i, snout(v, 0.0, 0.2));
  if (muzzle) set(i, v.tag.chin + v.tag.lip * 0.85);
  if (chest) set(i, chestPatch(v));
  if (chest) set(i, v.tag.throat * 0.9);
  if (collar) set(i, collarRing(v));
  set(i, under(v) * belly);
  if (socks) set(i, legsBelow(v, socks));
  if (tip) set(i, tailTip(v));
}

const plain = (palette, extra = {}) => ({
  palette,
  paint(v, set) {
    set(1, under(v) * 0.6 + v.tag.chest * 0.25);
    set(2, saddle(v, 0.35) * 0.45 + earsOf(v) * 0.6);
  },
  ...extra,
});

const BREEDS = {
  chihuahua: {
    len: 0.95,
    elbow: 0.53,
    chestW: 0.135,
    waistW: 0.1,
    hipW: 0.115,
    tuck: 0.66,
    bone: 0.88,
    paw: 0.92,
    neck: { len: 0.27, r0: 0.11, r1: 0.082, up: 0.9 },
    head: { len: 0.56, muzzle: 0.26, skullW: 0.185, skullH: 0.16, stop: 0.64, muzzleW: 0.066, muzzleH: 0.052, taper: 0.8, lobes: 0.62, flews: 0.1, noseUp: 0.12, noseW: 0.028, cheek: 0.5, eyeX: 0.122, eyeY: -0.012, eyeZ: 0.93, eyeR: 0.038, eyeOut: 0.5, eyeHigh: 0.82, eyeLow: 0.72, pitch: 0.06 },
    ear: { type: 'bat', len: 0.21, wide: 0.11, x: 0.74, y: 0.74, z: 0.42, lean: 0.55, back: 0.06, turn: 0.58, thick: 0.007 },
    tail: { type: 'sickle', len: 0.46, r: 0.024, tipR: 0.012 },
    fur: { ...SLEEK, body: 0.012, neck: 0.012, chest: 0.012, tail: 0.012, cell: 0.0044 },
    coats: {
      fawn: { palette: ['#d9b07c', '#f2dfc0', '#c4935f'], paint: (v, set) => (set(1, under(v) * 0.8 + chestPatch(v) * 0.7 + legsBelow(v, 0.2) * 0.5), set(2, saddle(v, 0.5) * 0.5 + snout(v, 0.1, 0.4) * 0.5)) },
      'cream-dog': { palette: ['#efe0c0', '#fbf4e4', '#e2cda5'], paint: (v, set) => set(1, under(v) * 0.8 + chestPatch(v)), nose: '#3a2820' },
      'black-tan': { palette: ['#1f1b1a', '#b56f35', '#f3e7d0'], paint: (v, set) => (tanPoints(v, set, 1, { legs: 0.22 }), set(2, chestPatch(v) * 0.5)) },
      chocolate: { palette: ['#573826', '#b4814c', '#f0e0c6'], nose: '#3e2a20', paint: (v, set) => (tanPoints(v, set, 1, { legs: 0.2 }), set(2, chestPatch(v) * 0.5)) },
    },
  },
  yorkie: {
    len: 0.98,
    elbow: 0.52,
    chestW: 0.12,
    waistW: 0.095,
    hipW: 0.105,
    bone: 0.8,
    neck: { len: 0.3, r0: 0.1, r1: 0.075, up: 0.95 },
    head: { len: 0.5, muzzle: 0.36, skullW: 0.13, skullH: 0.115, stop: 0.5, muzzleW: 0.052, muzzleH: 0.046, taper: 0.85, flews: 0.1, noseW: 0.028, eyeX: 0.084, eyeY: 0.006, eyeR: 0.03, eyeHigh: 0.75, eyeLow: 0.62 },
    ear: { type: 'prick', len: 0.17, wide: 0.058, x: 0.74, y: 0.78, z: 0.42, lean: 0.28, point: 0.2, cup: 2 },
    tail: { type: 'sickle', len: 0.34, r: 0.024, tipR: 0.012 },
    fur: { ...SILKY, body: 0.1, neck: 0.075, skull: 0.042, muzzle: 0.03, lip: 0.03, chin: 0.05, ear: 0.016, tail: 0.05, armL: 0.04, legL: 0.04 },
    coats: {
      'steel-tan': {
        palette: ['#5c6168', '#c98f4e', '#dcb27a', '#3b3e44'],
        paint(v, set) {
          set(1, v.head + earsOf(v) * 0.9);
          set(2, v.tag.chin + v.tag.lip + snout(v, 0.1, 0.45) * 0.8);
          set(1, v.tag.chest * ss(0.3, -0.1, v.chestUp) + legsBelow(v, 0.55, 0.1) + hindInside(v));
          set(1, v.tag.throat * 0.7);
          set(3, v.tag.tail * ss(0.1, 0.5, v.tailT));
        },
      },
    },
  },
  maltese: {
    len: 1.0,
    elbow: 0.5,
    chestW: 0.125,
    waistW: 0.1,
    hipW: 0.11,
    bone: 0.82,
    neck: { len: 0.27, r0: 0.1, r1: 0.076, up: 0.9 },
    head: { len: 0.52, muzzle: 0.32, skullW: 0.13, skullH: 0.11, stop: 0.55, muzzleW: 0.052, muzzleH: 0.044, taper: 0.85, flews: 0.1, noseW: 0.03, eyeX: 0.09, eyeY: 0.004, eyeR: 0.034, eyeHigh: 0.82, eyeLow: 0.7 },
    ear: { type: 'drop', len: 0.16, wide: 0.05, x: 0.84, y: 0.55, z: 0.36 },
    tail: { type: 'curl', len: 0.44, r: 0.024, tipR: 0.012, stiff: 0.4 },
    fur: { ...SILKY, body: 0.12, tail: 0.13, chest: 0.11, neck: 0.1, ear: 0.1, skull: 0.06 },
    coats: { 'white-dog': { palette: ['#fbf8f2', '#f2ece1', '#fffdf9'], dither: 0.5, paint: (v, set) => (set(1, under(v) * 0.5), set(2, saddle(v, 0.3) * 0.6)) } },
  },
  pomeranian: {
    len: 0.88,
    elbow: 0.48,
    chestW: 0.135,
    waistW: 0.11,
    hipW: 0.12,
    tuck: 0.76,
    bone: 0.85,
    neck: { len: 0.25, r0: 0.11, r1: 0.082, up: 1.0 },
    head: { len: 0.46, muzzle: 0.3, skullW: 0.135, skullH: 0.11, stop: 0.55, muzzleW: 0.052, muzzleH: 0.044, taper: 0.8, flews: 0.05, noseW: 0.027, eyeX: 0.086, eyeY: 0.012, eyeR: 0.029, eyeHigh: 0.75, eyeLow: 0.62, cheek: 0.7 },
    ear: { type: 'prick', len: 0.12, wide: 0.05, x: 0.66, y: 0.9, z: 0.42, lean: 0.25, point: 0.26 },
    tail: { type: 'curl', len: 0.4, r: 0.03, tipR: 0.016, stiff: 0.6 },
    fur: { ...DOUBLE, body: 0.13, chest: 0.16, neck: 0.16, throat: 0.15, shoulder: 0.1, thigh: 0.1, tail: 0.16, skull: 0.03, cheek: 0.06, armU: 0.05, armL: 0.018, legU: 0.05, legL: 0.015, ear: 0.03, muzzle: 0.008, pants: 0.04, lie: 0.55, droop: 0.2, locks: 0.14 },
    coats: {
      'golden-dark': { palette: ['#d0823a', '#eab26a', '#a95d22'], paint: (v, set) => (set(1, under(v) * 0.7 + v.tag.chest * 0.6 + v.tag.throat * 0.6 + hindInside(v)), set(2, saddle(v, 0.3) * 0.35)) },
      'cream-dog': plain(['#efdcb4', '#faf1dc', '#e0c697']),
      'white-dog': plain(['#fbf8f2', '#f0eadf', '#fffdf9']),
      'black-dog': plain(['#1e1b1b', '#2c2726', '#151313'], { eye: '#2a180d' }),
      sable: { palette: ['#c98d4e', '#2b211c', '#e8c48f'], paint: (v, set) => (set(1, saddle(v, 0.0) * 0.55 + crest(v) * 0.5 + v.tag.tail * 0.3 + earsOf(v) * 0.5), set(2, under(v) * 0.8 + v.tag.chest * 0.5)) },
    },
  },
  dachshund: {
    len: 1.95,
    elbow: 0.33,
    croup: 0.985,
    chestW: 0.19,
    waistW: 0.15,
    hipW: 0.155,
    tuck: 0.72,
    rump: 0.72,
    bone: 1.15,
    paw: 1.12,
    neck: { len: 0.4, r0: 0.145, r1: 0.1, up: 0.72 },
    head: { len: 0.62, muzzle: 0.54, skullW: 0.125, skullH: 0.1, stop: 0.2, muzzleW: 0.07, muzzleH: 0.062, taper: 0.76, flews: 0.2, noseW: 0.036, eyeX: 0.082, eyeY: 0.018, eyeZ: 0.92, eyeR: 0.027, pitch: 0.1 },
    ear: { type: 'drop', len: 0.3, wide: 0.1, x: 0.82, y: 0.6, z: 0.34, tip: 0.8 },
    tail: { type: 'saber', len: 0.72, r: 0.042, tipR: 0.012 },
    fur: { ...SLEEK, body: 0.012, cell: 0.004 },
    coats: {
      rust: { palette: ['#a85b28', '#c47d42', '#7a3f1a'], paint: (v, set) => (set(1, under(v) * 0.6 + chestPatch(v) * 0.5), set(2, saddle(v, 0.55) * 0.45 + earsOf(v) * 0.5)) },
      'black-tan': { palette: ['#1f1b1a', '#b4682c'], paint: (v, set) => tanPoints(v, set, 1, { legs: 0.32 }) },
      'choc-tan': { palette: ['#553524', '#c08a4e'], nose: '#3e2a20', paint: (v, set) => tanPoints(v, set, 1, { legs: 0.32 }) },
      'cream-dog': { palette: ['#e8cf9f', '#f4e6c8', '#d4b482'], paint: (v, set) => (set(1, under(v) * 0.7), set(2, earsOf(v) * 0.6)) },
    },
  },
  shihtzu: {
    len: 1.2,
    elbow: 0.42,
    chestW: 0.16,
    waistW: 0.135,
    hipW: 0.14,
    tuck: 0.82,
    bone: 0.95,
    neck: { len: 0.24, r0: 0.13, r1: 0.105, up: 0.95 },
    head: { len: 0.46, muzzle: 0.16, skullW: 0.17, skullH: 0.145, stop: 0.68, muzzleW: 0.07, muzzleH: 0.052, taper: 0.9, lobes: 0.68, flews: 0.2, noseUp: 0.32, noseW: 0.032, eyeX: 0.108, eyeY: -0.004, eyeZ: 0.95, eyeR: 0.04, eyeOut: 0.5, eyeHigh: 0.9, eyeLow: 0.75, pitch: 0.02 },
    ear: { type: 'drop', len: 0.24, wide: 0.08, x: 0.86, y: 0.55, z: 0.34 },
    tail: { type: 'curl', len: 0.42, r: 0.03, tipR: 0.014, stiff: 0.5 },
    fur: { ...SILKY, body: 0.14, neck: 0.1, chest: 0.11, tail: 0.13, ear: 0.13, skull: 0.06, cheek: 0.07, muzzle: 0.05, lip: 0.05, chin: 0.06 },
    coats: {
      'gold-white': { palette: ['#fbf7ee', '#c88f48', '#a06c30'], paint: (v, set) => (set(1, saddle(v, -0.05) * 0.9 + earsOf(v)), set(1, v.head * ss(0.05, 0.1, Math.abs(v.fx)) * ss(1.02, 0.86, v.fz / v.muzzleZ)), set(2, earsOf(v) * 0.4)) },
      'black-white': { palette: ['#fbf7ee', '#201c1b', '#39322f'], paint: (v, set) => (set(1, saddle(v, -0.05) * 0.9 + earsOf(v)), set(1, v.head * ss(0.05, 0.1, Math.abs(v.fx)) * ss(1.02, 0.86, v.fz / v.muzzleZ))) },
    },
  },
  poodle: {
    len: 0.98,
    elbow: 0.56,
    chestW: 0.112,
    waistW: 0.09,
    hipW: 0.1,
    tuck: 0.68,
    bone: 0.82,
    neck: { len: 0.4, r0: 0.095, r1: 0.072, up: 0.98 },
    head: { len: 0.46, muzzle: 0.48, skullW: 0.098, skullH: 0.085, stop: 0.36, muzzleW: 0.048, muzzleH: 0.044, taper: 0.86, flews: 0.1, noseW: 0.027, eyeX: 0.062, eyeR: 0.022, eyeY: 0.016 },
    ear: { type: 'drop', len: 0.22, wide: 0.058, x: 0.92, y: 0.4, z: 0.34 },
    tail: { type: 'sickle', len: 0.34, r: 0.022, tipR: 0.018 },
    fur: { ...DOUBLE, body: 0.075, chest: 0.075, neck: 0.075, throat: 0.07, skull: 0.08, cheek: 0.03, muzzle: 0.006, lip: 0.005, chin: 0.008, ear: 0.075, tail: 0.1, thigh: 0.075, shoulder: 0.07, armU: 0.065, armL: 0.06, legU: 0.065, legL: 0.06, paw: 0.05, curl: 0.5, locks: 0.85, lie: 0.5, droop: 0.05, stretch: 1.3, cell: 0.0062, pants: 0 },
    coats: {
      apricot: plain(['#e5b07a', '#efc798', '#d59a62'], { nose: '#4a3128', rim: '#4a3128' }),
      'white-dog': plain(['#fbf8f2', '#f0eadf', '#fffdf9']),
      chocolate: plain(['#573826', '#6b4832', '#452b1b'], { nose: '#3a271e', rim: '#3a271e' }),
      'black-dog': plain(['#1e1b1b', '#2a2625', '#141212']),
      silver: plain(['#b6b9bf', '#c8cad0', '#9c9fa6']),
    },
  },
  pug: {
    len: 1.0,
    elbow: 0.46,
    croup: 0.99,
    chestW: 0.205,
    waistW: 0.17,
    hipW: 0.165,
    tuck: 0.82,
    rump: 0.88,
    bone: 1.2,
    neck: { len: 0.2, r0: 0.17, r1: 0.15, up: 0.82 },
    head: { len: 0.46, muzzle: 0.13, skullW: 0.195, skullH: 0.17, stop: 0.72, muzzleW: 0.095, muzzleH: 0.068, taper: 0.96, lobes: 0.72, flews: 0.45, noseUp: 0.42, noseW: 0.034, eyeX: 0.122, eyeY: -0.012, eyeZ: 0.97, eyeR: 0.044, eyeOut: 0.52, eyeHigh: 0.92, eyeLow: 0.78, pitch: 0.02 },
    ear: { type: 'drop', len: 0.11, wide: 0.066, x: 0.92, y: 0.78, z: 0.48, out: 0.34, tip: 0.62, forward: 0.14 },
    tail: { type: 'screw', len: 0.3, r: 0.042, tipR: 0.02, stiff: 0.85, set: 0.8 },
    fur: { ...SLEEK, body: 0.014, cell: 0.004 },
    coats: {
      fawn: {
        palette: ['#d4b07e', '#1f1a18', '#e8cfa6'],
        paint(v, set) {
          set(2, under(v) * 0.5);
          set(1, earsOf(v));
          set(1, snout(v, -0.2, 0.05) + ss(0.075, 0.05, v.eyeD) * v.head * 0.7 + v.tag.lip + v.tag.chin);
        },
      },
      'black-dog': plain(['#1c1919', '#282423', '#121010']),
    },
  },
  corgi: {
    len: 1.62,
    elbow: 0.36,
    chestW: 0.21,
    waistW: 0.175,
    hipW: 0.18,
    tuck: 0.82,
    rump: 0.86,
    croup: 0.98,
    bone: 1.25,
    paw: 1.1,
    neck: { len: 0.34, r0: 0.16, r1: 0.11, up: 0.85 },
    head: { len: 0.6, muzzle: 0.42, skullW: 0.17, skullH: 0.125, stop: 0.48, muzzleW: 0.078, muzzleH: 0.066, taper: 0.76, lobes: 0.6, flews: 0.15, noseW: 0.036, cheek: 0.78, eyeX: 0.108, eyeY: 0.016, eyeR: 0.03 },
    ear: { type: 'prick', len: 0.27, wide: 0.1, x: 0.7, y: 0.8, z: 0.45, lean: 0.34, point: 0.26, turn: 0.6 },
    tail: { type: 'bob', len: 0.1, r: 0.05, tipR: 0.04, stiff: 0.3 },
    fur: { ...DOUBLE, body: 0.04, chest: 0.075, neck: 0.06, throat: 0.06, thigh: 0.05, pants: 0.04, armL: 0.009 },
    coats: {
      'red-white': { palette: ['#c97a36', '#faf5ea', '#a75f26'], paint: (v, set) => (whiteMarks(v, set, 1, { face: 0.022, socks: 0.3, tip: false, chest: true }), set(2, saddle(v, 0.55) * 0.25 + earsOf(v) * 0.3)) },
      tricolor: { palette: ['#1f1b1a', '#faf5ea', '#b96f33'], paint: (v, set) => (set(2, v.head * (1 - blaze(v, 0.03)) * ss(0.25, 0.1, v.fy)), set(2, earsOf(v) * 0.15), set(2, legsBelow(v, 0.34, 0.08)), whiteMarks(v, set, 1, { face: 0.022, socks: 0.24, tip: false })) },
      sable: { palette: ['#c28c4e', '#faf5ea', '#2b211c'], paint: (v, set) => (set(2, saddle(v, 0.1) * 0.5 + earsOf(v) * 0.35 + v.tag.skull * 0.3), whiteMarks(v, set, 1, { face: 0.02, socks: 0.3, tip: false })) },
    },
  },
  frenchie: {
    len: 1.02,
    elbow: 0.46,
    croup: 1.0,
    chestW: 0.215,
    waistW: 0.145,
    hipW: 0.15,
    tuck: 0.68,
    rump: 0.8,
    bone: 1.25,
    neck: { len: 0.2, r0: 0.175, r1: 0.155, up: 0.8 },
    head: { len: 0.46, muzzle: 0.15, skullW: 0.19, skullH: 0.16, stop: 0.68, muzzleW: 0.104, muzzleH: 0.076, taper: 1, lobes: 0.74, flews: 0.55, noseUp: 0.35, noseW: 0.034, eyeX: 0.13, eyeY: -0.022, eyeZ: 0.97, eyeR: 0.038, eyeOut: 0.5, eyeHigh: 0.82, eyeLow: 0.72, pitch: 0.02, under: 0.15 },
    ear: { type: 'bat', len: 0.16, wide: 0.09, x: 0.62, y: 0.84, z: 0.44, lean: 0.34, back: 0.02, turn: 0.28, thick: 0.008 },
    tail: { type: 'screw', len: 0.14, r: 0.035, tipR: 0.02, stiff: 0.9, set: 0.45 },
    fur: { ...SLEEK },
    coats: {
      fawn: { palette: ['#d6b281', '#28211e', '#ecd6b0'], paint: (v, set) => (set(2, under(v) * 0.6 + chestPatch(v) * 0.6), set(1, snout(v, -0.2, 0.05) * 0.8 + ss(0.08, 0.05, v.eyeD) * v.head * 0.5)) },
      'cream-dog': plain(['#eadcbe', '#f7eedb', '#ddcba4'], { nose: '#34261f' }),
      brindle: { palette: ['#a9773f', '#faf5ea', '#a9773f', '#1f1a18'], pattern: 3, patScale: 28, dither: 0.7, paint: (v, set) => { set(3, 1); set(1, chestPatch(v) * 0.7); } },
      pied: { palette: ['#f6f1e6', '#1f1b1a', '#efe8d9', '#1f1b1a'], pattern: 2, patScale: 3.2, patAt: 0.56, paint: (v, set) => { set(3, 0.95); set(1, ss(0.13, 0.09, Math.abs(Math.abs(v.fx) - 0.2)) * v.tag.skull * ss(0.1, 0.2, Math.abs(v.fx)) + earsOf(v)); set(0, blaze(v, 0.04)); } },
    },
  },
  schnauzer: {
    len: 0.98,
    elbow: 0.53,
    chestW: 0.128,
    waistW: 0.105,
    hipW: 0.115,
    croup: 0.96,
    tuck: 0.72,
    neck: { len: 0.32, r0: 0.11, r1: 0.082, up: 0.92 },
    head: { len: 0.52, muzzle: 0.48, skullW: 0.098, skullH: 0.082, stop: 0.2, muzzleW: 0.07, muzzleH: 0.066, taper: 1, lobes: 0.74, flews: 0.5, noseUp: 0.2, noseW: 0.03, brow: 1.1, eyeX: 0.066, eyeY: 0.02, eyeR: 0.019, pitch: 0.1 },
    ear: { type: 'semi', len: 0.15, wide: 0.05, x: 0.72, y: 0.74, z: 0.4 },
    tail: { type: 'sickle', len: 0.3, r: 0.03, tipR: 0.018 },
    fur: { ...SHORT, body: 0.024, neck: 0.022, chest: 0.03, muzzle: 0.045, lip: 0.075, chin: 0.09, cheek: 0.012, armL: 0.035, armU: 0.025, legL: 0.03, legU: 0.03, paw: 0.02, belly: 0.03, feather: 0.015, cell: 0.0048, lie: 1.1, droop: 0.65, locks: 0.2, brows: 0.07 },
    coats: {
      'salt-pepper': { palette: ['#6c6e74', '#d8d9dc', '#2f2f33'], dither: 0.9, paint: (v, set) => (set(2, saddle(v, 0.05) * 0.45), set(1, under(v) * 0.8 + legsBelow(v, 0.55, 0.1) * 0.85 + v.tag.lip + v.tag.chin + snout(v, 0.05, 0.3) * 0.6 + browDots(v, 0.07))) },
      'black-dog': plain(['#1e1b1b', '#2c2826', '#141212']),
      'white-dog': plain(['#f6f3ec', '#eae5da', '#fffdf9']),
    },
  },
  beagle: {
    len: 1.04,
    elbow: 0.53,
    chestW: 0.15,
    waistW: 0.122,
    hipW: 0.132,
    tuck: 0.74,
    bone: 1.15,
    neck: { len: 0.3, r0: 0.118, r1: 0.09, up: 0.86 },
    head: { len: 0.47, muzzle: 0.43, skullW: 0.118, skullH: 0.1, stop: 0.48, muzzleW: 0.074, muzzleH: 0.07, taper: 0.92, lobes: 0.68, flews: 0.48, noseW: 0.036, eyeX: 0.08, eyeY: 0.016, eyeR: 0.028, eyeHigh: 0.72 },
    ear: { type: 'drop', len: 0.27, wide: 0.08, x: 0.86, y: 0.42, z: 0.34, tip: 0.86, neck: 0.72 },
    tail: { type: 'sickle', len: 0.5, r: 0.034, tipR: 0.016 },
    fur: { ...SHORT, tail: 0.02 },
    coats: {
      tricolor: {
        palette: ['#b56a2e', '#fbf7ee', '#1f1b1a'],
        paint(v, set) {
          set(2, saddle(v, 0.02) * ss(0.04, 0.12, v.along));
          set(2, v.tag.tail * ss(0.72, 0.6, v.tailT));
          whiteMarks(v, set, 1, { face: 0.024, socks: 0.42, tip: true });
          set(1, legsBelow(v, 0.55, 0.1) * 0.9);
        },
      },
      'lemon-white': { palette: ['#fbf7ee', '#e2bd70', '#d3a557'], paint: (v, set) => (set(1, saddle(v, 0.15) * ss(0.04, 0.12, v.along) + v.head * ss(0.03, 0.05, Math.abs(v.fx)) * ss(1.0, 0.86, v.fz / v.muzzleZ) + earsOf(v)), set(2, earsOf(v) * 0.5)) },
      'red-white': { palette: ['#fbf7ee', '#a85b28', '#8a4a20'], paint: (v, set) => (set(1, saddle(v, 0.15) * ss(0.04, 0.12, v.along) + v.head * ss(0.03, 0.05, Math.abs(v.fx)) * ss(1.0, 0.86, v.fz / v.muzzleZ) + earsOf(v)), set(2, earsOf(v) * 0.5)) },
    },
  },
  cocker: {
    len: 1.0,
    elbow: 0.5,
    chestW: 0.14,
    waistW: 0.112,
    hipW: 0.125,
    croup: 0.95,
    tuck: 0.74,
    neck: { len: 0.32, r0: 0.11, r1: 0.082, up: 0.95 },
    head: { len: 0.46, muzzle: 0.42, skullW: 0.112, skullH: 0.11, stop: 0.56, muzzleW: 0.066, muzzleH: 0.064, taper: 0.92, lobes: 0.68, flews: 0.5, noseW: 0.033, eyeX: 0.078, eyeY: 0.018, eyeR: 0.028, eyeHigh: 0.72 },
    ear: { type: 'drop', len: 0.3, wide: 0.075, x: 0.88, y: 0.35, z: 0.32, tip: 0.85, neck: 0.72 },
    tail: { type: 'saber', len: 0.38, r: 0.034, tipR: 0.022 },
    fur: { ...DOUBLE, body: 0.035, chest: 0.055, neck: 0.03, throat: 0.04, shoulder: 0.024, thigh: 0.035, ear: 0.08, skull: 0.01, tail: 0.05, armU: 0.02, armL: 0.02, legU: 0.03, legL: 0.012, paw: 0.012, belly: 0.09, feather: 0.1, pants: 0.08, droop: 1, lie: 1.4, stretch: 4.5 },
    coats: {
      golden: { palette: ['#cf9a50', '#e7c88f', '#b57c38'], paint: (v, set) => (set(1, under(v) * 0.5 + v.tag.chest * 0.4), set(2, earsOf(v) * 0.7 + saddle(v, 0.4) * 0.3)) },
      'black-dog': plain(['#1e1b1b', '#2c2826', '#141212']),
      'liver-white': { palette: ['#faf5ea', '#6a3f2a', '#55311f'], nose: '#4a2f25', rim: '#4a2f25', paint: (v, set) => (set(1, saddle(v, 0.2) * ss(0.45, 0.55, v.noise(5, 2) + 0.2 * v.up) + earsOf(v)), set(1, v.head * ss(0.03, 0.05, Math.abs(v.fx)) * ss(1.0, 0.82, v.fz / v.muzzleZ))) },
    },
  },
  shiba: {
    len: 1.06,
    elbow: 0.5,
    chestW: 0.15,
    waistW: 0.122,
    hipW: 0.13,
    tuck: 0.74,
    neck: { len: 0.3, r0: 0.125, r1: 0.094, up: 0.9 },
    head: { len: 0.46, muzzle: 0.38, skullW: 0.135, skullH: 0.102, stop: 0.48, muzzleW: 0.064, muzzleH: 0.055, taper: 0.8, lobes: 0.6, flews: 0.08, noseW: 0.03, cheek: 0.72, eyeX: 0.083, eyeY: 0.018, eyeR: 0.02, eyeOut: 0.46 },
    ear: { type: 'prick', len: 0.14, wide: 0.062, x: 0.72, y: 0.82, z: 0.42, lean: 0.22, back: -0.1, point: 0.28, turn: 0.72, cup: 2 },
    tail: { type: 'curl', len: 0.56, r: 0.046, tipR: 0.02, stiff: 0.65 },
    fur: { ...DOUBLE, body: 0.032, chest: 0.05, neck: 0.04, throat: 0.04, thigh: 0.035, tail: 0.06, cheek: 0.02, pants: 0.02 },
    coats: {
      rust: {
        palette: ['#c7752f', '#fbf3e2', '#a95e24'],
        paint(v, set) {
          set(2, saddle(v, 0.55) * 0.3);
          set(1, v.tag.lip + v.tag.chin + snout(v, 0.05, 0.3) * ss(0.01, -0.03, v.fy - v.muzzleTop) + ss(0.03, -0.01, v.fy - v.mouthY) * (v.tag.cheek + v.tag.muzzle));
          set(1, chestPatch(v) + v.tag.throat * 0.9 + under(v, -0.1, -0.6) + legsBelow(v, 0.2, 0.1) * 0.5 + hindInside(v));
          set(1, browDots(v, 0.03) * 0.8 + v.tag.tail * ss(0.4, -0.4, v.ny) * 0.9);
        },
      },
      sesame: {
        palette: ['#c7752f', '#fbf3e2', '#1f1a18'],
        dither: 0.75,
        paint(v, set) {
          set(2, saddle(v, -0.1) * 0.42 + crest(v) * 0.42 + v.tag.skull * 0.32 + earsOf(v) * 0.4 + v.tag.tail * 0.3);
          set(1, v.tag.lip + v.tag.chin + snout(v, 0.05, 0.3) * ss(0.01, -0.03, v.fy - v.muzzleTop));
          set(1, chestPatch(v) + v.tag.throat * 0.9 + under(v, -0.1, -0.6) + hindInside(v));
        },
      },
      'black-tan': {
        palette: ['#1f1b1a', '#fbf3e2', '#b56f33'],
        paint(v, set) {
          set(2, browDots(v, 0.035) + legsBelow(v, 0.38, 0.08) + v.tag.cheek * ss(-0.02, -0.08, v.fy));
          set(1, v.tag.lip + v.tag.chin + snout(v, 0.05, 0.3) * ss(0.01, -0.03, v.fy - v.muzzleTop));
          set(1, chestPatch(v) + v.tag.throat * 0.9 + under(v, -0.1, -0.6) + legsBelow(v, 0.12, 0.06) + hindInside(v));
        },
      },
      'cream-dog': plain(['#efdfbf', '#faf2df', '#e2cda5']),
    },
  },
  jindo: {
    len: 1.1,
    elbow: 0.53,
    chestW: 0.145,
    waistW: 0.115,
    hipW: 0.125,
    tuck: 0.7,
    neck: { len: 0.34, r0: 0.125, r1: 0.09, up: 0.92 },
    head: { len: 0.45, muzzle: 0.42, skullW: 0.122, skullH: 0.098, stop: 0.42, muzzleW: 0.062, muzzleH: 0.055, taper: 0.82, flews: 0.08, noseW: 0.031, cheek: 0.66, eyeX: 0.078, eyeY: 0.02, eyeR: 0.02, eyeOut: 0.46 },
    ear: { type: 'prick', len: 0.15, wide: 0.06, x: 0.72, y: 0.82, z: 0.42, lean: 0.18, back: -0.12, point: 0.24, turn: 0.72, cup: 2 },
    tail: { type: 'sickle', len: 0.54, r: 0.042, tipR: 0.018 },
    fur: { ...DOUBLE, body: 0.03, chest: 0.042, neck: 0.04, throat: 0.04, thigh: 0.03, tail: 0.075, cheek: 0.016, pants: 0.02 },
    coats: {
      'white-dog': { palette: ['#f6f1e4', '#e8dfca', '#fffcf4'], nose: '#2e211c', paint: (v, set) => (set(1, saddle(v, 0.3) * 0.45 + earsOf(v) * 0.5), set(2, under(v) * 0.5)) },
      fawn: { palette: ['#cf9a56', '#f2e3c6', '#ad7a3c'], paint: (v, set) => (set(2, saddle(v, 0.5) * 0.4), set(1, v.tag.chin + v.tag.lip * 0.9 + chestPatch(v) * 0.8 + under(v) * 0.9 + legsBelow(v, 0.25, 0.1) * 0.6 + hindInside(v) + v.tag.tail * ss(0.3, -0.4, v.ny) * 0.8)) },
      brindle: { palette: ['#b48443', '#efdfc2', '#b48443', '#1f1a18'], pattern: 3, patScale: 26, dither: 0.7, paint: (v, set) => { set(3, 1 - under(v) * 0.6); set(1, v.tag.chin + v.tag.lip * 0.9); } },
      'black-tan': { palette: ['#1f1b1a', '#b4702f', '#f0e2c8'], paint: (v, set) => (tanPoints(v, set, 1, { legs: 0.34 }), set(2, chestPatch(v) * 0.6)) },
    },
  },
  bordercollie: {
    len: 1.13,
    elbow: 0.5,
    chestW: 0.135,
    waistW: 0.108,
    hipW: 0.12,
    croup: 0.96,
    tuck: 0.68,
    angle: 1.1,
    neck: { len: 0.34, r0: 0.11, r1: 0.082, up: 0.8 },
    head: { len: 0.45, muzzle: 0.45, skullW: 0.112, skullH: 0.09, stop: 0.38, muzzleW: 0.058, muzzleH: 0.053, taper: 0.8, flews: 0.1, noseW: 0.03, eyeX: 0.072, eyeY: 0.02, eyeR: 0.023, eyeOut: 0.44 },
    ear: { type: 'semi', len: 0.17, wide: 0.058, x: 0.74, y: 0.76, z: 0.42 },
    tail: { type: 'saber', len: 0.64, r: 0.036, tipR: 0.014 },
    fur: { ...DOUBLE, body: 0.04, chest: 0.075, neck: 0.06, throat: 0.06, thigh: 0.04, tail: 0.075, skull: 0.008, cheek: 0.012, armU: 0.012, armL: 0.007, legU: 0.012, legL: 0.007, feather: 0.05, pants: 0.04, belly: 0.03 },
    coats: {
      'black-white': { palette: ['#1d1a1a', '#faf6ec', '#2a2625'], paint: (v, set) => whiteMarks(v, set, 1, { face: 0.022, socks: 0.3 }) },
      'red-white': { palette: ['#7c4525', '#faf6ec', '#91542e'], nose: '#4a2f25', rim: '#4a2f25', eye: '#7a5226', paint: (v, set) => whiteMarks(v, set, 1, { face: 0.022, socks: 0.3 }) },
      merle: { palette: ['#8a919c', '#faf6ec', '#a7adb6', '#23201f'], pattern: 2, patScale: 7, patAt: 0.46, eye: '#6d9ecb', paint: (v, set) => { set(3, 1); whiteMarks(v, set, 1, { face: 0.022, socks: 0.3 }); } },
    },
  },
  husky: {
    len: 1.08,
    elbow: 0.53,
    chestW: 0.14,
    waistW: 0.112,
    hipW: 0.122,
    tuck: 0.7,
    neck: { len: 0.32, r0: 0.118, r1: 0.086, up: 0.82 },
    head: { len: 0.44, muzzle: 0.44, skullW: 0.115, skullH: 0.092, stop: 0.38, muzzleW: 0.06, muzzleH: 0.054, taper: 0.8, flews: 0.08, noseW: 0.03, cheek: 0.66, eyeX: 0.074, eyeY: 0.02, eyeR: 0.022, eyeOut: 0.44, eyeHigh: 0.6 },
    ear: { type: 'prick', len: 0.16, wide: 0.066, x: 0.68, y: 0.84, z: 0.42, lean: 0.14, back: 0.04, point: 0.3, turn: 0.42 },
    tail: { type: 'saber', len: 0.6, r: 0.046, tipR: 0.02 },
    fur: { ...DOUBLE, body: 0.05, chest: 0.075, neck: 0.075, throat: 0.07, thigh: 0.05, tail: 0.11, skull: 0.012, cheek: 0.03, plume: 0.04 },
    coats: {
      'black-white': huskyCoat('#26221f', '#3d3a39'),
      'gray-white': huskyCoat('#6f7279', '#8f9299'),
      'red-white': huskyCoat('#a2582a', '#bb7440', { nose: '#5a3524', rim: '#5a3524' }),
    },
  },
  samoyed: {
    len: 1.02,
    elbow: 0.53,
    chestW: 0.145,
    waistW: 0.12,
    hipW: 0.13,
    tuck: 0.74,
    neck: { len: 0.3, r0: 0.125, r1: 0.09, up: 0.92 },
    head: { len: 0.45, muzzle: 0.42, skullW: 0.125, skullH: 0.098, stop: 0.42, muzzleW: 0.062, muzzleH: 0.052, taper: 0.8, lobes: 0.62, flews: 0.05, noseW: 0.031, cheek: 0.7, eyeX: 0.08, eyeY: 0.016, eyeR: 0.022, eyeOut: 0.46 },
    ear: { type: 'prick', len: 0.14, wide: 0.058, x: 0.72, y: 0.84, z: 0.42, lean: 0.24, point: 0.38, turn: 0.62, thick: 0.012 },
    tail: { type: 'curl', len: 0.6, r: 0.042, tipR: 0.02, stiff: 0.55 },
    fur: { ...DOUBLE, body: 0.1, chest: 0.13, neck: 0.14, throat: 0.13, shoulder: 0.08, thigh: 0.09, tail: 0.17, skull: 0.024, cheek: 0.06, armU: 0.035, armL: 0.016, legU: 0.04, legL: 0.012, pants: 0.04, ear: 0.024, muzzle: 0.007, lie: 0.65, droop: 0.2, locks: 0.14 },
    coats: {
      'white-dog': { palette: ['#fbf8f1', '#efe8da', '#fffef9'], dither: 0.55, paint: (v, set) => (set(1, under(v) * 0.5), set(2, saddle(v, 0.2) * 0.7)) },
      'golden-pale': { palette: ['#f6ead0', '#fbf6e8', '#ead7ac'], dither: 0.55, paint: (v, set) => (set(1, under(v) * 0.6), set(2, saddle(v, 0.3) * 0.5 + earsOf(v) * 0.6)) },
    },
  },
  dalmatian: {
    len: 1.08,
    elbow: 0.54,
    chestW: 0.135,
    waistW: 0.1,
    hipW: 0.115,
    tuck: 0.64,
    neck: { len: 0.36, r0: 0.11, r1: 0.076, up: 0.82 },
    head: { len: 0.45, muzzle: 0.47, skullW: 0.108, skullH: 0.088, stop: 0.36, muzzleW: 0.066, muzzleH: 0.06, taper: 0.9, flews: 0.28, noseW: 0.032, eyeX: 0.072, eyeR: 0.022 },
    ear: { type: 'drop', len: 0.17, wide: 0.058, x: 0.84, y: 0.72, z: 0.36, tip: 0.5 },
    tail: { type: 'saber', len: 0.62, r: 0.03, tipR: 0.011 },
    fur: { ...SLEEK, body: 0.009 },
    coats: {
      spotted: { palette: ['#f8f5ee', '#f1ece0', '#f8f5ee', '#1c1918'], pattern: 1, patScale: 10, dither: 0.1, paint: (v, set) => set(3, 1) },
      'liver-spotted': { palette: ['#f8f5ee', '#f1ece0', '#f8f5ee', '#673d29'], pattern: 1, patScale: 10, dither: 0.1, nose: '#533324', rim: '#533324', eye: '#7c5427', paint: (v, set) => set(3, 1) },
    },
  },
  boxer: {
    len: 1.0,
    elbow: 0.53,
    chestW: 0.15,
    waistW: 0.105,
    hipW: 0.122,
    tuck: 0.62,
    bone: 1.2,
    neck: { len: 0.3, r0: 0.135, r1: 0.1, up: 0.88 },
    head: { len: 0.42, muzzle: 0.27, skullW: 0.122, skullH: 0.108, stop: 0.56, muzzleW: 0.098, muzzleH: 0.082, taper: 1.04, lobes: 0.78, flews: 0.7, noseUp: 0.3, noseW: 0.036, eyeX: 0.084, eyeY: 0.012, eyeR: 0.022, under: 0.22 },
    ear: { type: 'drop', len: 0.14, wide: 0.058, x: 0.8, y: 0.8, z: 0.4, tip: 0.48, out: 0.32 },
    tail: { type: 'saber', len: 0.46, r: 0.034, tipR: 0.014 },
    fur: { ...SLEEK },
    coats: {
      fawn: { palette: ['#bf8a4e', '#f7f2e6', '#1f1a18'], paint: (v, set) => (set(2, snout(v, -0.12, 0.08) * 0.92 + v.tag.lip + ss(0.075, 0.05, v.eyeD) * v.head * 0.7 + earsOf(v) * 0.35), set(1, chestPatch(v) * 0.95 + legsBelow(v, 0.16) + under(v, -0.6, -0.95) * 0.7 + blaze(v, 0.018) * ss(0.72, 0.6, v.fz / v.muzzleZ))) },
      brindle: { palette: ['#a9743c', '#f7f2e6', '#1f1a18', '#201b18'], pattern: 3, patScale: 28, dither: 0.7, paint: (v, set) => { set(3, 1); set(2, snout(v, -0.12, 0.08) * 0.92 + v.tag.lip); set(1, chestPatch(v) * 0.95 + legsBelow(v, 0.16)); } },
    },
  },
  labrador: {
    len: 1.08,
    elbow: 0.5,
    chestW: 0.165,
    waistW: 0.138,
    hipW: 0.145,
    tuck: 0.76,
    rump: 0.86,
    bone: 1.2,
    head: { len: 0.45, muzzle: 0.46, skullW: 0.13, skullH: 0.102, muzzleW: 0.085, muzzleH: 0.075, flews: 0.32, noseW: 0.037, stop: 0.44, eyeX: 0.08, eyeR: 0.022 },
    ear: { type: 'drop', len: 0.17, wide: 0.058, x: 0.86, y: 0.66, z: 0.34, tip: 0.5 },
    tail: { type: 'otter', len: 0.58, r: 0.052, tipR: 0.018 },
    fur: { ...SHORT, tail: 0.015 },
    coats: {
      'yellow-lab': { palette: ['#dcc08b', '#efdfbf', '#c9a66c'], nose: '#3a2c26', paint: (v, set) => (set(1, under(v) * 0.7 + v.tag.chest * 0.25), set(2, saddle(v, 0.45) * 0.35 + earsOf(v) * 0.75)) },
      'black-dog': plain(['#1c1919', '#282423', '#131111'], { dither: 0.3 }),
      chocolate: plain(['#573826', '#6b4630', '#452b1b'], { nose: '#3a271e', rim: '#3a271e', eye: '#6f4a24' }),
    },
  },
  golden: {
    len: 1.08,
    elbow: 0.5,
    chestW: 0.155,
    waistW: 0.128,
    hipW: 0.138,
    tuck: 0.74,
    bone: 1.15,
    head: { len: 0.45, muzzle: 0.45, skullW: 0.125, muzzleW: 0.08, muzzleH: 0.07, flews: 0.28, eyeR: 0.022 },
    ear: { type: 'drop', len: 0.19, wide: 0.06, x: 0.86, y: 0.62, z: 0.34 },
    tail: { type: 'saber', len: 0.62, r: 0.04, tipR: 0.016 },
    fur: { ...DOUBLE, body: 0.042, chest: 0.075, neck: 0.05, throat: 0.06, shoulder: 0.03, thigh: 0.045, armU: 0.018, armL: 0.009, legU: 0.02, ear: 0.03, skull: 0.009, cheek: 0.015, tail: 0.05, belly: 0.05, feather: 0.055, pants: 0.04, plume: 0.09, droop: 0.5, lie: 1.5, stretch: 4.2 },
    coats: {
      golden: goldenCoat('#cda05a', '#e8cf9e', '#a97a3a'),
      'golden-pale': goldenCoat('#e6cf9f', '#f4e7c9', '#d4b57e'),
      'golden-dark': goldenCoat('#b37736', '#cf9a5a', '#8f5a25'),
    },
  },
  gsd: {
    len: 1.2,
    elbow: 0.5,
    croup: 0.92,
    chestW: 0.15,
    waistW: 0.112,
    hipW: 0.122,
    tuck: 0.68,
    bone: 1.15,
    paw: 1.05,
    angle: 1.3,
    neck: { len: 0.36, r0: 0.125, r1: 0.09, up: 0.72 },
    head: { len: 0.46, muzzle: 0.5, skullW: 0.112, skullH: 0.088, stop: 0.3, muzzleW: 0.062, muzzleH: 0.056, taper: 0.82, flews: 0.12, noseW: 0.031, cheek: 0.66, eyeX: 0.072, eyeY: 0.022, eyeR: 0.021, eyeOut: 0.44, eyeHigh: 0.55 },
    ear: { type: 'prick', len: 0.165, wide: 0.066, x: 0.72, y: 0.8, z: 0.42, lean: 0.26, back: 0.0, point: 0.2, turn: 0.52 },
    tail: { type: 'saber', len: 0.66, r: 0.04, tipR: 0.018 },
    fur: { ...DOUBLE, body: 0.03, chest: 0.045, neck: 0.05, throat: 0.05, shoulder: 0.024, thigh: 0.03, armU: 0.012, armL: 0.007, legU: 0.014, legL: 0.006, tail: 0.05, plume: 0.05, pants: 0.04, skull: 0.008, cheek: 0.012, lie: 1.6 },
    coats: {
      'black-tan': {
        palette: ['#b9823f', '#1d1918', '#d8b57f'],
        paint(v, set) {
          set(2, under(v, -0.2, -0.8) * 0.7 + legsBelow(v, 0.35, 0.08) * 0.5 + hindInside(v));
          set(1, saddle(v, 0.02));
          set(1, crest(v, 0.1) * 0.85);
          set(1, snout(v, -0.08, 0.15) + ss(0.09, 0.05, v.eyeD) * v.head * 0.25);
          set(1, v.tag.skull * ss(0.1, 0.22, v.fy) * 0.6);
          set(1, earsOf(v) * 0.75);
          set(1, v.tag.tail * ss(0.0, 0.5, v.ny + v.tailT * 0.5));
        },
      },
      sable: {
        palette: ['#a97f4c', '#1e1a18', '#d3b382'],
        dither: 0.8,
        paint(v, set) {
          set(2, under(v, -0.2, -0.8) * 0.6 + legsBelow(v, 0.4, 0.1) * 0.5);
          set(1, saddle(v, -0.1) * 0.5 + crest(v) * 0.5 + v.tag.tail * 0.45 + earsOf(v) * 0.5 + v.tag.skull * 0.35);
          set(1, snout(v, -0.08, 0.15) * 0.9);
        },
      },
      'black-dog': plain(['#1c1919', '#282423', '#131111']),
    },
  },
  rottweiler: {
    len: 1.08,
    elbow: 0.5,
    chestW: 0.19,
    waistW: 0.145,
    hipW: 0.16,
    tuck: 0.74,
    rump: 0.86,
    bone: 1.3,
    paw: 1.1,
    neck: { len: 0.28, r0: 0.16, r1: 0.122, up: 0.8 },
    head: { len: 0.44, muzzle: 0.38, skullW: 0.148, skullH: 0.112, stop: 0.5, muzzleW: 0.094, muzzleH: 0.082, taper: 0.96, lobes: 0.7, flews: 0.5, noseW: 0.038, cheek: 0.72, eyeX: 0.09, eyeR: 0.021 },
    ear: { type: 'drop', len: 0.14, wide: 0.066, x: 0.82, y: 0.8, z: 0.4, tip: 0.46, out: 0.3 },
    tail: { type: 'saber', len: 0.5, r: 0.044, tipR: 0.018 },
    fur: { ...SHORT, body: 0.012 },
    coats: { 'black-tan': { palette: ['#1b1817', '#9c5724'], paint: (v, set) => tanPoints(v, set, 1, { legs: 0.34 }), dither: 0.3 } },
  },
  greyhound: {
    len: 1.06,
    elbow: 0.5,
    croup: 0.97,
    chestW: 0.112,
    waistW: 0.068,
    hipW: 0.095,
    tuck: 0.42,
    rump: 0.68,
    bone: 0.84,
    paw: 0.92,
    angle: 1.35,
    neck: { len: 0.34, r0: 0.1, r1: 0.07, up: 0.72, flat: 0.8 },
    head: { len: 0.46, muzzle: 0.5, skullW: 0.086, skullH: 0.074, stop: 0.16, muzzleW: 0.047, muzzleH: 0.045, taper: 0.72, lobes: 0.5, flews: 0.05, noseW: 0.024, eyeX: 0.056, eyeY: 0.016, eyeR: 0.021, eyeOut: 0.5, cheek: 0.5 },
    ear: { type: 'rose', len: 0.11, wide: 0.036, x: 0.8, y: 0.7, z: 0.3, thick: 0.006 },
    tail: { type: 'whip', len: 0.86, r: 0.024, tipR: 0.007 },
    fur: { ...SLEEK, body: 0.006, cell: 0.0032 },
    coats: {
      fawn: { palette: ['#c9a06c', '#e7d3b2', '#a97f4e'], paint: (v, set) => (set(1, under(v) * 0.7 + v.tag.chest * 0.5), set(2, snout(v, 0.2, 0.5) * 0.5)) },
      slate: plain(['#6b7079', '#7f848c', '#5a5e66'], { eye: '#5b4426' }),
      'black-white': { palette: ['#1d1a1a', '#f8f5ee'], paint: (v, set) => whiteMarks(v, set, 1, { face: 0.018, socks: 0.3 }) },
      brindle: { palette: ['#a9743c', '#f4efe2', '#a9743c', '#1f1a18'], pattern: 3, patScale: 26, dither: 0.7, paint: (v, set) => { set(3, 1); set(1, under(v, -0.6, -0.95) * 0.5); } },
    },
  },
  bernese: {
    len: 1.08,
    elbow: 0.48,
    chestW: 0.175,
    waistW: 0.145,
    hipW: 0.15,
    tuck: 0.78,
    rump: 0.86,
    bone: 1.25,
    paw: 1.08,
    neck: { len: 0.3, r0: 0.145, r1: 0.105, up: 0.8 },
    head: { len: 0.43, muzzle: 0.43, skullW: 0.132, skullH: 0.104, stop: 0.48, muzzleW: 0.08, muzzleH: 0.07, taper: 0.92, lobes: 0.66, flews: 0.4, noseW: 0.036, eyeX: 0.084, eyeR: 0.021 },
    ear: { type: 'drop', len: 0.16, wide: 0.066, x: 0.84, y: 0.72, z: 0.36, tip: 0.5, out: 0.28 },
    tail: { type: 'saber', len: 0.6, r: 0.044, tipR: 0.02 },
    fur: { ...DOUBLE, body: 0.05, chest: 0.07, neck: 0.06, throat: 0.06, thigh: 0.05, tail: 0.075, plume: 0.06, feather: 0.03, belly: 0.03, skull: 0.008, cheek: 0.014, ear: 0.02, droop: 0.7, lie: 1.6, stretch: 4.2 },
    coats: {
      tricolor: {
        palette: ['#1b1817', '#fbf7ee', '#a4582a'],
        paint(v, set) {
          set(2, browDots(v, 0.042) + v.tag.cheek * ss(0.0, -0.08, v.fy) * 0.9 + legsBelow(v, 0.46, 0.08));
          set(2, v.tag.lip * 0.4 + hindInside(v) * 0.5);
          whiteMarks(v, set, 1, { face: 0.024, muzzle: true, collar: false, socks: 0.16, tip: true, belly: 0.15 });
        },
      },
    },
  },
  stbernard: {
    len: 1.1,
    elbow: 0.48,
    chestW: 0.19,
    waistW: 0.16,
    hipW: 0.165,
    tuck: 0.8,
    rump: 0.88,
    bone: 1.35,
    paw: 1.15,
    neck: { len: 0.27, r0: 0.17, r1: 0.13, up: 0.74 },
    head: { len: 0.46, muzzle: 0.34, skullW: 0.165, skullH: 0.13, stop: 0.62, muzzleW: 0.11, muzzleH: 0.1, taper: 1, lobes: 0.76, flews: 0.8, noseUp: 0.12, noseW: 0.045, cheek: 0.72, brow: 0.8, eyeX: 0.1, eyeY: 0.008, eyeR: 0.023 },
    ear: { type: 'drop', len: 0.18, wide: 0.075, x: 0.84, y: 0.66, z: 0.38, tip: 0.5, out: 0.3 },
    tail: { type: 'saber', len: 0.68, r: 0.05, tipR: 0.024 },
    fur: { ...DOUBLE, body: 0.03, chest: 0.05, neck: 0.05, throat: 0.05, thigh: 0.03, tail: 0.05, plume: 0.04, feather: 0.015, skull: 0.008, cheek: 0.012, ear: 0.012, lie: 1.6 },
    coats: {
      'red-white': {
        palette: ['#a95a26', '#fbf7ee', '#231c18'],
        paint(v, set) {
          whiteMarks(v, set, 1, { face: 0.04, socks: 0.42, muzzle: true });
          set(2, ss(0.075, 0.045, v.eyeD) * v.head * 0.92 + earsOf(v) * 0.6);
        },
      },
    },
  },
  greatdane: {
    len: 1.02,
    elbow: 0.56,
    croup: 0.97,
    chestW: 0.128,
    waistW: 0.092,
    hipW: 0.108,
    tuck: 0.58,
    rump: 0.76,
    bone: 1.1,
    paw: 1.05,
    neck: { len: 0.42, r0: 0.11, r1: 0.075, up: 0.92 },
    head: { len: 0.42, muzzle: 0.5, skullW: 0.09, skullH: 0.08, stop: 0.42, muzzleW: 0.063, muzzleH: 0.065, taper: 1, lobes: 0.74, flews: 0.55, noseW: 0.03, eyeX: 0.062, eyeY: 0.014, eyeR: 0.016 },
    ear: { type: 'drop', len: 0.12, wide: 0.044, x: 0.84, y: 0.76, z: 0.36, tip: 0.48 },
    tail: { type: 'saber', len: 0.7, r: 0.028, tipR: 0.01 },
    fur: { ...SLEEK, body: 0.006, cell: 0.0032 },
    coats: {
      fawn: { palette: ['#c9a067', '#1f1a18', '#dcbd8c'], paint: (v, set) => (set(2, under(v) * 0.5), set(1, snout(v, -0.12, 0.08) * 0.95 + ss(0.06, 0.035, v.eyeD) * v.head * 0.8 + earsOf(v) * 0.7)) },
      harlequin: { palette: ['#f6f3ec', '#efeadf', '#f6f3ec', '#191716'], pattern: 2, patScale: 6.5, patAt: 0.53, dither: 0.15, paint: (v, set) => set(3, 1) },
      'black-dog': plain(['#1a1716', '#262221', '#121010'], { dither: 0.2 }),
      slate: plain(['#596069', '#6b727b', '#4a5059'], { nose: '#2a2c30', rim: '#2a2c30', eye: '#5b4426', dither: 0.25 }),
    },
  },
};

function huskyCoat(dark, mid, more = {}) {
  return {
    palette: [dark, '#fbf8f1', mid],
    eye: '#7fb4e0',
    ...more,
    paint(v, set) {
      set(2, saddle(v, 0.3) * 0.4);
      set(1, under(v, 0.05, -0.45) + v.tag.chest + v.tag.throat + hindInside(v));
      set(1, legsBelow(v, 0.62, 0.1));
      set(1, collarRing(v, 0.0, 0.42) * 0.55);
      set(1, v.tag.tail * ss(0.35, -0.3, v.ny) + tailTip(v, 0.82));
      // The mask: white on its face and muzzle, a dark cap and a line up its nose.
      const face = v.head * ss(0.6, 0.9, v.fz / v.muzzleZ) * (1 - ss(0.1, 0.16, v.fy - 0.08 + Math.abs(v.fx) * 0.45));
      set(1, face);
      set(1, v.tag.cheek + v.tag.chin + v.tag.lip + v.tag.muzzle * ss(0.0, 0.04, Math.abs(v.fx)));
      set(1, ss(0.06, 0.03, v.browD) * v.head);
      set(0, v.tag.skull * ss(0.03, 0.01, Math.abs(v.fx)) * ss(0.8, 0.6, v.fz / v.muzzleZ));
      set(1, v.tag.ear * ss(0.3, -0.1, v.earIn) * 0.9);
    },
  };
}

function goldenCoat(base, pale, dark) {
  return {
    palette: [base, pale, dark],
    paint(v, set) {
      set(1, v.tag.chest * 0.55 + under(v) * 0.65);
      set(1, hindInside(v) * 0.5 + v.tag.tail * ss(0.3, -0.4, v.ny) * 0.75);
      set(1, snout(v, 0.1, 0.45) * 0.6);
      set(2, earsOf(v) * 0.8 + saddle(v, 0.55) * 0.25);
    },
  };
}

// The one you start with: a puppy of no breed in particular, all head and
// paws, in the colours a pet has always come in.
const pup = (base, pale, dark, extra = {}) => ({
  palette: [base, pale, dark],
  paint(v, set) {
    set(1, under(v) * 0.75 + chestPatch(v) * 0.8 + snout(v, 0.05, 0.3) * 0.75 + legsBelow(v, 0.16) * 0.6);
    set(2, earsOf(v) * 0.8);
  },
  ...extra,
});
const puppy = {
  size: 0.36,
  len: 0.92,
  elbow: 0.52,
  chestW: 0.15,
  waistW: 0.13,
  hipW: 0.14,
  tuck: 0.84,
  rump: 0.86,
  bone: 1.25,
  paw: 1.28,
  neck: { len: 0.25, r0: 0.13, r1: 0.105, up: 0.95 },
  head: { len: 0.56, muzzle: 0.32, skullW: 0.17, skullH: 0.145, stop: 0.56, muzzleW: 0.08, muzzleH: 0.066, taper: 0.9, lobes: 0.66, flews: 0.2, noseW: 0.036, cheek: 0.62, eyeX: 0.108, eyeY: 0.002, eyeZ: 0.94, eyeR: 0.034, eyeOut: 0.46, eyeHigh: 0.82, eyeLow: 0.7, pitch: 0.08 },
  ear: { type: 'drop', len: 0.2, wide: 0.075, x: 0.88, y: 0.55, z: 0.36, tip: 0.66 },
  tail: { type: 'sickle', len: 0.36, r: 0.034, tipR: 0.016 },
  fur: { ...DOUBLE, body: 0.04, chest: 0.05, neck: 0.05, throat: 0.05, thigh: 0.04, tail: 0.05, skull: 0.018, cheek: 0.024, ear: 0.022, muzzle: 0.007, armU: 0.018, armL: 0.012, legU: 0.02, legL: 0.012, paw: 0.01, pants: 0.01, lie: 1.1, locks: 0.14 },
  coats: {
    tan: pup('#e0b986', '#f4e3c8', '#c29560'),
    brown: pup('#a7714a', '#d9b48c', '#7f5233'),
    cream: pup('#f5e3c3', '#fbf3e2', '#e4c99c'),
    white: pup('#f8f4ee', '#fffdf9', '#e6dccb'),
    gray: pup('#a9adb7', '#dfe1e6', '#7f838d'),
    charcoal: pup('#4d5059', '#b9bbc2', '#34363d'),
  },
};
BREEDS.puppy = puppy;

const sizes = new Map(DOGS.map((d) => [d.key, d.size]));
const merged = new Map();
export function breedOf(key) {
  let b = merged.get(key);
  if (!b) {
    const o = BREEDS[key];
    b = { ...BASE, ...o, neck: { ...BASE.neck, ...o.neck }, head: { ...BASE.head, ...o.head }, ear: { ...BASE.ear, ...o.ear }, tail: { ...BASE.tail, ...o.tail }, fur: { ...BASE.fur, ...o.fur }, key, size: sizes.get(key) ?? o.size ?? 0.6 };
    merged.set(key, b);
  }
  return b;
}

export function coatOf(key, name) {
  const coats = breedOf(key).coats;
  return coats[name] ?? Object.values(coats)[0];
}

export const isBreed = (key) => Object.hasOwn(BREEDS, key);
