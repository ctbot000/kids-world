// A real dog, of any breed (dog-breeds.js): one skin sculpted over its bones
// (dog-sculpt.js) with the shape of that breed, in the coat it was given, and
// fur on it (dog-fur.js), walking on legs that bend where a dog's do.
//
// Everything is measured in the dog's own height at the shoulders, from its
// feet, facing +z; rig.root is scaled to its real size. Each breed's skin is
// made once, the first time one is seen, and each coat's colours once.
import * as THREE from '../../vendor/three.module.js';
import { breedOf, coatOf as breedCoat } from './dog-breeds.js';
import { furMaterials, shellsFor, shellGeometry } from './dog-fur.js';
import { Blob, clamp, Cone, gridLines, lerp, mirrorLines, noise, normalAt, Plate, Sculpture, skinOver, smooth } from './dog-sculpt.js';
import { geo, lathe, mesh, sphere, toon, toyMaterial } from './toon.js';

// The bones, by number.
const PELVIS = 0;
const SPINE = 1;
const CHEST = 2;
const NECK1 = 3;
const NECK2 = 4;
const HEAD = 5;
const JAW = 6;
const EAR = [7, 9]; // and the one after each: its tip
const TAIL = [11, 12, 13, 14];
// Each leg: from the body down to the paw. Front: shoulder blade, upper arm,
// forearm, pastern, paw; back: thigh, shin, hock, paw.
const LEGS = [
  { side: -1, front: true, bones: [15, 16, 17, 18, 19] },
  { side: 1, front: true, bones: [20, 21, 22, 23, 24] },
  { side: -1, front: false, bones: [25, 26, 27, 28] },
  { side: 1, front: false, bones: [29, 30, 31, 32] },
];
const BONES = 33;
const PARENT = new Array(BONES).fill(-1);
PARENT[SPINE] = PELVIS;
PARENT[CHEST] = SPINE;
PARENT[NECK1] = CHEST;
PARENT[NECK2] = NECK1;
PARENT[HEAD] = NECK2;
PARENT[JAW] = HEAD;
for (const e of EAR) {
  PARENT[e] = HEAD;
  PARENT[e + 1] = e;
}
TAIL.forEach((t, i) => (PARENT[t] = i ? TAIL[i - 1] : PELVIS));
for (const leg of LEGS) leg.bones.forEach((b, i) => (PARENT[b] = i ? leg.bones[i - 1] : leg.front ? CHEST : PELVIS));

// The tags a part of a dog can have, in the order they are kept.
export const TAGS = ['torso', 'chest', 'shoulder', 'thigh', 'armU', 'armL', 'legU', 'legL', 'paw', 'neck', 'throat', 'skull', 'cheek', 'muzzle', 'lip', 'chin', 'nose', 'ear', 'tail'];
const TAG = Object.fromEntries(TAGS.map((t, i) => [t, i]));

const add = (a, b, k = 1) => [a[0] + b[0] * k, a[1] + b[1] * k, a[2] + b[2] * k];
const mix = (a, b, k) => [lerp(a[0], b[0], k), lerp(a[1], b[1], k), lerp(a[2], b[2], k)];
const unit = (v) => {
  const l = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / l, v[1] / l, v[2] / l];
};
const crossOf = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

// Every point of a breed's body, and the parts sculpted over them.
function anatomy(s) {
  const L = s.len;
  const zF = L / 2;
  const zB = -L / 2;
  const elbow = s.elbow;
  const rC = (1 - elbow) * 0.5;
  const yC = 1 - rC - 0.012;
  const zC = zF - rC * 0.92;
  const rR = rC * s.rump;
  const yR = s.croup - rR;
  const zR = zB + rR * 0.98;
  const rL = rC * s.tuck;
  const zL = lerp(zC, zR, 0.64);
  const yL = lerp(1, s.croup, 0.62) - 0.008 - rL;
  const zMid = lerp(zC, zL, 0.5);
  const yMid = lerp(yC, yL, 0.5);
  const rMid = lerp(rC, rL, 0.55);
  const cw = s.chestW;
  const hw = s.hipW;
  const w = lerp(cw, s.waistW, 0.5);
  // The bones' ends, side by side with the parts they move.
  const legK = elbow / 0.52;
  const paw = 0.052 * s.paw;
  const fx = cw * 0.68;
  const shoulderTop = [cw * 0.45, yC + rC * 0.72, zC + 0.02];
  const shoulder = [fx * 1.06, yC - rC * 0.02, zF - 0.075];
  const elb = [fx, elbow + 0.015, shoulder[2] - 0.17 * Math.min(1.1, legK * 1.05)];
  const carpus = [fx * 0.94, Math.max(paw * 2.1, elbow * 0.29), elb[2] + 0.018];
  const fPaw = [fx * 0.94, paw, carpus[2] + 0.035 * s.paw];
  const hipX = hw * 0.62;
  const hip = [hipX, yR + rR * 0.12, zB + 0.125 * Math.max(0.85, s.rump / 0.82)];
  const ang = s.angle;
  const stifle = [hipX * 1.08, elbow * 0.93, hip[2] + 0.15 * ang * Math.min(1.1, legK)];
  const hock = [hipX, elbow * 0.53, zB - 0.012 * ang];
  const hPaw = [hipX, paw, hock[2] + 0.045 * Math.min(1.1, legK)];
  const pts = { shoulderTop, shoulder, elb, carpus, fPaw, hip, stifle, hock, hPaw };

  // The neck, and the head on the end of it.
  const nb = s.neck;
  const neck0 = [0, yC + rC * 0.42, zC + rC * 0.42];
  const up = nb.up;
  const way = [0, Math.sin(up), Math.cos(up)];
  const neck1 = add(neck0, way, nb.len * 0.5);
  const atlas = add(neck0, way, nb.len);
  const h = s.head;
  const HL = h.len;
  const SL = HL * (1 - h.muzzle);
  const hp = h.pitch;
  const cosP = Math.cos(hp);
  const sinP = Math.sin(hp);
  // From the head's own frame (origin at the back of the skull) into the body's.
  const H = (x, y, z) => [x, atlas[1] + y * cosP - z * sinP, atlas[2] + y * sinP + z * cosP];
  const dirH = (x, y, z) => [x, y * cosP - z * sinP, y * sinP + z * cosP];
  const sw = h.skullW;
  const sh = h.skullH;
  const mw = h.muzzleW;
  const mh = h.muzzleH;
  const my = -sh * h.stop;
  const tip = h.taper;
  const lobes = h.lobes ?? 0.55;
  const parts = [];
  const put = (p) => parts.push(p);

  // Its trunk: chest, ribs, loin and rump, each moved by its own bone.
  put(new Cone([0, yC, zC], [0, yMid, zMid], rC, rMid, { flat: cw / rC, bone: CHEST, tag: 'torso', k: 0.05, reach: 0.12 }));
  put(new Cone([0, yMid, zMid], [0, yL, zL], rMid, rL, { flat: w / rMid, bone: SPINE, tag: 'torso', k: 0.05, reach: 0.12 }));
  put(new Cone([0, yL, zL], [0, yR, zR], rL, rR, { flat: hw / rR, bone: PELVIS, tag: 'torso', k: 0.05, reach: 0.12 }));
  // The breastbone in front, the withers on top, the croup behind.
  put(new Blob([0, yC - rC * 0.08, zF - rC * 0.58], [cw * 0.72, rC * 0.74, rC * 0.56], { bone: CHEST, tag: 'chest', k: 0.09, reach: 0.1, flow: 1, hair: [0, -0.8, 0.45] }));
  put(new Cone([0, 1 - 0.038, zC + 0.05], [0, 1 - 0.05, zC - 0.1], 0.032, 0.03, { bone: CHEST, tag: 'torso', k: 0.08 }));
  put(new Blob([0, yR + rR * 0.08, zR - rR * 0.12], [hw * 0.86, rR * 0.86, rR * 0.9], { bone: PELVIS, tag: 'torso', k: 0.05, reach: 0.1 }));
  // The barrel of its ribs, wider low down than the neck is.
  put(new Blob([0, yC - rC * 0.32, zC - 0.05], [cw * 0.92, rC * 0.7, rC * 1.05], { bone: CHEST, tag: 'torso', k: 0.08 }));

  const reachL = 0.035;
  for (const side of [-1, 1]) {
    const S = (p) => [side * p[0], p[1], p[2]];
    const leg = LEGS.find((l) => l.side === side && l.front).bones;
    const back = LEGS.find((l) => l.side === side && !l.front).bones;
    // The muscles over the shoulder blade, and the upper arm, the forearm, the
    // pastern and the paw going down from it.
    put(new Blob(S([cw * 0.74, yC + rC * 0.14, lerp(shoulderTop[2], shoulder[2], 0.48)]), [0.03 + cw * 0.1, rC * 0.74, 0.1], { pitch: 0.42, bone: leg[0], tag: 'shoulder', side, k: 0.11, reach: 0.05, flow: 1, hair: [0, -0.6, -0.8] }));
    put(new Cone(S(shoulder), S(elb), 0.07 * s.bone * 1.15, 0.05 * s.bone * 1.08, { flat: 0.85, bone: leg[1], tag: 'armU', side, k: 0.05, reach: reachL }));
    put(new Cone(S(elb), S(carpus), 0.039 * s.bone, 0.026 * s.bone, { flat: 0.88, bone: leg[2], tag: 'armL', side, k: 0.02, reach: reachL }));
    put(new Cone(S(carpus), S(fPaw), 0.0265 * s.bone, 0.028 * s.bone, { flat: 0.92, bone: leg[3], tag: 'armL', side, k: 0.012, reach: 0.025 }));
    pawParts(put, S, fPaw, s.paw, leg[4], side);
    // The big muscles of the thigh, the web of skin from it to the belly, the
    // shin narrowing to the hock, and the hock down to the paw.
    put(new Cone(S([hipX * 1.02, hip[1] + 0.02, hip[2] - 0.005]), S(mix(hip, stifle, 0.82)), 0.118 * Math.max(0.8, legK * 0.95), 0.08 * Math.max(0.75, legK), { flat: 0.74, bone: back[0], tag: 'thigh', side, k: 0.07, reach: 0.05, hair: [0, -0.7, -0.7] }));
    put(new Cone(S([hw * 0.55, yL - rL * 0.5, zL - 0.03]), S(mix(hip, stifle, 0.92)), 0.05, 0.055, { flat: 0.7, bone: back[0], tag: 'thigh', side, k: 0.05, reach: 0.04, hair: [0, -0.7, -0.7] }));
    put(new Cone(S(stifle), S(hock), 0.056 * s.bone, 0.027 * s.bone, { flat: 0.72, bone: back[1], tag: 'legU', side, k: 0.04, reach: reachL }));
    put(new Cone(S(hock), S(hPaw), 0.026 * s.bone, 0.028 * s.bone, { flat: 0.9, bone: back[2], tag: 'legL', side, k: 0.012, reach: 0.025 }));
    // The point of the hock.
    put(new Blob(S([hock[0], hock[1] + 0.012, hock[2] - 0.016]), [0.021, 0.03, 0.022], { bone: back[1], tag: 'legL', side, k: 0.015, reach: 0.02 }));
    pawParts(put, S, hPaw, s.paw * 0.94, back[3], side);
  }

  // The neck, deep at the chest; the back of its skull sits on the end.
  put(new Cone(neck0, neck1, nb.r0, lerp(nb.r0, nb.r1, 0.55), { flat: nb.flat, bone: NECK1, tag: 'neck', k: 0.07, flow: -1, reach: 0.06 }));
  put(new Cone(neck1, H(0, -0.005, SL * 0.2), lerp(nb.r0, nb.r1, 0.55), nb.r1, { flat: nb.flat, bone: NECK2, tag: 'neck', k: 0.05, flow: -1, reach: 0.06 }));
  // The throat, up under the jaw.
  put(new Cone(mix(neck1, H(0, my - mh, SL * 0.52), 0.4), H(0, my - mh * 0.95, SL * 0.56), nb.r1 * 0.72, mh * 0.72, { flat: 1, bone: NECK2, tag: 'throat', k: 0.05, flow: -1, reach: 0.04 }));

  // The skull, with a dome over a stop down to the muzzle.
  const skullC = H(0, 0, SL * 0.48);
  const flowBack = dirH(0, 0.05, -1);
  put(new Blob(skullC, [sw, sh, SL * 0.6], { pitch: hp, bone: HEAD, tag: 'skull', k: 0.03, hair: flowBack, reach: 0.04 }));
  // The occiput, and the cheek bones under the eyes.
  for (const side of [-1, 1]) {
    put(new Blob(H(side * sw * 0.66, -sh * 0.42, SL * 0.6), [sw * 0.4, sh * h.cheek, SL * 0.44], { pitch: hp, bone: HEAD, tag: 'cheek', k: 0.06, hair: flowBack, reach: 0.04 }));
    // Brows over the eyes.
    put(new Blob(H(side * h.eyeX * 0.95, h.eyeY + h.eyeR * 1.05, h.eyeZ * SL - h.eyeR * 0.15), [h.eyeR * 1.35, h.eyeR * h.brow, h.eyeR * 1.3], { pitch: hp, bone: HEAD, tag: 'skull', k: 0.018, hair: flowBack, reach: 0.03 }));
  }
  // The muzzle: square in front as a real one is, from a middle and a lobe of
  // lip down each side, which meet under the nose. Its top line starts at
  // the stop.
  const mz0 = SL * 0.86;
  const tipR = mh * tip;
  const mz1 = HL - tipR * 0.98;
  const flatM = mw / mh;
  put(new Cone(H(0, my + mh * 0.06, mz0), H(0, my + mh * (0.26 + h.noseUp), mz1), mh * 1.02, tipR * 0.86, { flat: flatM * 0.82, bone: HEAD, tag: 'muzzle', k: 0.035, hair: flowBack, reach: 0.03 }));
  for (const side of [-1, 1]) {
    const lx = mw * 0.47;
    const drop = h.flews;
    put(
      new Cone(H(side * lx * 1.12, my - mh * 0.34, SL * 0.8), H(side * lx * 0.9, my - mh * (0.3 + drop * 0.55), mz1 - tipR * 0.12), mh * (0.58 + drop * 0.1), tipR * (lobes + drop * 0.2), {
        flat: 0.92,
        bone: HEAD,
        tag: 'lip',
        k: 0.024,
        hair: flowBack,
        reach: 0.025,
      }),
    );
    // The eye's socket.
    put(new Blob(H(side * h.eyeX, h.eyeY, h.eyeZ * SL), [h.eyeR * 1.08, h.eyeR * 0.98, h.eyeR * 1.08], { cut: true, k: 0.012 }));
  }
  // The groove up the middle of its forehead, and under its nose.
  put(new Cone(H(0, sh * 0.72 + 0.012, SL * 0.68), H(0, h.eyeY + h.eyeR * 1.2, h.eyeZ * SL), 0.004, 0.009, { cut: true, k: 0.02 }));
  put(new Cone(H(0, my + mh * (0.02 + h.noseUp), HL - tipR * 0.02), H(0, my - mh * (0.46 + h.flews * 0.3), HL - tipR * 0.28), 0.0035, 0.004, { cut: true, k: 0.008 }));

  // The mouth, under the muzzle: what the lower jaw shuts into.
  const hinge = H(0, my - mh * 0.62, SL * 0.56);
  const chin = H(0, my - mh * (0.74 + h.flews * 0.15 + (h.under ?? 0)), HL - tipR * 0.75 + (h.under ?? 0) * 0.04);
  const jawR = mh * 0.46;
  const jawParts = [
    new Cone(hinge, chin, jawR * 1.1, jawR * 0.82, { flat: (mw / mh) * 0.9, bone: JAW, tag: 'chin', k: 0.02, hair: flowBack, reach: 0.1 }),
  ];
  // The nose: a leather pad with two nostrils.
  const nw = h.noseW;
  const nc = H(0, my + mh * (0.52 + h.noseUp), HL - nw * 0.42);
  const noseParts = [new Blob(nc, [nw, nw * 0.72, nw * 0.72], { pitch: hp - 0.15, bone: HEAD, tag: 'nose', k: 0.01, reach: 0.1 })];
  for (const side of [-1, 1]) {
    noseParts.push(new Blob(H(side * nw * 0.46, my + mh * (0.5 + h.noseUp), HL + nw * 0.18), [nw * 0.2, nw * 0.26, nw * 0.3], { pitch: hp, cut: true, k: 0.005 }));
  }

  // The ears and the tail, on bones of their own.
  const earParts = [-1, 1].map((side, i) => earOf(s.ear, side, EAR[i], { H, dirH, sw, sh, SL, h }));
  const tailParts = tailOf(s.tail, { yR, zB, rR });

  return {
    parts,
    jawParts,
    noseParts,
    earParts,
    tailParts,
    H,
    dirH,
    pts,
    hinge,
    atlas,
    neck0,
    neck1,
    zF,
    zB,
    zC,
    yC,
    rC,
    zR,
    yR,
    rR,
    zL,
    yL,
    rL,
    HL,
    SL,
    my,
    mh,
    mw,
    tipR,
    nc,
  };
}

// A paw: a pad under four toes, the middle two ahead of the outer two, and a
// groove between each.
function pawParts(put, S, at, k, bone, side) {
  const w = 0.04 * k;
  put(new Blob(S([at[0], at[1] * 0.86, at[2] + w * 0.32]), [w * 1.02, at[1] * 0.78, w * 1.26], { bone, tag: 'paw', side, k: 0.016, reach: 0.02 }));
  for (const [dx, dz, r] of [
    [-0.72, 0.72, 0.5],
    [-0.26, 1.08, 0.56],
    [0.26, 1.08, 0.56],
    [0.72, 0.72, 0.5],
  ]) {
    const a = [at[0] + dx * w * 0.8, at[1] * 0.78, at[2] + w * 0.6];
    const b = [at[0] + dx * w, at[1] * 0.56, at[2] + dz * w * 1.24];
    put(new Cone(S(a), S(b), w * r * 0.92, w * r * 0.74, { bone, tag: 'paw', side, k: 0.006, reach: 0.02 }));
  }
}

// An ear of each kind, from where it is set on the skull.
function earOf(e, side, bone, { H, dirH, sw, sh, SL, h }) {
  const len = e.len;
  const wide = e.wide;
  const th = e.thick ?? 0.0095;
  const tip = bone + 1;
  const o = { bone, tip, tag: 'ear', k: 0.012, reach: 0.03 };
  const set = H(side * sw * e.x, sh * e.y, SL * e.z);
  if (e.type === 'prick' || e.type === 'bat') {
    // Standing up, leaning out and a little back, hollow to the front.
    const lean = e.lean ?? 0.28;
    const fall = e.back ?? 0.12;
    const u = unit(dirH(side * lean, 1, -fall));
    const turn = e.turn ?? 0.55;
    const n0 = unit(dirH(side * Math.sin(turn), 0.05, Math.cos(turn)));
    const n = unit(add(n0, u, -(n0[0] * u[0] + n0[1] * u[1] + n0[2] * u[2])));
    const v = crossOf(n, u);
    const low = add(set, u, -wide * 0.25);
    const parts = [new Plate(low, u, v, n, len, wide, e.type === 'bat' ? wide * 0.72 : wide * (e.point ?? 0.13), th, { ...o, cup: e.cup ?? 2.6, flow: 1 })];
    return { parts, base: set, bend: add(set, u, len * 0.5) };
  }
  if (e.type === 'semi') {
    // Up to halfway, the rest folded over forwards.
    const u = unit(dirH(side * 0.3, 1, -0.05));
    const n = unit(dirH(side * 0.55, 0.05, 0.85));
    const v = crossOf(n, u);
    const mid = add(set, u, len * 0.52);
    const u2 = unit(dirH(side * 0.42, -0.25, 0.9));
    const n2 = unit(dirH(side * 0.35, 0.92, -0.2));
    const v2 = crossOf(n2, u2);
    const parts = [
      new Plate(add(set, u, -wide * 0.25), u, v, n, len * 0.56, wide, wide * 0.72, th, { ...o, cup: 1.8, tip: -1 }),
      new Plate(mid, u2, v2, n2, len * 0.42, wide * 0.72, wide * 0.32, th, { ...o, bone: tip, cup: 0.6, tip: -1 }),
    ];
    return { parts, base: set, bend: mid };
  }
  if (e.type === 'rose') {
    // Small, and folded back along its neck.
    const u = unit(dirH(side * 0.55, 0.1, -1));
    const n = unit(dirH(side * 0.7, 0.75, 0.1));
    const v = crossOf(n, u);
    return { parts: [new Plate(set, u, v, n, len, wide, wide * 0.42, th, { ...o, cup: 0.8 })], base: set, bend: add(set, u, len * 0.5) };
  }
  // Hanging down the side of its head, from a fold at the top.
  const out = e.out ?? 0.22;
  const forward = e.forward ?? 0.1;
  const u = unit(dirH(side * out, -1, forward));
  const n = unit(dirH(side * 1, out, 0.08));
  const v = crossOf(n, u);
  const parts = [new Plate(add(set, n, th), u, v, n, len, wide * (e.neck ?? 0.85), wide * (e.tip ?? 0.58), th, { ...o, cup: e.cup ?? -0.5, curl: e.curl ?? 0 })];
  return { parts, base: set, bend: add(set, u, len * 0.5) };
}

// A tail along the points of its kind, carried from the rump.
function tailOf(t, { yR, zB, rR }) {
  const r0 = t.r;
  const r1 = t.tipR ?? r0 * 0.45;
  const len = t.len;
  const base = [0, yR + rR * (t.set ?? 0.55), zB + 0.03];
  const way = {
    // Down, then a little up at the end.
    saber: [[0, -0.3, -0.72], [0, -0.75, -0.62], [0, -0.82, -0.42], [0, -0.55, -0.72]],
    // Hanging low and straight, as an otter's.
    otter: [[0, -0.25, -0.85], [0, -0.55, -0.8], [0, -0.68, -0.72], [0, -0.68, -0.7]],
    // Thin, down between the legs and curving out behind.
    whip: [[0, -0.42, -0.72], [0, -0.92, -0.32], [0, -0.82, -0.52], [0, -0.3, -0.92]],
    // Up and out behind.
    sickle: [[0, 0.62, -0.72], [0, 0.82, -0.5], [0, 0.62, 0.42], [0, 0.1, 0.92]],
    // Up over the back, in a curl.
    curl: [[0, 0.85, -0.4], [0, 0.72, 0.52], [0, -0.12, 0.95], [0.42, -0.72, 0.42]],
    // A tight little corkscrew, on the rump.
    screw: [[0, 0.55, -0.72], [0.22, 0.62, 0.45], [-0.12, -0.42, 0.72], [-0.52, -0.5, -0.5]],
    // A stub.
    bob: [[0, 0.35, -0.9], [0, 0.45, -0.85], [0, 0.45, -0.85], [0, 0.45, -0.85]],
  }[t.type ?? 'saber'];
  const n = TAIL.length;
  const joints = [base];
  const each = len / n;
  way.forEach((w) => joints.push(add(joints.at(-1), unit(w), each)));
  const parts = [];
  for (let i = 0; i < n; i++) {
    const a = lerp(r0, r1, i / n);
    const b = lerp(r0, r1, (i + 1) / n);
    parts.push(new Cone(joints[i], joints[i + 1], a, b, { bone: TAIL[i], tag: 'tail', k: 0.02, reach: 0.03, flat: t.flat ?? 1 }));
  }
  return { parts, joints };
}

// A skin over parts: its points' places, ways out, bone weights, hair and
// fur, and what each part counts as (so a coat can be painted on it later).
function bakeSurface(parts, grid, { mirrored = false } = {}) {
  const sculpture = new Sculpture(parts);
  const { lo, hi } = sculpture.bounds(grid.margin ?? 0.03);
  const xs = mirrored ? mirrorLines(hi[0], grid.x, grid.xNear) : gridLines(lo[0], hi[0], grid.x, grid.xNear);
  const ys = gridLines(lo[1], hi[1], grid.y, grid.yNear);
  const zs = gridLines(lo[2], hi[2], grid.z, grid.zNear);
  const { points, tris } = skinOver(sculpture, xs, ys, zs, { mirrored });
  const count = points.length / 3;
  const normals = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const x = points[i * 3];
    const y = points[i * 3 + 1];
    const z = points[i * 3 + 2];
    const n = normalAt(sculpture, x, y, z);
    // Onto the surface itself: the skin's points only lie near it.
    const d = sculpture.at(x, y, z);
    points[i * 3] = x - n[0] * d;
    points[i * 3 + 1] = y - n[1] * d;
    points[i * 3 + 2] = z - n[2] * d;
    normals[i * 3] = n[0];
    normals[i * 3 + 1] = n[1];
    normals[i * 3 + 2] = n[2];
  }
  return { sculpture, points, normals, tris, count };
}

// The skin of thin plates (an ear), laid straight over each, front and back,
// rather than found by the grid, which is too coarse for anything so thin.
function bakePlates(parts) {
  const sculpture = new Sculpture(parts);
  const points = [];
  const normals = [];
  const tris = [];
  const ROWS = 12;
  const COLS = 8;
  for (const p of parts) {
    const span = p.ra + p.len + p.rb;
    for (const face of [1, -1]) {
      const from = points.length / 3;
      for (let r = 0; r <= ROWS; r++) {
        const s = -p.ra + (r / ROWS) * span;
        const half = s < 0 ? Math.sqrt(Math.max(0, p.ra * p.ra - s * s)) : s > p.len ? Math.sqrt(Math.max(0, p.rb * p.rb - (s - p.len) ** 2)) : lerp(p.ra, p.rb, s / p.len);
        for (let c = 0; c <= COLS; c++) {
          const k = (c / COLS) * 2 - 1;
          const w = half * k;
          const h = face * p.th * Math.sqrt(Math.max(0, 1 - k * k)) + p.cup * w * w - p.curl * s * s;
          const at = add(add(add(p.a, p.u, s), p.v, w), p.n, h);
          points.push(...at);
          normals.push(...normalAt(sculpture, at[0], at[1], at[2], 0.003));
        }
      }
      for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
          const i = from + r * (COLS + 1) + c;
          const q = [i, i + COLS + 1, i + COLS + 2, i + 1];
          // Whichever way round faces out, on this side.
          const P = (j) => [points[q[j] * 3], points[q[j] * 3 + 1], points[q[j] * 3 + 2]];
          const a = P(0);
          const e1 = add(P(1), a, -1);
          const e2 = add(P(3), a, -1);
          const out = crossOf(e1, e2);
          if ((out[0] * p.n[0] + out[1] * p.n[1] + out[2] * p.n[2]) * face > 0) tris.push(q[0], q[1], q[2], q[0], q[2], q[3]);
          else tris.push(q[0], q[2], q[1], q[0], q[3], q[2]);
        }
      }
    }
  }
  return { sculpture, points: new Float32Array(points), normals: new Float32Array(normals), tris, count: points.length / 3 };
}

// How much sky a point on the skin can see, from how far it stands clear of
// everything out along its way out.
function occlusion(fields, x, y, z, n) {
  let shut = 0;
  for (const [h, k] of [
    [0.018, 0.5],
    [0.045, 0.3],
    [0.1, 0.2],
  ]) {
    let d = 1e3;
    const px = x + n[0] * h;
    const py = y + n[1] * h;
    const pz = z + n[2] * h;
    for (const f of fields) d = Math.min(d, f.at(px, py, pz));
    shut += k * clamp((h - d) / h);
  }
  return 1 - shut;
}

// How long the fur is at a point of skin, from what the part counts as and
// which way it faces: a fringe under the belly and behind the legs, trousers,
// a plume under the tail, a ruff round the neck.
function furLength(f, tags, n) {
  let len = 0;
  for (const tag of TAGS) len += (tags[TAG[tag]] ?? 0) * (f[tag] ?? f.body);
  const under = smooth(-0.15, -0.75, n[1]);
  const behind = smooth(-0.05, -0.65, n[2]);
  const t = tags;
  len += (f.belly ?? 0) * under * t[TAG.torso];
  len += (f.feather ?? 0) * behind * (t[TAG.armL] + t[TAG.armU] * 0.8);
  len += (f.pants ?? 0) * smooth(0.25, -0.65, n[2]) * (t[TAG.thigh] + t[TAG.legU] * 0.8);
  len += (f.plume ?? 0) * smooth(0.5, -0.6, n[1]) * t[TAG.tail];
  len += (f.ruff ?? 0) * (t[TAG.neck] + t[TAG.throat] * 0.8 + t[TAG.chest] * 0.7);
  len += (f.mane ?? 0) * t[TAG.chest] * smooth(0.5, -0.1, n[1]);
  return len;
}

// How coarse a skin is: how far apart its grid lines are.
const DETAIL = 1.3;

// A breed's skin, made the first time one is seen.
const made = new Map();
export function bakeBreed(key) {
  let b = made.get(key);
  if (b) return b;
  const s = breedOf(key);
  const a = anatomy(s);
  const k = (s.detail ?? 1) * DETAIL;
  const headY = [a.atlas[1] - 0.2, a.atlas[1] + 0.3];
  const noseZ = a.H(0, 0, a.HL)[2];
  const main = bakeSurface(
    a.parts,
    {
      x: 0.03 * k,
      y: 0.036 * k,
      z: 0.034 * k,
      margin: 0.04,
      xNear: [[-Math.abs(a.pts.fPaw[0]) - 0.05, Math.abs(a.pts.fPaw[0]) + 0.08, 0.017 * k]],
      yNear: [
        [-0.05, a.pts.carpus[1] + 0.02, 0.011 * k],
        [headY[0], headY[1], 0.0155 * k],
      ],
      zNear: [
        [a.pts.fPaw[2] - 0.1, a.pts.fPaw[2] + 0.1, 0.015 * k],
        [a.pts.hock[2] - 0.05, a.pts.hPaw[2] + 0.1, 0.015 * k],
        [a.atlas[2], noseZ + 0.05, 0.0145 * k],
      ],
    },
    { mirrored: true },
  );
  const jaw = bakeSurface(a.jawParts, { x: 0.015 * k, y: 0.015 * k, z: 0.02 * k, margin: 0.03 }, { mirrored: true });
  const nose = bakeSurface(a.noseParts, { x: 0.0065, y: 0.0065, z: 0.0065, margin: 0.012 }, { mirrored: true });
  const ears = a.earParts.map((e) => bakePlates(e.parts));
  const tail = bakeSurface(a.tailParts.parts, { x: 0.012 * k, y: 0.015 * k, z: 0.015 * k, margin: 0.03 }, { mirrored: s.tail.type !== 'curl' && s.tail.type !== 'screw' });
  const skins = [main, jaw, nose, ...ears, tail];

  // All of them as one shape.
  let verts = 0;
  let tris = 0;
  for (const m of skins) {
    verts += m.count;
    tris += m.tris.length;
  }
  const position = new Float32Array(verts * 3);
  const normal = new Float32Array(verts * 3);
  const skinIndex = new Uint16Array(verts * 4);
  const skinWeight = new Float32Array(verts * 4);
  const fur = new Float32Array(verts * 4);
  const ao = new Float32Array(verts);
  const index = new Uint32Array(tris);
  const tagsAt = new Uint8Array(verts * TAGS.length);
  let at = 0;
  let ti = 0;
  const weight = new Float64Array(BONES);
  const tags = new Float64Array(TAGS.length);
  const f = s.fur;
  const eyeAt = a.H(s.head.eyeX, s.head.eyeY, s.head.eyeZ * a.SL);
  for (const m of skins) {
    const list = m.sculpture.parts;
    for (let i = 0; i < m.count; i++) {
      const x = m.points[i * 3];
      const y = m.points[i * 3 + 1];
      const z = m.points[i * 3 + 2];
      const n = [m.normals[i * 3], m.normals[i * 3 + 1], m.normals[i * 3 + 2]];
      weight.fill(0);
      tags.fill(0);
      let hx = 0;
      let hy = 0;
      let hz = 0;
      let tagSum = 0;
      for (const p of list) {
        if (p.side && x * p.side < -0.012) continue;
        const d = Math.max(0, p.at(x, y, z));
        const w = Math.exp(-d / p.reach);
        if (w < 1e-3) continue;
        // (Down an ear, more and more its tip's.)
        const toTip = p.tip > 0 ? smooth(0.3, 0.75, p.along(x, y, z)) : 0;
        weight[p.bone] += w * (1 - toTip);
        if (toTip) weight[p.tip] += w * toTip;
        tags[TAG[p.tag]] += w * w;
        tagSum += w * w;
        const way = p.hair ?? [p.axis[0] * p.flow, p.axis[1] * p.flow, p.axis[2] * p.flow];
        hx += way[0] * w;
        hy += way[1] * w;
        hz += way[2] * w;
      }
      // The four bones that pull hardest.
      const o = at + i;
      let sum = 0;
      for (let j = 0; j < 4; j++) {
        let top = 0;
        for (let bone = 1; bone < BONES; bone++) if (weight[bone] > weight[top]) top = bone;
        skinIndex[o * 4 + j] = top;
        skinWeight[o * 4 + j] = weight[top];
        sum += weight[top];
        weight[top] = 0;
      }
      for (let j = 0; j < 4; j++) skinWeight[o * 4 + j] /= sum || 1;
      if (tagSum) for (let t = 0; t < TAGS.length; t++) tags[t] /= tagSum;
      for (let t = 0; t < TAGS.length; t++) tagsAt[o * TAGS.length + t] = Math.round(tags[t] * 255);
      position[o * 3] = x;
      position[o * 3 + 1] = y;
      position[o * 3 + 2] = z;
      normal[o * 3] = n[0];
      normal[o * 3 + 1] = n[1];
      normal[o * 3 + 2] = n[2];
      // The way the hair lies: along the skin, and drooping under its weight.
      const dot = hx * n[0] + hy * n[1] + hz * n[2];
      let cx = hx - n[0] * dot;
      let cy = hy - n[1] * dot - (f.droop ?? 0.35);
      let cz = hz - n[2] * dot;
      // A coat never lies quite straight; a curly one lies every which way.
      const swirl = 0.7 + (f.curl ?? 0) * 4;
      const sq = f.curl ? 15 : 9;
      cx += (noise(x * sq, y * sq, z * sq) - 0.5) * swirl;
      cy += (noise(x * sq + 9, y * sq, z * sq) - 0.5) * swirl;
      cz += (noise(x * sq, y * sq + 7, z * sq) - 0.5) * swirl;
      const cl = Math.hypot(cx, cy, cz) || 1;
      let len = furLength(f, tags, n);
      // Next to nothing round its eyes; and bushy brows over them, on some.
      if (tags[TAG.skull] + tags[TAG.cheek] + tags[TAG.muzzle] > 0.3) {
        const e = Math.hypot(Math.abs(x) - eyeAt[0], y - eyeAt[1], z - eyeAt[2]) / s.head.eyeR;
        len *= smooth(1.15, 2.2, e);
        if (f.brows) len += f.brows * smooth(2.6, 1.4, Math.hypot(Math.abs(x) - eyeAt[0], y - eyeAt[1] - s.head.eyeR * 1.3, z - eyeAt[2]) / s.head.eyeR);
      }
      // Tufts: a coat is never all one length.
      const q = 11;
      len *= 0.8 + 0.4 * noise(x * q, y * q, z * q);
      const lie = f.lie ?? 1.1;
      fur[o * 4] = (cx / cl) * len * lie;
      fur[o * 4 + 1] = (cy / cl) * len * lie;
      fur[o * 4 + 2] = (cz / cl) * len * lie;
      fur[o * 4 + 3] = len;
      ao[o] = occlusion(m === main ? [main.sculpture] : [main.sculpture, m.sculpture], x, y, z, n);
    }
    for (const t of m.tris) index[ti++] = t + at;
    at += m.count;
  }

  // The bones where they start, and how to undo that.
  const place = new Array(BONES);
  const P = a.pts;
  const j = a.tailParts.joints;
  place[PELVIS] = [0, a.yR + a.rR * 0.1, a.zR + 0.02];
  place[SPINE] = [0, a.yL, a.zL];
  place[CHEST] = [0, a.yC, a.zC - 0.07];
  place[NECK1] = a.neck0;
  place[NECK2] = a.neck1;
  place[HEAD] = a.atlas;
  place[JAW] = a.hinge;
  a.earParts.forEach((e, i) => {
    place[EAR[i]] = e.base;
    place[EAR[i] + 1] = e.bend;
  });
  TAIL.forEach((t, i) => (place[t] = j[i]));
  for (const leg of LEGS) {
    const S = (p) => [leg.side * p[0], p[1], p[2]];
    const chain = leg.front ? [P.shoulderTop, P.shoulder, P.elb, P.carpus, P.fPaw] : [P.hip, P.stifle, P.hock, P.hPaw];
    leg.bones.forEach((bone, i) => (place[bone] = S(chain[i])));
  }
  const inverses = place.map((p) => new THREE.Matrix4().makeTranslation(-p[0], -p[1], -p[2]));

  const box = new THREE.Box3();
  box.setFromArray(position);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(position, 3));
  geometry.setAttribute('normal', new THREE.BufferAttribute(normal, 3));
  geometry.setAttribute('skinIndex', new THREE.BufferAttribute(skinIndex, 4));
  geometry.setAttribute('skinWeight', new THREE.BufferAttribute(skinWeight, 4));
  geometry.setAttribute('aFur', new THREE.BufferAttribute(fur, 4));
  geometry.setAttribute('aAO', new THREE.BufferAttribute(ao, 1));
  geometry.setIndex(new THREE.BufferAttribute(index, 1));
  geometry.boundingBox = box;
  geometry.boundingSphere = box.getBoundingSphere(new THREE.Sphere());
  b = { key, s, a, geometry, position, normal, tagsAt, place, inverses, box, verts, coats: new Map() };
  made.set(key, b);
  return b;
}

// What a point of a dog is, for a coat to be painted by: where it is, in its
// own body's terms and its head's, and how much it is each part.
function pointInfo(b) {
  const { a } = b;
  const s0 = b.s;
  const h = s0.head;
  const cosP = Math.cos(b.s.head.pitch);
  const sinP = Math.sin(b.s.head.pitch);
  const v = { tag: {} };
  return (o) => {
    const p = b.position;
    const x = p[o * 3];
    const y = p[o * 3 + 1];
    const z = p[o * 3 + 2];
    v.x = x;
    v.y = y;
    v.z = z;
    v.nx = b.normal[o * 3];
    v.ny = b.normal[o * 3 + 1];
    v.nz = b.normal[o * 3 + 2];
    for (let t = 0; t < TAGS.length; t++) v.tag[TAGS[t]] = b.tagsAt[o * TAGS.length + t] / 255;
    // Along its body from rump (0) to chest (1), and how far up its side,
    // from under its belly (-1) to the top of its back (1).
    v.along = clamp((z - a.zB) / (a.zF - a.zB));
    const k = clamp((z - a.zR) / (a.zC - a.zR));
    const cy = lerp(a.yR, a.yC, k);
    const cr = k < 0.4 ? lerp(a.rR, a.rL, k / 0.4) : lerp(a.rL, a.rC, (k - 0.4) / 0.6);
    v.up = (y - cy) / cr;
    // In the head's own frame, in head lengths: fx out, fy up, fz from the back
    // of the skull (0) to the tip of the nose (1).
    const dy = y - a.atlas[1];
    const dz = z - a.atlas[2];
    v.fx = x / a.HL;
    v.fy = (dy * cosP + dz * sinP) / a.HL;
    v.fz = (-dy * sinP + dz * cosP) / a.HL;
    v.muzzleZ = a.SL / a.HL;
    v.snoutT = (v.fz - v.muzzleZ) / (1 - v.muzzleZ);
    v.head = v.tag.skull + v.tag.cheek + v.tag.muzzle + v.tag.lip + v.tag.chin + v.tag.nose;
    v.mouthY = (a.my - a.mh * 0.5) / a.HL;
    v.muzzleTop = (a.my + a.mh * 0.55) / a.HL;
    // How far from its eye, and from the spot over it (in head lengths).
    const ex = Math.abs(v.fx) - h.eyeX / a.HL;
    const ey = v.fy - h.eyeY / a.HL;
    const ez = v.fz - (h.eyeZ * a.SL) / a.HL;
    v.eyeD = Math.hypot(ex, ey, ez);
    v.browD = Math.hypot(ex + 0.012, ey - (h.eyeR * 1.7) / a.HL, ez + 0.012);
    // Along its neck, from its body (0) to its head (1), and how far round it
    // from its throat (-1) to its crest (1).
    const nx = a.atlas[1] - a.neck0[1];
    const nz = a.atlas[2] - a.neck0[2];
    const nl = Math.hypot(nx, nz) || 1;
    const ny0 = y - a.neck0[1];
    const nz0 = z - a.neck0[2];
    v.neckT = clamp((ny0 * nx + nz0 * nz) / (nl * nl));
    v.nape = clamp(((-nz * ny0 + nx * nz0) / nl) * -1 / (s0.neck.r0 * 0.9), -1, 1);
    // Up its chest: 0 at the middle of its chest, up to its neck.
    v.chestUp = (y - a.yC) / a.rC;
    // How far along its tail, and on an ear the side that faces forward.
    const tb = a.tailParts.joints;
    const tailLen = s0.tail.len || 1;
    v.tailT = clamp(Math.hypot(x - tb[0][0], y - tb[0][1], z - tb[0][2]) / tailLen);
    v.earIn = v.nz;
    v.noise = (q, s = 0) => noise(x * q + s, y * q - s, z * q + s * 0.5);
    return v;
  };
}

// A coat on a breed: the same skin, with colours of its own.
export function coatOn(key, coatKey) {
  const b = bakeBreed(key);
  const name = breedOf(key).coats[coatKey] ? coatKey : Object.keys(breedOf(key).coats)[0];
  let c = b.coats.get(name);
  if (c) return c;
  const coat = breedCoat(key, name);
  const weights = new Float32Array(b.verts * 4);
  const skin = new Float32Array(b.verts * 4);
  const info = pointInfo(b);
  const w = [0, 0, 0, 0];
  const nose = new THREE.Color(coat.nose ?? '#17110f');
  const lip = new THREE.Color(coat.lip ?? coat.nose ?? '#231b1a');
  const pad = new THREE.Color(coat.pad ?? coat.nose ?? '#2a2120');
  const palate = new THREE.Color('#7e3a42');
  const rim = new THREE.Color(coat.rim ?? coat.nose ?? '#1c1412');
  const a = b.a;
  const h = b.s.head;
  // The colour of the fur just over its eye, for its eyelid.
  let lidNear = Infinity;
  const lid = [1, 0, 0, 0];
  for (let o = 0; o < b.verts; o++) {
    const v = info(o);
    w[0] = 1;
    w[1] = w[2] = w[3] = 0;
    const set = (i, k) => {
      const m = clamp(k);
      for (let n = 0; n < 4; n++) w[n] += ((n === i ? 1 : 0) - w[n]) * m;
    };
    coat.paint(v, set, v);
    weights.set(w, o * 4);
    if (v.head > 0.5 && v.browD < lidNear) {
      lidNear = v.browD;
      lid.splice(0, 4, ...w);
    }
    // What is leather, not fur: its nose, the edges of its lips, its eyelids,
    // the pads of its paws and the roof of its mouth.
    let color = lip;
    let leather = 0;
    if (v.tag.nose > 0.5) {
      color = nose;
      leather = 1;
    } else if (v.tag.paw > 0.5 && v.ny < -0.45) {
      color = pad;
      leather = smooth(-0.45, -0.75, v.ny);
    } else if (v.tag.lip + v.tag.muzzle > 0.4) {
      // Under the lip, the inside of its mouth; along its edge, dark.
      const under = smooth(-0.15, -0.8, v.ny);
      const y = v.fy - (a.my / a.HL - (a.mh * (0.72 + h.flews * 0.55)) / a.HL);
      leather = smooth(0.03, 0.006, y) * smooth(v.muzzleZ * 0.7, v.muzzleZ * 0.86, v.fz);
      color = lip;
      if (under > 0.75 && y < -0.004) {
        color = Math.abs(v.x) < a.mw * 0.5 ? palate : lip;
        leather = 1;
      }
    } else if (v.tag.chin > 0.5) {
      // Its gums and tongue-bed, inside the lips; dark along the lip itself.
      const top = smooth(0.25, 0.8, v.ny);
      color = top > 0.5 && v.snoutT < 0.72 && Math.abs(v.x) < a.mw * 0.42 ? palate : lip;
      leather = v.snoutT < 0.72 ? top : top * 0.8;
    }
    // A dark line round each eye.
    const eyeDist = Math.hypot(Math.abs(v.x) - h.eyeX, v.fy * a.HL - h.eyeY, v.fz * a.HL - h.eyeZ * a.SL) / h.eyeR;
    if (v.head > 0.4 && eyeDist < 1.5) {
      const e = smooth(1.5, 1.2, eyeDist);
      if (e > leather) {
        color = rim;
        leather = e;
      }
    }
    skin[o * 4] = color.r;
    skin[o * 4 + 1] = color.g;
    skin[o * 4 + 2] = color.b;
    skin[o * 4 + 3] = leather;
  }
  const geometry = b.geometry.clone();
  // (The shape's own arrays, shared: only the colours are this coat's own.)
  for (const n of Object.keys(b.geometry.attributes)) geometry.setAttribute(n, b.geometry.attributes[n]);
  geometry.setIndex(b.geometry.index);
  geometry.setAttribute('aCoat', new THREE.BufferAttribute(weights, 4));
  geometry.setAttribute('aSkin', new THREE.BufferAttribute(skin, 4));
  const furry = shellGeometry(geometry);
  const { skinMaterial, furMaterial } = furMaterials(coat, b.s.fur);
  const mixed = new THREE.Color(0, 0, 0);
  lid.forEach((k, i) => mixed.add(new THREE.Color(coat.palette[i] ?? coat.palette[0]).multiplyScalar(k)));
  c = { name, coat, geometry, furry, skinMaterial, furMaterial, eyelid: `#${mixed.getHexString()}` };
  b.coats.set(name, c);
  return c;
}

// ------------------------------------------------ eyes, tongue, collar

// A dog's eye, seen from the front: nearly all iris, deep brown (or blue),
// with a big black pupil.
const irises = new Map();
function irisTexture(hex) {
  let t = irises.get(hex);
  if (t) return t;
  const S = 96;
  const data = new Uint8Array(S * S * 4);
  const c = new THREE.Color(hex);
  const base = c.clone().convertLinearToSRGB();
  const edge = base.clone().multiplyScalar(0.45);
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const dx = (x + 0.5) / S - 0.5;
      const dy = (y + 0.5) / S - 0.5;
      const r = Math.hypot(dx, dy) * 2;
      const a = Math.atan2(dy, dx);
      const streak = 0.82 + 0.3 * (Math.sin(a * 23) * 0.5 + Math.sin(a * 47 + 1) * 0.5) * 0.5;
      const k = smooth(0.42, 0.9, r);
      let R = lerp(base.r * 1.25, edge.r, k) * streak;
      let G = lerp(base.g * 1.25, edge.g, k) * streak;
      let B = lerp(base.b * 1.25, edge.b, k) * streak;
      // Black at its pupil, and dark at its rim.
      const pupil = smooth(0.46, 0.4, r);
      R *= 1 - pupil;
      G *= 1 - pupil;
      B *= 1 - pupil;
      const white = smooth(0.94, 1.02, r);
      R = lerp(R, 0.3, white);
      G = lerp(G, 0.22, white);
      B = lerp(B, 0.18, white);
      const i = (y * S + x) * 4;
      data[i] = Math.round(clamp(R) * 255);
      data[i + 1] = Math.round(clamp(G) * 255);
      data[i + 2] = Math.round(clamp(B) * 255);
      data[i + 3] = 255;
    }
  }
  t = new THREE.DataTexture(data, S, S, THREE.RGBAFormat);
  t.colorSpace = THREE.SRGBColorSpace;
  t.magFilter = THREE.LinearFilter;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.generateMipmaps = true;
  t.needsUpdate = true;
  irises.set(hex, t);
  return t;
}

// A ball with its picture looking out along +z.
const eyeBall = () =>
  geo('dog-eye', () => {
    const g = new THREE.SphereGeometry(1, 24, 18);
    const p = g.attributes.position;
    const uv = g.attributes.uv;
    for (let i = 0; i < p.count; i++) uv.setXY(i, p.getX(i) * 0.5 + 0.5, p.getY(i) * 0.5 + 0.5);
    return g;
  });

const eyeMaterials = new Map();
function eyeMaterial(hex) {
  let m = eyeMaterials.get(hex);
  if (!m) {
    m = toyMaterial({ map: irisTexture(hex), roughness: 0.12, clearcoat: 1, clearcoatRoughness: 0.03, envMapIntensity: 1.6 });
    eyeMaterials.set(hex, m);
  }
  return m;
}

// Its eyes, in the head's frame, each with a furry lid that comes down over
// it (to blink, and to sleep), both turning with lid().
function makeEyes(frame, s, coat, lidColor) {
  const h = s.head;
  const eyes = new THREE.Group();
  const lids = [];
  const SL = h.len * (1 - h.muzzle);
  const color = coat.eye ?? h.eyeColor ?? '#3d2413';
  const rim = coat.rim ?? coat.nose ?? '#1c1412';
  for (const side of [-1, 1]) {
    const e = new THREE.Group();
    e.position.set(side * h.eyeX, h.eyeY, h.eyeZ * SL);
    e.rotation.set(-(h.eyeUp ?? 0.05), side * (h.eyeOut ?? 0.42), 0, 'YXZ');
    const r = h.eyeR;
    e.add(mesh(eyeBall(), eyeMaterial(color), 0, 0, 0, r));
    // A wet glint.
    e.add(mesh(sphere(1, 6, 4), GLINT, side * r * -0.1 + r * 0.25, r * 0.42, r * 0.9, r * 0.13));
    // Almond-shaped between two lids: the upper in the colour of its fur with a
    // dark edge, which comes down over the eye; the lower dark, which stays.
    const lid = new THREE.Group();
    lid.add(mesh(lidCap(), matt(lidColor), 0, 0, 0, r * 1.05));
    lid.add(mesh(lidEdge(), matt(rim), 0, 0, 0, r * 1.07));
    e.add(lid);
    lids.push(lid);
    const low = mesh(lidCap(), matt(rim), 0, 0, 0, r * 1.05);
    low.rotation.x = Math.PI - (h.eyeLow ?? 0.5);
    e.add(low);
    eyes.add(e);
  }
  frame.add(eyes);
  return { eyes, lids };
}

// The part of a ball over its top, for an eyelid.
const lidCap = () => geo('dog-lid', () => new THREE.SphereGeometry(1, 18, 8, 0, Math.PI * 2, 0, Math.PI * 0.5));
const lidEdge = () => geo('dog-lid-edge', () => new THREE.SphereGeometry(1, 18, 2, 0, Math.PI * 2, Math.PI * 0.4, Math.PI * 0.1));
const matts = new Map();
const matt = (hex) => {
  if (!matts.has(hex)) matts.set(hex, toyMaterial({ color: hex, roughness: 0.75, envMapIntensity: 0.3 }));
  return matts.get(hex);
};
const GLINT = new THREE.MeshBasicMaterial({ color: '#ffffff' });

// Its tongue, wet and pink, flat in its lower jaw: long enough to loll out.
let tongueMat = null;
function makeTongue(s) {
  const h = s.head;
  const mh = h.muzzleH;
  const w = h.muzzleW * 0.56;
  const g = new THREE.Group();
  tongueMat ??= toyMaterial({ color: '#e4707f', roughness: 0.32, clearcoat: 0.6, clearcoatRoughness: 0.2, envMapIntensity: 0.9 });
  const mat = tongueMat;
  const L = h.len * h.muzzle * 0.92;
  g.add(mesh(sphere(1, 16, 10), mat, 0, 0, L * 0.5, w, mh * 0.13, L * 0.62));
  const tip = new THREE.Group();
  tip.position.set(0, -mh * 0.04, L * 0.95);
  tip.rotation.x = 1.05;
  tip.add(mesh(sphere(1, 14, 10), mat, 0, 0, L * 0.3, w * 0.96, mh * 0.12, L * 0.42));
  g.add(tip);
  return g;
}

// A collar, round the neck where the fur lets it show: a band in its own
// material with a golden tag.
function makeCollar(b, parent, color) {
  const { a, s } = b;
  // (Its own material, for its owner's colour.)
  const band = toon(color).clone();
  const c = mix(a.neck1, a.atlas, s.collarAt ?? 0.15);
  const way = unit([a.atlas[0] - a.neck0[0], a.atlas[1] - a.neck0[1], a.atlas[2] - a.neck0[2]]);
  const sculpt = new Sculpture(a.parts);
  // How far out the neck is in each direction round it.
  const right = [1, 0, 0];
  const front = crossOf(right, way);
  const reach = (dir) => {
    let lo = 0.01;
    let hi = 0.4;
    for (let i = 0; i < 18; i++) {
      const m = (lo + hi) / 2;
      if (sculpt.at(c[0] + dir[0] * m, c[1] + dir[1] * m, c[2] + dir[2] * m) < 0) lo = m;
      else hi = m;
    }
    return lo;
  };
  const rx = reach(right);
  const rUp = reach(front);
  const rDown = reach([-front[0], -front[1], -front[2]]);
  const fur = (s.fur.ruff ?? 0) * 0.5 + s.fur.neck * 0.45;
  const g = new THREE.Group();
  g.position.set(c[0], c[1] + (rUp - rDown) * front[1] * 0.5, c[2] + (rUp - rDown) * front[2] * 0.5);
  // Its y along the neck.
  g.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(...way));
  const rt = (rUp + rDown) / 2 + fur;
  const rw = rx + fur;
  const wide = 0.021 * (s.collarWide ?? 1);
  g.add(mesh(collarRing(wide), band, 0, 0, 0, rw, 1, rt));
  // A round golden tag, hanging at the front of its throat.
  const tag = mesh(tagDisc(), toon('#ffcf3f', { emissive: 0.15 }), 0, -wide * 2.4, rt * 1.05, rt * 0.2);
  tag.rotation.x = Math.PI / 2 - 0.25;
  g.add(tag);
  // Into the bone's own frame.
  g.position.x -= b.place[NECK2][0];
  g.position.y -= b.place[NECK2][1];
  g.position.z -= b.place[NECK2][2];
  parent.add(g);
  return { band };
}

// A strap round a neck of radius 1, wide either way along it.
const collarRing = (w) => lathe([[0.97, -w], [1.04, -w * 0.9], [1.075, -w * 0.5], [1.08, 0], [1.075, w * 0.5], [1.04, w * 0.9], [0.97, w], [0.97, -w]], 28);
const tagDisc = () => geo('dog-tag', () => new THREE.CylinderGeometry(1, 1, 0.22, 16));

// ------------------------------------------------ the rig

const IDENTITY = new THREE.Matrix4();
const wrap = (a) => a - Math.PI * 2 * Math.floor((a + Math.PI) / (Math.PI * 2));
const angleOf = (dz, dy) => Math.atan2(dz, dy);
// Turning about x: +y goes towards +z.
const turnZ = (z, y, a) => y * Math.sin(a) + z * Math.cos(a);
const turnY = (z, y, a) => y * Math.cos(a) - z * Math.sin(a);

// Two bones from (hz, hy) reaching for (tz, ty): the way each one points, its
// knee bent the way bend says (1: back, -1: forward).
function reachFor(hz, hy, tz, ty, l1, l2, bend) {
  const dz = tz - hz;
  const dy = ty - hy;
  const d = clamp(Math.hypot(dz, dy), Math.abs(l1 - l2) + 1e-3, l1 + l2 - 1e-3);
  const base = angleOf(dz, dy);
  const A = Math.acos(clamp((l1 * l1 + d * d - l2 * l2) / (2 * l1 * d), -1, 1));
  const a1 = base + bend * A;
  const jz = hz + Math.sin(a1) * l1;
  const jy = hy + Math.cos(a1) * l1;
  const a2 = angleOf(hz + (dz / (Math.hypot(dz, dy) || 1)) * d - jz, hy + (dy / (Math.hypot(dz, dy) || 1)) * d - jy);
  return [a1, a2];
}

// How far its middle is out of each pose, for easing from one to the next.
const POSE_KEYS = ['py', 'pz', 'pp', 'sp', 'cp', 'nk', 'hx', 'hy', 'hz', 'fz', 'fy', 'ft', 'bz', 'by', 'bt', 'splay', 'tail', 'ear', 'mouth', 'tongue', 'open', 'gait'];

export class DogRig {
  // key: the breed; coat: which coat; size: its height at the shoulders;
  // collar: the colour of its collar.
  constructor(key, coatKey, size, collar = '#ff6f6f') {
    const b = bakeBreed(key);
    const c = coatOn(key, coatKey);
    this.b = b;
    this.coat = c;
    this.size = size;
    const s = b.s;
    this.s = s;
    const group = new THREE.Group();
    const body = new THREE.Group();
    const roll = new THREE.Group();
    const root = new THREE.Group();
    group.add(body);
    body.add(roll);
    // It rolls over about the middle of its chest.
    const rollY = b.a.rC * 1.02 * size;
    roll.position.y = rollY;
    root.position.y = -rollY;
    root.scale.setScalar(size);
    roll.add(root);
    Object.assign(this, { group, body, roll, root });
    const bones = [];
    for (let i = 0; i < BONES; i++) {
      const bone = new THREE.Bone();
      const p = b.place[i];
      const q = PARENT[i] < 0 ? [0, 0, 0] : b.place[PARENT[i]];
      bone.position.set(p[0] - q[0], p[1] - q[1], p[2] - q[2]);
      (PARENT[i] < 0 ? root : bones[PARENT[i]]).add(bone);
      bones.push(bone);
    }
    this.bones = bones;
    this.legBones = LEGS.map((leg) => leg.bones);
    this.skeleton = new THREE.Skeleton(bones, b.inverses);
    const big = new THREE.Box3().copy(b.box).expandByScalar(0.6);
    const ball = big.getBoundingSphere(new THREE.Sphere());
    const skinOf = (geometry, material) => {
      const m = new THREE.SkinnedMesh(geometry, material);
      m.bind(this.skeleton, IDENTITY);
      m.boundingBox = b.box;
      m.boundingSphere = ball;
      // Never measured for a tap (see pick): nor is anything else about a pet.
      m.raycast = () => {};
      root.add(m);
      return m;
    };
    this.skin = skinOf(c.geometry, c.skinMaterial);
    this.fur = skinOf(c.furry, c.furMaterial);
    this.fur.userData.noShadow = true;
    const self = this;
    this.fur.onBeforeRender = function (renderer, scene, camera, geometry) {
      geometry.instanceCount = shellsFor(renderer, camera, this, self.size);
    };

    // The head's own frame, for what is fixed to it.
    const frame = new THREE.Group();
    frame.rotation.x = s.head.pitch;
    bones[HEAD].add(frame);
    const { eyes, lids } = makeEyes(frame, s, c.coat, c.eyelid);
    this.eyes = eyes;
    this.lids = lids;
    const jawFrame = new THREE.Group();
    jawFrame.rotation.x = s.head.pitch;
    bones[JAW].add(jawFrame);
    this.tongue = makeTongue(s);
    this.tongue.position.set(0, b.a.mh * 0.28, -0.002);
    this.tongue.rotation.x = -0.04;
    this.tongue.visible = false;
    jawFrame.add(this.tongue);
    const made = makeCollar(b, bones[NECK2], collar);
    this.band = made.band;

    // The lengths of everything, and which way each bone points at rest.
    const P = b.a.pts;
    const dist = (u, v) => Math.hypot(u[1] - v[1], u[2] - v[2]);
    const ang = (u, v) => angleOf(v[2] - u[2], v[1] - u[1]);
    this.rest = {
      pelvis: b.place[PELVIS],
      spine: [b.place[SPINE][1] - b.place[PELVIS][1], b.place[SPINE][2] - b.place[PELVIS][2]],
      chest: [b.place[CHEST][1] - b.place[SPINE][1], b.place[CHEST][2] - b.place[SPINE][2]],
      scapTop: [P.shoulderTop[1] - b.place[CHEST][1], P.shoulderTop[2] - b.place[CHEST][2]],
      scap: [P.shoulder[1] - P.shoulderTop[1], P.shoulder[2] - P.shoulderTop[2]],
      hip: [P.hip[1] - b.place[PELVIS][1], P.hip[2] - b.place[PELVIS][2]],
      lArm: dist(P.shoulder, P.elb),
      lFore: dist(P.elb, P.carpus),
      lPast: dist(P.carpus, P.fPaw),
      aArm: ang(P.shoulder, P.elb),
      aFore: ang(P.elb, P.carpus),
      aPast: ang(P.carpus, P.fPaw),
      lThigh: dist(P.hip, P.stifle),
      lShin: dist(P.stifle, P.hock),
      lMeta: dist(P.hock, P.hPaw),
      aThigh: ang(P.hip, P.stifle),
      aShin: ang(P.stifle, P.hock),
      aMeta: ang(P.hock, P.hPaw),
      fPaw: P.fPaw,
      hPaw: P.hPaw,
      // How far the foot is ahead of the top of the shoulder blade, at rest.
      swing: Math.atan2(P.carpus[2] - P.shoulderTop[2], P.shoulderTop[1] - P.carpus[1]),
      carpus: [P.carpus[1] - P.fPaw[1], P.carpus[2] - P.fPaw[2]],
      hock: [P.hock[1] - P.hPaw[1], P.hock[2] - P.hPaw[2]],
    };
    this.measure();
    this.time = Math.random() * 10;
    this.phase = 0;
    this.blinkAt = 2 + Math.random() * 3;
    this.pant = 0;
    this.seed = Math.random() * 100;
    this.spin = 0;
    this.rollOver = 0;
    this.cur = Object.fromEntries(POSE_KEYS.map((k) => [k, 0]));
    Object.assign(this.cur, this.stand());
    this.since = 0;
    this.pose = null;
    this.solve(this.cur, null);
    for (const l of this.lids) l.rotation.x = -(s.head.eyeHigh ?? 0.62);
    this.height = (b.box.max.y + (s.fur.skull ?? 0)) * size;
    this.shadowR = Math.max(0.2, ((b.a.zF - b.a.zB) / 2 + 0.1) * size);
  }

  // How the body goes down to sit and to lie: where the rump and the chest
  // come to, from which the pose of the pelvis follows.
  measure() {
    const { a } = this.b;
    const r = this.rest;
    const zP = r.pelvis[2];
    const yP = r.pelvis[1];
    const dz = a.zC - 0.07 - zP;
    const dy = a.yC - yP;
    const d = Math.hypot(dz, dy);
    const lean = Math.atan2(dy, dz);
    // From where the pelvis should be and where the chest should be: how
    // to turn and place it. The pelvis goes as it must; its height is y.
    // (Never so upright that its front legs could not reach the ground, unless it means to.)
    this.torso = (y, chestY, chestZ, most = 1) => {
      const up = Math.min(most, Math.asin(clamp((chestY - y) / d, -0.98, 0.98)));
      const z = chestZ - Math.cos(up) * d;
      return { py: y - yP, pz: z - zP, pp: -(up - lean) };
    };
    this.measures = { d, lean, zP, yP };
  }

  // Sitting: its rump on the ground, leaning back as far as its front legs can
  // still reach the ground from its shoulders, straight down.
  sitting(most) {
    const { a } = this.b;
    const r = this.rest;
    const { d } = this.measures;
    const y = a.rR * 0.96;
    let w = null;
    let top = null;
    for (let up = most; up > 0.2; up -= 0.03) {
      w = this.torso(y, y + Math.sin(up) * d, a.zC - 0.1);
      top = this.shoulderAt(w);
      if (top[0] - (r.fPaw[1] + r.carpus[0]) < (r.lArm + r.lFore) * 0.99) break;
    }
    w.fz = top[1] - 0.015 - r.carpus[1] - r.fPaw[2];
    return w;
  }

  // Where its shoulder has got to in a pose: [up, along].
  shoulderAt(w) {
    const r = this.rest;
    const yS = r.pelvis[1] + w.py + turnY(r.spine[1], r.spine[0], w.pp);
    const zS = r.pelvis[2] + w.pz + turnZ(r.spine[1], r.spine[0], w.pp);
    const yC = yS + turnY(r.chest[1], r.chest[0], w.pp);
    const zC = zS + turnZ(r.chest[1], r.chest[0], w.pp);
    const yT = yC + turnY(r.scapTop[1], r.scapTop[0], w.pp);
    const zT = zC + turnZ(r.scapTop[1], r.scapTop[0], w.pp);
    return [yT + turnY(r.scap[1], r.scap[0], w.pp), zT + turnZ(r.scap[1], r.scap[0], w.pp)];
  }

  // Its back legs folded under it, sitting or lying (w: the pose so far): the
  // hock down at the ground under the hip, as far from it as the bones can
  // come, the rest of the leg flat on the ground in front of it.
  fold(w) {
    const r = this.rest;
    const yP = r.pelvis[1] + w.py;
    const zP = r.pelvis[2] + w.pz;
    const hipY = yP + turnY(r.hip[1], r.hip[0], w.pp);
    const hipZ = zP + turnZ(r.hip[1], r.hip[0], w.pp);
    const flat = 0.2;
    const hockY = r.hPaw[1] + Math.sin(flat) * r.lMeta;
    const near = Math.abs(r.lThigh - r.lShin) * 1.15 + 0.02;
    const drop = Math.abs(hipY - hockY);
    const hockZ = hipZ - (drop < near ? Math.sqrt(near * near - drop * drop) : 0) - 0.02;
    w.bz = hockZ + Math.cos(flat) * r.lMeta - r.hPaw[2];
    w.bt = wrap(angleOf(-Math.cos(flat), Math.sin(flat)) - angleOf(r.hock[1], r.hock[0]));
    return w;
  }

  stand() {
    return { py: 0, pz: 0, pp: 0, sp: 0, cp: 0, nk: 0, hx: 0, hy: 0, hz: 0, fz: 0, fy: 0, ft: 0, bz: 0, by: 0, bt: 0, splay: 0, tail: 0.5, ear: 0, mouth: 0, tongue: 0, open: 1, gait: 0 };
  }

  // Where its joints go for each pose: its pelvis (py, pz, pp), its back
  // bending (sp, cp), its neck and head (nk, hx, hy, hz), its front and back
  // paws (fz, fy, ft: forward, up, and how the pastern tips; bz, by, bt), its
  // tail up, ears, mouth, tongue and eyes.
  poseFor(pose) {
    const t = this.time;
    const { a } = this.b;
    const w = this.stand();
    const rump = a.rR;
    this.wag = { rate: 3, size: 0.22 };
    this.bob = 0;
    this.spin = 0;
    this.rollOver = 0;
    this.moving = null;
    const glance = Math.sin(t * 0.37 + this.seed) * 0.35 + Math.sin(t * 0.13) * 0.25;
    switch (pose) {
      case 'walk':
      case 'run':
        this.moving = pose;
        w.gait = 1;
        w.tail = 0.6;
        this.wag = { rate: 7, size: 0.28 };
        w.hx = pose === 'run' ? -0.06 : 0.02;
        w.mouth = this.pant > 0.3 ? 0.55 : 0;
        w.tongue = this.pant > 0.3 ? 1 : 0;
        break;
      case 'jump':
        Object.assign(w, { pp: -0.16, fz: 0.16, fy: 0.26, ft: 1.2, bz: -0.08, by: 0.1, bt: 0.7, hx: -0.15, tail: 0.35 });
        break;
      case 'swim':
        this.moving = 'swim';
        Object.assign(w, { pp: -0.12, gait: 1, hx: -0.28, tail: 0.1, mouth: 0.25, tongue: 0.6 });
        break;
      case 'sit': {
        Object.assign(w, this.sitting(0.95));
        this.fold(w);
        w.hx = 0.05;
        w.hy = glance;
        w.tail = -0.2;
        w.mouth = this.pant > 0.2 ? 0.5 : 0;
        w.tongue = this.pant > 0.2 ? 1 : 0;
        this.wag = { rate: 4, size: 0.24 };
        break;
      }
      case 'beg': {
        Object.assign(w, this.torso(rump * 0.96, a.yC + a.rC * 0.72, a.zC - 0.25, 1.35));
        this.fold(w);
        w.fz = -0.22;
        w.fy = a.yC * 0.62 + Math.sin(t * 9) * 0.018;
        w.ft = 1.5;
        w.hx = -0.08;
        w.hz = Math.sin(t * 3) * 0.14;
        w.tail = -0.1;
        w.mouth = 0.45;
        w.tongue = 1;
        this.wag = { rate: 14, size: 0.42 };
        break;
      }
      case 'lie': {
        Object.assign(w, this.torso(rump * 0.92, a.rC * 0.96, a.zC - 0.07));
        w.fz = 0.3 * this.legK();
        w.ft = -1.42;
        this.fold(w);
        w.splay = 0.16;
        w.hx = 0.1;
        w.hy = glance * 0.6;
        w.tail = -0.25;
        this.wag = { rate: 2, size: 0.1 };
        break;
      }
      case 'sleep':
      case 'nap': {
        Object.assign(w, this.torso(rump * 0.92, a.rC * 0.92, a.zC - 0.07));
        w.fz = 0.3 * this.legK();
        w.ft = -1.42;
        this.fold(w);
        w.splay = 0.16;
        w.nk = 0.95;
        w.hx = 0.15;
        w.hz = 0.18;
        w.tail = -0.3;
        w.ear = -0.25;
        w.open = 0;
        this.wag = { rate: 0.6, size: 0.03 };
        this.bob = Math.sin(t * 2) * 0.006;
        break;
      }
      case 'happy': {
        // A play bow, chest down and tail up, then a bounce or two.
        const beat = (t * 0.5 + this.seed) % 1;
        if (beat < 0.55) {
          Object.assign(w, this.torso(this.measures.yP, a.yC * 0.62, a.zC - 0.07));
          w.fz = 0.14;
          w.ft = -0.7;
          w.hx = -0.28;
          this.bob = Math.abs(Math.sin(t * 7)) * 0.012;
        } else {
          this.bob = Math.abs(Math.sin(t * 10)) * 0.1;
          w.fy = Math.max(0, Math.sin(t * 10)) * 0.07;
          w.ft = 0.5;
          w.hz = Math.sin(t * 5) * 0.16;
          w.hx = -0.1;
        }
        w.tail = 0.95;
        w.ear = 0.35;
        w.mouth = 0.65;
        w.tongue = 1;
        this.wag = { rate: 17, size: 0.5 };
        break;
      }
      case 'eat':
        Object.assign(w, { nk: 1.05, hx: 0.55 + Math.max(0, Math.sin(t * 10)) * 0.08, fz: 0.02, tail: 0.75, mouth: Math.max(0, Math.sin(t * 10)) * 0.32 });
        this.wag = { rate: 12, size: 0.38 };
        break;
      case 'spin': {
        const k = this.since / 1.4;
        const e = clamp(k);
        this.spin = e * e * (3 - 2 * e) * Math.PI * 4;
        this.moving = 'walk';
        w.gait = 1;
        w.tail = 0.9;
        w.mouth = 0.5;
        w.tongue = 1;
        this.wag = { rate: 16, size: 0.45 };
        break;
      }
      case 'roll': {
        // Down, over onto its back, legs up, and round onto its feet again.
        const e = clamp((this.since - 0.25) / 1.4);
        const k = e * e * (3 - 2 * e);
        Object.assign(w, this.torso(a.rR * 0.98, a.rC * 0.98, a.zC - 0.07));
        const up = Math.sin(k * Math.PI);
        this.rollOver = k * Math.PI * 2;
        w.fz = 0.14 * up;
        w.fy = 0.14 * up;
        w.ft = 1.1 * up;
        this.fold(w);
        w.by = 0.12 * up;
        w.mouth = 0.6 * up;
        w.tongue = up;
        break;
      }
      default:
        // Standing: looking about.
        w.hy = glance;
        w.mouth = this.pant > 0.25 ? 0.5 : 0;
        w.tongue = this.pant > 0.25 ? 1 : 0;
        break;
    }
    return w;
  }

  // How long its legs are, next to a dog with a proper length of leg.
  legK() {
    return Math.min(1, this.s.elbow / 0.52);
  }

  // pose: what it is doing; hs: how fast it is going. Called every frame.
  play(dt, pose, hs = 0) {
    this.time += dt;
    this.dt = dt;
    if (pose !== this.pose) {
      this.pose = pose;
      this.since = 0;
    }
    this.since += dt;
    // Out of breath after a run: it pants for a while.
    this.pant = clamp(this.pant + dt * (pose === 'run' ? 0.5 : -0.05));
    const want = this.poseFor(pose);
    const k = 1 - Math.exp(-dt * 8);
    const c = this.cur;
    for (const n of POSE_KEYS) c[n] += ((want[n] ?? 0) - c[n]) * k;
    this.solve(c, hs);
    // Blinking now and then, and shut asleep.
    this.blinkAt -= dt;
    if (this.blinkAt < 0) this.blinkAt = 2.5 + Math.random() * 4;
    const shut = c.open < 0.5 || this.blinkAt < 0.11;
    const lid = shut ? (this.s.head.eyeLow ?? 0.5) * 0.9 : -(this.s.head.eyeHigh ?? 0.62);
    for (const l of this.lids) l.rotation.x = lid;
    this.tongue.visible = c.tongue > 0.03;
    this.tongue.scale.set(1, 1, clamp(c.tongue));
    this.body.rotation.y = this.spin;
    this.roll.rotation.z = this.rollOver;
  }

  // Everything, from a pose and where it is in its stride.
  solve(c, hs) {
    const r = this.rest;
    const bones = this.bones;
    const t = this.time ?? 0;
    const dt = this.dt ?? 0;
    const unitsPerSec = (hs ?? 0) / this.size;
    let py = c.py + (this.bob ?? 0);
    let pp = c.pp;
    let sp = c.sp;
    let cp = c.cp;
    let nk = c.nk;
    let hx = c.hx;
    // The legs' four offsets from the pose: forward, up, tip.
    const feet = [
      [c.fz, c.fy, c.ft],
      [c.fz, c.fy, c.ft],
      [c.bz, c.by, c.bt],
      [c.bz, c.by, c.bt],
    ];
    const stride = this.moving;
    let earFlap = 0;
    if (c.gait > 0.02) {
      const gallop = stride === 'run';
      const swim = stride === 'swim';
      const legs = this.legK();
      const maxStride = (gallop ? 0.75 : 0.5) * Math.max(0.55, legs);
      // Steps per second, faster for a small dog; each step as long as it needs.
      const small = Math.sqrt(0.68 / this.size);
      const rate = swim ? 2.2 : gallop ? clamp(2.4 * small, 2.2, 5.5) : clamp((1.2 + unitsPerSec * 0.28) * small, 1.1, 5.2);
      this.phase = (this.phase + dt * rate) % 1;
      const duty = gallop ? 0.34 : swim ? 0.5 : 0.56;
      const S = clamp(swim ? 0.26 : unitsPerSec * (duty / rate), 0.02, maxStride) * c.gait;
      const lift = (gallop ? 0.13 : 0.075 + S * 0.08) * Math.max(0.6, legs) * c.gait;
      // Trot: pairs across; gallop: front pair, then back pair.
      const off = gallop ? [0, 0.14, 0.52, 0.66] : swim ? [0, 0.5, 0.25, 0.75] : [0, 0.5, 0.5, 0];
      for (let i = 0; i < 4; i++) {
        const front = i < 2;
        const ph = (this.phase + off[i]) % 1;
        let dz;
        let dy;
        let tip;
        if (swim) {
          const a = ph * Math.PI * 2;
          dz = Math.sin(a) * S * (front ? 1 : 0.7);
          dy = (Math.cos(a) * 0.09 + 0.14) * (front ? 1 : 0.6);
          tip = front ? 0.6 + Math.cos(a) * 0.4 : 0.3;
        } else if (ph < duty) {
          const u = ph / duty;
          dz = S * (0.5 - u);
          dy = 0;
          // Rolling over the paw at the end of its stance.
          tip = (front ? 0.45 : 0.3) * smooth(0.6, 1, u) * clamp(S / 0.3);
        } else {
          const u = (ph - duty) / (1 - duty);
          const e = u * u * (3 - 2 * u);
          dz = S * (-0.5 + e);
          dy = lift * Math.sin(Math.PI * u);
          tip = (front ? 1.15 : 0.7) * Math.sin(Math.PI * u) * clamp(S / 0.12 + 0.3);
        }
        feet[i][0] += dz;
        feet[i][1] += dy;
        feet[i][2] += tip;
      }
      const p = this.phase * Math.PI * 2;
      if (gallop) {
        // Its back flexes and stretches with each bound.
        pp += Math.sin(p) * 0.09 * c.gait;
        sp += Math.sin(p + 0.8) * 0.13 * c.gait;
        cp += Math.sin(p + 1.4) * 0.11 * c.gait;
        py += (Math.abs(Math.sin(p * 0.5 + 0.9)) * 0.1 - 0.015) * c.gait;
        nk += Math.sin(p + 2.2) * 0.12 * c.gait;
        earFlap = Math.sin(p) * 0.5;
      } else if (!swim) {
        py += (Math.sin(p * 2 + 0.6) * 0.012 - 0.004) * c.gait;
        pp += Math.sin(p * 2) * 0.012 * c.gait;
        hx += Math.sin(p * 2 + 1) * 0.022 * c.gait;
        earFlap = Math.sin(p * 2) * 0.16;
      } else {
        py += Math.sin(t * 3) * 0.008;
      }
    }
    // Breathing.
    const pantRate = this.pant > 0.25 ? 16 : 2.1;
    const pantSize = this.pant > 0.25 ? 0.004 : 0.0028;
    const breath = Math.sin(t * pantRate) * pantSize;

    const P = bones[PELVIS];
    const yP = r.pelvis[1] + py;
    const zP = r.pelvis[2] + c.pz;
    P.position.set(0, yP, zP);
    P.rotation.x = pp;
    const sb = bones[SPINE];
    const cb = bones[CHEST];
    sb.rotation.x = sp;
    cb.rotation.x = cp;
    cb.position.y = r.chest[0] + breath;
    // Where the chest has got to.
    const yS = yP + turnY(r.spine[1], r.spine[0], pp);
    const zS = zP + turnZ(r.spine[1], r.spine[0], pp);
    const aS = pp + sp;
    const yC = yS + turnY(r.chest[1], r.chest[0], aS);
    const zC = zS + turnZ(r.chest[1], r.chest[0], aS);
    const aC = aS + cp;
    // The neck and head: level, however the body lies.
    const neckAll = nk - aC * 0.6;
    bones[NECK1].rotation.set(neckAll * 0.5, c.hy * 0.28, 0);
    bones[NECK2].rotation.set(neckAll * 0.5, c.hy * 0.28, 0);
    bones[HEAD].rotation.set(hx - aC - neckAll, c.hy * 0.44, c.hz);
    bones[JAW].rotation.x = c.mouth * 0.62 + (this.pant > 0.25 ? Math.sin(t * pantRate) * 0.04 * c.mouth : 0);
    this.tongue.rotation.x = -0.04 + Math.sin(t * pantRate) * 0.03 * c.mouth;

    // Each leg, from its paw up.
    LEGS.forEach((leg, i) => {
      const f = feet[i];
      const [b0, b1, b2, b3, b4] = leg.bones;
      if (leg.front) {
        const pz = r.fPaw[2] + f[0];
        const py2 = r.fPaw[1] + f[1];
        const kz = pz + turnZ(r.carpus[1], r.carpus[0], f[2]);
        const ky = py2 + turnY(r.carpus[1], r.carpus[0], f[2]);
        // The shoulder blade swings a little with the leg.
        const yTop = yC + turnY(r.scapTop[1], r.scapTop[0], aC);
        const zTop = zC + turnZ(r.scapTop[1], r.scapTop[0], aC);
        const swing = clamp((Math.atan2(kz - zTop, yTop - ky) - r.swing) * 0.5, -0.45, 0.45);
        const aB = aC - swing;
        bones[b0].rotation.x = -swing;
        const yS2 = yTop + turnY(r.scap[1], r.scap[0], aB);
        const zS2 = zTop + turnZ(r.scap[1], r.scap[0], aB);
        const [a1, a2] = reachFor(zS2, yS2, kz, ky, r.lArm, r.lFore, 1);
        const th1 = wrap(a1 - r.aArm - aB);
        bones[b1].rotation.x = th1;
        const th2 = wrap(a2 - r.aFore - aB - th1);
        bones[b2].rotation.x = th2;
        const a3 = angleOf(pz - kz, py2 - ky);
        const th3 = wrap(a3 - r.aPast - aB - th1 - th2);
        bones[b3].rotation.x = th3;
        // The paw stays flat on the ground, unless it is off it.
        const off = clamp(f[1] * 8);
        bones[b4].rotation.x = wrap(-(aB + th1 + th2 + th3) + off * (f[2] * 0.5));
      } else {
        const pz = r.hPaw[2] + f[0];
        const py2 = r.hPaw[1] + f[1];
        const kz = pz + turnZ(r.hock[1], r.hock[0], f[2]);
        const ky = py2 + turnY(r.hock[1], r.hock[0], f[2]);
        const hipY = yP + turnY(r.hip[1], r.hip[0], pp);
        const hipZ = zP + turnZ(r.hip[1], r.hip[0], pp);
        const [a1, a2] = reachFor(hipZ, hipY, kz, ky, r.lThigh, r.lShin, -1);
        const th1 = wrap(a1 - r.aThigh - pp);
        bones[b0].rotation.set(th1, 0, -leg.side * c.splay);
        const th2 = wrap(a2 - r.aShin - pp - th1);
        bones[b1].rotation.x = th2;
        const a3 = angleOf(pz - kz, py2 - ky);
        const th3 = wrap(a3 - r.aMeta - pp - th1 - th2);
        bones[b2].rotation.x = th3;
        const off = clamp(f[1] * 8);
        bones[b3].rotation.x = wrap(-(pp + th1 + th2 + th3) + off * (f[2] * 0.4));
      }
    });

    // Its tail: carried by its pose, and wagging.
    const wag = this.wag ?? { rate: 3, size: 0.2 };
    const lift = (c.tail - 0.5) * 0.9;
    const stiff = this.s.tail.stiff ?? 0;
    TAIL.forEach((bone, i) => {
      const lag = Math.sin(t * wag.rate - i * 0.7) * wag.size * (i === 0 ? 0.8 : 0.42) * (1 - stiff);
      bones[bone].rotation.set((i === 0 ? lift - pp * 0.75 : lift * 0.12) * (1 - stiff * 0.7), lag, 0);
    });

    // Its ears: flopping as it goes.
    const earType = this.s.ear.type;
    const hang = earType === 'drop';
    EAR.forEach((e, i) => {
      const side = i ? 1 : -1;
      if (hang) {
        bones[e].rotation.set(0, 0, side * (c.ear * 0.25 + earFlap * 0.5));
        bones[e + 1].rotation.set(earFlap * 0.15, 0, side * (earFlap * 0.28 + Math.max(0, c.ear) * 0.15));
      } else {
        // Up: pricked forward when it is glad, laid back asleep.
        const twitch = Math.max(0, Math.sin(t * 0.9 + i * 2 + this.seed)) ** 24 * 0.25;
        bones[e].rotation.set(c.ear * -0.3 + earFlap * 0.1, 0, side * (twitch - c.ear * 0.2));
        bones[e + 1].rotation.set(earFlap * 0.1, 0, 0);
      }
    });
  }

  // How high the top of its back is at z, fur and all, in its own height.
  backAt(z) {
    const { a, s } = this.b;
    const sculpt = (this.bodyField ??= new Sculpture(a.parts));
    let lo = 0;
    let hi = 1.3;
    for (let i = 0; i < 18; i++) {
      const m = (lo + hi) / 2;
      if (sculpt.at(0, m, z) < 0) lo = m;
      else hi = m;
    }
    return lo + s.fur.body * 0.6;
  }

  setCollar(color) {
    this.band.color.set(color);
  }

  dispose() {
    this.skeleton.dispose();
    this.band.dispose();
  }
}
