// The players: round-headed little animals, kids or grown-ups, in a t-shirt, with a hat
// if they like. Built from simple shapes and animated by hand — walking,
// jumping, swimming, flying, and the emotes (wave, dance, cheer...).
import * as THREE from '../../vendor/three.module.js';
import { BRICK_COLORS, TOY_BRICKS } from '../shared/blocks.js';
import { FUR_COLORS, GROWN_UP, HAIR_COLORS, isPerson, lookTall, SKIN_TONES } from '../shared/words.js';
import { bake, bakeCached, blobShadow, capsule, cone, cylinder, geo, lathe, mesh, onSurface, roundedBox, sphere, toon, torus } from './toon.js';

const HEAD_R = 0.34;
const HEAD = { sx: 1.08, sy: 0.96, sz: 1 };
const HR = [HEAD_R * HEAD.sx, HEAD_R * HEAD.sy, HEAD_R * HEAD.sz];

// Swings at a monster, one for each toy weapon and a punch without one: a
// wind-up, a strike that speeds up into the hit (at strike, a fraction of
// the way through), a moment held there, and an easy way back. Each key is a
// pose at a fraction of the way through: w how much of it (0 is the pose the
// avatar would have anyway), fwd and raise the right arm (as armFwdR and
// armRaiseR), wrist turns what is in that hand forward and down (0 holds it
// square to the arm, as at rest), fwdL and raiseL the left (with wL how much), twist the
// shoulders round (+ takes the right one back), lean forward, dip the body,
// nod the head, and step the left foot forward.
export const SWINGS = {
  punch: {
    secs: 0.34,
    strike: 0.4,
    keys: [
      { at: 0, w: 0 },
      { at: 0.22, w: 1, fwd: 0.45, raise: 0.3, twist: 0.3, lean: -0.03 },
      { at: 0.4, w: 1, fwd: -1.6, raise: 0.08, twist: -0.4, lean: 0.14, step: 0.3, dip: -0.02 },
      { at: 0.58, w: 1, fwd: -1.55, raise: 0.08, twist: -0.38, lean: 0.12, step: 0.3, dip: -0.02 },
      { at: 1, w: 0 },
    ],
  },
  // Up behind the shoulder, blade back, then down and across in front, the
  // blade ending a little below level.
  sword: {
    secs: 0.44,
    strike: 0.48,
    keys: [
      { at: 0, w: 0 },
      { at: 0.3, w: 1, fwd: -2.5, raise: 0.75, wrist: -0.3, twist: 0.4, lean: -0.06, nod: -0.12 },
      { at: 0.48, w: 1, fwd: -1, raise: -0.35, wrist: 1.05, twist: -0.42, lean: 0.16, step: 0.35, dip: -0.03, nod: 0.1 },
      { at: 0.62, w: 1, fwd: -0.65, raise: -0.45, wrist: 0.95, twist: -0.48, lean: 0.14, step: 0.35, dip: -0.03, nod: 0.08 },
      { at: 1, w: 0 },
    ],
  },
  // Both hands up and back over the head, then down with all the body
  // behind it, the head of the hammer landing on the ground in front.
  hammer: {
    secs: 0.6,
    strike: 0.56,
    keys: [
      { at: 0, w: 0, wL: 0 },
      { at: 0.42, w: 1, wL: 1, fwd: -3, raise: 0.12, wrist: -0.2, fwdL: -2.8, raiseL: 0.05, lean: -0.16, nod: -0.18 },
      { at: 0.56, w: 1, wL: 1, fwd: -1.1, raise: -0.08, wrist: 1.45, fwdL: -1.15, raiseL: -0.35, lean: 0.32, step: 0.4, dip: -0.08, nod: 0.18 },
      { at: 0.72, w: 1, wL: 1, fwd: -0.95, raise: -0.08, wrist: 1.55, fwdL: -1, raiseL: -0.35, lean: 0.3, step: 0.4, dip: -0.07, nod: 0.15 },
      { at: 1, w: 0, wL: 0 },
    ],
  },
  // Up to aim, the other hand under it, the barrel kept level; a kick up
  // as the bubble goes, and down again.
  blaster: {
    secs: 0.42,
    strike: 0.34,
    keys: [
      { at: 0, w: 0, wL: 0 },
      { at: 0.26, w: 1, wL: 1, fwd: -1.45, raise: 0.04, wrist: 1.45, fwdL: -1.3, raiseL: -0.32, twist: -0.12, lean: 0.06 },
      { at: 0.34, w: 1, wL: 1, fwd: -1.45, raise: 0.04, wrist: 1.45, fwdL: -1.3, raiseL: -0.32, twist: -0.12, lean: 0.06 },
      { at: 0.42, w: 1, wL: 1, fwd: -1.75, raise: 0.04, wrist: 1.35, fwdL: -1.55, raiseL: -0.32, twist: -0.1, lean: -0.06 },
      { at: 0.6, w: 1, wL: 1, fwd: -1.45, raise: 0.04, wrist: 1.45, fwdL: -1.3, raiseL: -0.32, twist: -0.12, lean: 0.06 },
      { at: 1, w: 0, wL: 0 },
    ],
  },
};
const POSE_KEYS = ['w', 'wL', 'fwd', 'raise', 'wrist', 'fwdL', 'raiseL', 'twist', 'lean', 'nod', 'dip', 'step'];
// What a key says of one of them: an arm angle a key leaves out is the next
// key's (it has no weight there anyway), anything else is none.
const ARM_ANGLES = new Set(['fwd', 'raise', 'wrist', 'fwdL', 'raiseL']);
const poseValue = (key, mine, next) => mine[key] ?? (ARM_ANGLES.has(key) ? (next[key] ?? 0) : 0);
// Ease in and out between keys, but into the strike speeding up all the way,
// so it lands hard.
const easeInOut = (k) => k * k * (3 - 2 * k);
const easeIn = (k) => k * k * k;

// The pose a swing has reached, k of the way through it.
export function swingPose(swing, k) {
  const { keys } = swing;
  let i = 1;
  while (i < keys.length - 1 && keys[i].at < k) i++;
  const a = keys[i - 1];
  const b = keys[i];
  const f = Math.min(1, Math.max(0, (k - a.at) / (b.at - a.at || 1)));
  const e = b.at === swing.strike ? easeIn(f) : easeInOut(f);
  const pose = {};
  for (const key of POSE_KEYS) {
    const va = poseValue(key, a, b);
    pose[key] = va + (poseValue(key, b, a) - va) * e;
  }
  return pose;
}
const BLACK = '#2b2530';
const WHITE = '#ffffff';
const PINK = '#ff9fb8';
const EYE = '#4a3226';

// How far your middle is over the bed lying down: half how deep a body is.
const LIE_LIFT = 0.16;
// Curled up in a bed one block long, all of you fits in this much of it,
// head to toe and side to side (shared/seats.js puts the root at its middle).
const CURL_ROOM = { long: 0.84, wide: 0.84 };

// dizzy: sitting on the ground, out of hearts on an adventure island, until a friend helps you up.
// sit: on a chair or a sofa, the root at the seat; lie: in bed, on your
// back, the root at your feet and your head behind you; curl: in a bed one
// block long, curled up on your side with your knees up, made just small
// enough to fit in it, the root in the middle of the bed (shared/seats.js).
export const ANIM = { idle: 0, walk: 1, run: 2, air: 3, swim: 4, fly: 5, ride: 6, dizzy: 7, sit: 8, lie: 9, curl: 10 };

export function shirtColor(index) {
  return BRICK_COLORS[index]?.[2] ?? BRICK_COLORS[0][2];
}

function lighten(hex, k) {
  const c = new THREE.Color(hex);
  const w = new THREE.Color('#ffffff');
  return `#${c.lerp(w, k).getHexString()}`;
}

function darken(hex, k) {
  const c = new THREE.Color(hex);
  return `#${c.multiplyScalar(1 - k).getHexString()}`;
}

// A feature sitting on the face, pushed out along the head's surface.
function onFace(fx, fy, out) {
  return onSurface(HR[0], HR[1], HR[2], fx, fy, out);
}

function eyes(head, style = 'dot') {
  const group = new THREE.Group();
  for (const side of [-1, 1]) {
    const p = onFace(side * 0.12, 0.02, 0.005);
    if (style === 'big') {
      // A big round eye: a white, an iris, a pupil and a catchlight, turned to face out.
      const eye = new THREE.Group();
      eye.position.set(p.x, p.y, p.z);
      eye.lookAt(p.clone().multiplyScalar(2));
      eye.add(mesh(sphere(1, 18, 14), toon(WHITE), 0, 0, 0, 0.056, 0.072, 0.034));
      const iris = mesh(sphere(1, 14, 10), toon(EYE), 0, -0.004, 0.016, 0.036, 0.05, 0.02);
      iris.userData.iris = true;
      eye.add(iris);
      const pupil = mesh(sphere(1, 10, 8), toon(BLACK), 0, -0.006, 0.027, 0.02, 0.028, 0.011);
      pupil.userData.iris = true;
      eye.add(pupil);
      eye.add(mesh(sphere(1, 8, 6), toon(WHITE, { emissive: 0.75 }), -0.013, 0.02, 0.028, 0.011, 0.014, 0.007));
      group.add(eye);
    } else {
      const eye = mesh(sphere(1, 16, 12), toon(BLACK), p.x, p.y, p.z, 0.048, 0.062, 0.03);
      eye.lookAt(p.clone().multiplyScalar(2));
      const shine = mesh(sphere(1, 8, 6), toon(WHITE, { emissive: 0.6 }), p.x + side * 0.012 - 0.01, p.y + 0.022, p.z + 0.024, 0.016);
      group.add(eye, shine);
    }
  }
  group.userData.blink = true;
  head.add(group);
  return group;
}

// A pair of eyebrows above the eyes, flat and soft.
function brows(head, color) {
  for (const side of [-1, 1]) {
    const p = onFace(side * 0.12, 0.145, 0.004);
    const b = mesh(sphere(1, 12, 8), toon(color), p.x, p.y, p.z, 0.05, 0.016, 0.014);
    b.lookAt(p.clone().multiplyScalar(2));
    b.rotateZ(side * 0.12);
    head.add(b);
  }
}

function blush(head) {
  for (const side of [-1, 1]) {
    const p = onFace(side * 0.2, -0.08, 0.004);
    const b = mesh(sphere(1, 12, 8), toon('#ff9ab0', { transparent: true, opacity: 0.75 }), p.x, p.y, p.z, 0.055, 0.032, 0.012);
    b.lookAt(p.clone().multiplyScalar(2));
    head.add(b);
  }
}

function smile(head, width = 0.05, y = -0.1) {
  const p = onFace(0, y, 0.004);
  const m = mesh(torus(width, 0.012, Math.PI), toon('#7a3b3b'), p.x, p.y, p.z);
  m.rotation.z = Math.PI;
  m.rotation.x = -0.35;
  head.add(m);
  return m;
}

function muzzle(head, color, noseColor = BLACK, size = 1) {
  const p = onFace(0, -0.07, -0.03);
  const mz = mesh(sphere(1, 16, 12), toon(color), p.x, p.y, p.z, 0.12 * size, 0.085 * size, 0.08 * size);
  head.add(mz);
  const n = mesh(sphere(1, 12, 8), toon(noseColor), p.x, p.y + 0.035 * size, p.z + 0.07 * size, 0.04, 0.03, 0.03);
  head.add(n);
  // Nostrils either side of the nose, and a small mouth under it.
  for (const side of [-1, 1]) {
    head.add(mesh(sphere(1, 8, 6), toon(darken(noseColor, 0.3)), p.x + side * 0.016 * size, p.y + 0.036 * size, p.z + 0.09 * size, 0.008, 0.01, 0.006));
  }
  const mouth = onFace(0, -0.135, 0.004);
  head.add(mesh(capsule(0.006, 0.03), toon('#7a3b3b'), mouth.x, mouth.y, mouth.z + 0.04 * size).rotateZ(Math.PI / 2));
}

// Whiskers springing from the muzzle: three each side, all as one shape.
function whiskers(head) {
  const parts = [];
  for (const side of [-1, 1]) {
    for (const [dy, dz, tilt] of [[0.045, 0.02, 0.15], [0.0, -0.01, 0], [-0.04, 0.02, -0.15]]) {
      const m = new THREE.Matrix4()
        .makeRotationZ(side * (Math.PI / 2 - tilt))
        .setPosition(side * 0.17, -0.07 + dy, dz + 0.1);
      parts.push({ g: capsule(0.0035, 0.13), m });
    }
  }
  head.add(mesh(bakeCached('whiskers', parts), toon('#f5ecf2')));
}

function ears(head, animal, fur) {
  const inner = PINK;
  const topY = HR[1];
  const add = (m) => {
    head.add(m);
    return m;
  };
  switch (animal) {
    case 'bunny':
      for (const side of [-1, 1]) {
        const g = new THREE.Group();
        g.position.set(side * 0.13, topY * 0.8, -0.02);
        g.rotation.z = -side * 0.18;
        g.add(mesh(sphere(), toon(fur), 0, 0.26, 0, 0.075, 0.28, 0.05));
        g.add(mesh(sphere(), toon(inner), 0, 0.26, 0.025, 0.045, 0.22, 0.03));
        g.userData.ear = side;
        add(g);
      }
      break;
    case 'cat':
    case 'fox':
      for (const side of [-1, 1]) {
        const g = new THREE.Group();
        g.position.set(side * 0.18, topY * 0.78, 0);
        g.rotation.z = -side * 0.35;
        g.add(mesh(cone(0.11, animal === 'fox' ? 0.26 : 0.2, 4), toon(fur), 0, 0.08, 0));
        g.add(mesh(cone(0.06, animal === 'fox' ? 0.17 : 0.13, 4), toon(animal === 'fox' ? WHITE : inner), 0, 0.06, 0.035));
        g.userData.ear = side;
        add(g);
      }
      break;
    case 'bear':
    case 'panda':
    case 'koala':
    case 'mouse': {
      const big = animal === 'mouse' ? 0.15 : animal === 'koala' ? 0.14 : 0.1;
      const col = animal === 'panda' ? BLACK : fur;
      for (const side of [-1, 1]) {
        const e = add(mesh(sphere(), toon(col), side * 0.25, topY * 0.72, -0.03, big, big, big * 0.45));
        e.userData.ear = side;
        add(mesh(sphere(), toon(animal === 'koala' ? WHITE : animal === 'panda' ? '#4a4450' : inner), side * 0.25, topY * 0.72, big * 0.2, big * 0.6, big * 0.6, big * 0.2));
      }
      break;
    }
    case 'puppy':
      for (const side of [-1, 1]) {
        const e = add(mesh(sphere(), toon(darken(fur, 0.25)), side * 0.33, 0.02, 0, 0.08, 0.2, 0.06));
        e.rotation.z = side * 0.25;
        e.userData.ear = side;
      }
      break;
    case 'pig':
      for (const side of [-1, 1]) {
        const e = add(mesh(cone(0.08, 0.13, 4), toon(fur), side * 0.2, topY * 0.8, 0.02));
        e.rotation.z = -side * 0.4;
        e.rotation.x = 0.3;
        e.userData.ear = side;
      }
      break;
    default:
      break;
  }
}

function face(head, animal, fur) {
  switch (animal) {
    case 'frog': {
      for (const side of [-1, 1]) {
        head.add(mesh(sphere(), toon(fur), side * 0.15, HR[1] * 0.78, 0.1, 0.12));
        head.add(mesh(sphere(), toon(WHITE), side * 0.15, HR[1] * 0.8, 0.17, 0.085));
        head.add(mesh(sphere(), toon(BLACK), side * 0.15, HR[1] * 0.8, 0.245, 0.045, 0.055, 0.02));
      }
      smile(head, 0.12, -0.05);
      blush(head);
      return null;
    }
    case 'pig': {
      const e = eyes(head);
      const p = onFace(0, -0.06, -0.015);
      head.add(mesh(cylinder(0.08, 0.08, 0.06, 16), toon('#ff8fae'), p.x, p.y, p.z, 1, 1, 1).rotateX(Math.PI / 2));
      for (const side of [-1, 1]) head.add(mesh(sphere(), toon('#c05a7a'), p.x + side * 0.028, p.y, p.z + 0.032, 0.014, 0.022, 0.01));
      blush(head);
      return e;
    }
    case 'panda': {
      for (const side of [-1, 1]) {
        const p = onFace(side * 0.12, 0.01, -0.01);
        const patch = mesh(sphere(1, 16, 12), toon(BLACK), p.x, p.y, p.z, 0.083, 0.105, 0.04);
        patch.rotation.z = side * 0.5;
        head.add(patch);
        head.add(mesh(sphere(1, 12, 8), toon(darken(fur, 0.1)), p.x, p.y - 0.01, p.z + 0.02, 0.05, 0.065, 0.028));
      }
      const e = eyes(head, 'big');
      // A panda's eyes are pale in their dark patches.
      e.traverse((o) => {
        if (o.userData.iris) o.material = toon('#e8e4ee');
      });
      muzzle(head, WHITE, BLACK, 0.8);
      return e;
    }
    case 'bear':
      muzzle(head, lighten(fur, 0.45));
      break;
    case 'puppy':
      muzzle(head, lighten(fur, 0.5));
      break;
    case 'fox':
      muzzle(head, WHITE);
      break;
    case 'koala': {
      const p = onFace(0, -0.04, -0.01);
      head.add(mesh(sphere(), toon('#4a4450'), p.x, p.y, p.z, 0.07, 0.09, 0.06));
      break;
    }
    case 'mouse':
    case 'bunny':
    case 'cat': {
      const p = onFace(0, -0.045, 0.004);
      head.add(mesh(sphere(1, 14, 10), toon('#ff7f9f'), p.x, p.y, p.z, 0.03, 0.022, 0.02));
      smile(head, 0.035, -0.1);
      if (animal !== 'bunny') whiskers(head);
      // A cheek ruff either side of the face, where the fur stands out.
      for (const side of [-1, 1]) {
        const c = onFace(side * 0.24, -0.09, -0.025);
        head.add(mesh(sphere(1, 14, 10), toon(fur), c.x, c.y, c.z, 0.075, 0.06, 0.05));
      }
      break;
    }
    default:
      break;
  }
  const e = eyes(head);
  blush(head);
  return e;
}

function tail(root, animal, fur) {
  const t = new THREE.Group();
  t.position.set(0, 0.36, -0.2);
  switch (animal) {
    case 'bunny':
    case 'bear':
    case 'panda':
      t.add(mesh(sphere(1, 16, 12), toon(animal === 'bunny' ? WHITE : animal === 'panda' ? BLACK : fur), 0, 0, -0.02, 0.08));
      break;
    case 'cat': {
      // A long tail that tapers in three steps, with a dark tip.
      const seg = [
        [0.045, 0.16, fur],
        [0.034, 0.14, fur],
        [0.024, 0.12, darken(fur, 0.35)],
      ];
      let y = 0.02;
      for (const [r, len, col] of seg) {
        const m = mesh(capsule(r, len * 0.8), toon(col), 0, y + len / 2 - 0.04, -0.02 - y * 0.35);
        m.rotation.x = -0.55;
        t.add(m);
        y += len * 0.75;
      }
      break;
    }
    case 'fox': {
      // A big brush of a tail in overlapping steps of fur, white at the tip.
      const brush = [
        [0.085, 0, fur],
        [0.08, 0.12, fur],
        [0.07, 0.24, fur],
        [0.055, 0.34, WHITE],
      ];
      for (const [r, along, col] of brush) {
        t.add(mesh(sphere(1, 16, 12), toon(col), 0, 0.02 + along * 0.85, -0.04 - along * 0.35, r, r * 0.9, r));
      }
      break;
    }
    case 'mouse': {
      // A thin tail with a little bead at the end.
      const m = mesh(capsule(0.022, 0.3), toon(PINK), 0, 0.15, -0.1);
      m.rotation.x = -0.7;
      t.add(m, mesh(sphere(1, 10, 8), toon(PINK), 0, 0.31, -0.2, 0.026));
      break;
    }
    case 'puppy': {
      const m = mesh(capsule(0.04, 0.14), toon(fur), 0, 0.08, -0.04);
      m.rotation.x = -0.9;
      t.add(m, mesh(sphere(1, 12, 8), toon(lighten(fur, 0.3)), 0, 0.04, -0.16, 0.042));
      break;
    }
    case 'pig':
      t.add(mesh(torus(0.04, 0.015), toon(fur), 0, 0.02, -0.02));
      t.add(mesh(torus(0.024, 0.009), toon(darken(fur, 0.12)), 0, 0.024, -0.021));
      break;
    default:
      return null;
  }
  root.add(t);
  return t;
}

// ------------------------------------------------ kids

// Hats that sit over the top of the head, where a bun or spikes would poke through.
const CROWN_HATS = ['cap', 'beanie', 'straw', 'party'];
const TIE = '#ff6f9f';
const UP = new THREE.Vector3(0, 1, 0);

// A piece of a shell k times the size of the head. Around the head, phi 0 is
// the left side, π/2 the face, π the right side and 3π/2 the back; theta goes
// down from the top. tilt leans it back, to reach lower behind than in front.
function shell(k, { phi = 0, phiLength = Math.PI * 2, theta = 0, thetaLength = Math.PI, tilt = 0 } = {}) {
  return geo(`shell${k}|${phi}|${phiLength}|${theta}|${thetaLength}|${tilt}`, () => new THREE.SphereGeometry(HEAD_R * k, 28, 16, phi, phiLength, theta, thetaLength).rotateX(-tilt));
}

// A point on the head k times its size, `up` from the top and `turn` round
// from the face (to its left), and which way is out there.
function onHead(up, turn, k = 1) {
  const p = new THREE.Vector3(Math.sin(up) * Math.sin(turn) * HR[0] * k, Math.cos(up) * HR[1] * k, Math.sin(up) * Math.cos(turn) * HR[2] * k);
  const out = new THREE.Vector3(p.x / HR[0] ** 2, p.y / HR[1] ** 2, p.z / HR[2] ** 2).normalize();
  return { p, out };
}

// A kid's face, or a grown-up's (grown: with smaller eyes, and what they
// have on it, see FACES in shared/words.js). ears: false where hair covers them.
function kidFace(head, skin, { ears = true, grown = false, extra = 'none', hairColor = BLACK } = {}) {
  if (ears) {
    for (const side of [-1, 1]) {
      const ear = mesh(sphere(1, 14, 10), toon(skin), side * HR[0] * 0.97, -0.03, -0.02, 0.05, 0.075, 0.06);
      ear.rotateZ(side * 0.2);
      head.add(ear);
      head.add(mesh(sphere(1, 10, 8), toon(darken(skin, 0.15)), side * HR[0] * 1.0, -0.03, 0.008, 0.028, 0.042, 0.03));
    }
  }
  // Soft cheeks and a small chin, so the head reads as a face, not a ball.
  for (const side of [-1, 1]) {
    const c = onFace(side * 0.21, -0.1, -0.02);
    head.add(mesh(sphere(1, 14, 10), toon(skin), c.x, c.y, c.z, 0.08, 0.07, 0.06));
  }
  const chin = onFace(0, -0.26, -0.01);
  head.add(mesh(sphere(1, 12, 8), toon(skin), chin.x, chin.y, chin.z, 0.07, 0.05, 0.05));
  const p = onFace(0, -0.04, 0);
  head.add(mesh(sphere(1, 16, 12), toon(darken(skin, 0.12)), p.x, p.y, p.z, grown ? 0.036 : 0.032, grown ? 0.03 : 0.024, 0.024));
  smile(head, 0.045, -0.11);
  const e = eyes(head, grown ? 'dot' : 'big');
  blush(head);
  if (grown) brows(head, hairColor);
  if (extra.includes('glasses')) glasses(head);
  if (extra.includes('beard')) beard(head, hairColor);
  if (extra === 'moustache' || extra.includes('beard')) moustache(head, hairColor);
  return e;
}

// Round glasses over the eyes, with arms back to the ears.
function glasses(head) {
  const frame = toon('#3a3340');
  for (const side of [-1, 1]) {
    const p = onFace(side * 0.12, 0.02, 0.03);
    const ring = mesh(torus(0.068, 0.011), frame, p.x, p.y, p.z);
    ring.lookAt(p.clone().multiplyScalar(2));
    const lens = mesh(cylinder(0.064, 0.064, 0.004, 20), toon('#d8f0ff', { transparent: true, opacity: 0.3 }), p.x, p.y, p.z);
    lens.quaternion.setFromUnitVectors(UP, p.clone().normalize());
    head.add(ring, lens);
    // From the outer edge of the rim, back along the side of the head.
    const edge = onFace(side * 0.19, 0.02, 0.02);
    const ear = new THREE.Vector3(side * HR[0] * 1.02, 0.02, -0.04);
    const arm = mesh(cylinder(0.009, 0.009, edge.distanceTo(ear), 6), frame, (edge.x + ear.x) / 2, (edge.y + ear.y) / 2, (edge.z + ear.z) / 2);
    arm.quaternion.setFromUnitVectors(UP, ear.clone().sub(edge).normalize());
    head.add(arm);
  }
  const bridge = onFace(0, 0.035, 0.03);
  head.add(mesh(capsule(0.009, 0.05), frame, bridge.x, bridge.y, bridge.z).rotateZ(Math.PI / 2));
}

// A moustache under the nose, curling up a little at each end.
function moustache(head, color) {
  for (const side of [-1, 1]) {
    const p = onFace(side * 0.045, -0.075, 0.008);
    const m = mesh(sphere(1, 14, 10), toon(color), p.x, p.y, p.z, 0.055, 0.024, 0.03);
    m.lookAt(p.clone().multiplyScalar(2));
    m.rotateZ(side * 0.25);
    head.add(m);
    // The curl at the end, tipping up.
    const tip = onFace(side * 0.095, -0.06, 0.01);
    head.add(mesh(sphere(1, 12, 8), toon(color), tip.x, tip.y, tip.z, 0.024, 0.02, 0.024));
  }
}

// A beard round the jaw, from ear to ear, under the smile.
function beard(head, color) {
  const mat = toon(color, { side: THREE.DoubleSide });
  head.add(mesh(shell(1.06, { phi: Math.PI / 2 - 1.45, phiLength: 2.9, theta: 1.95, thetaLength: 0.95 }), mat, 0, 0, 0, HEAD.sx, HEAD.sy, HEAD.sz));
  const chin = onFace(0, -0.25, 0.03);
  head.add(mesh(sphere(1, 16, 12), toon(color), chin.x, chin.y, chin.z, 0.13, 0.09, 0.08));
}

// A kid's hair. Returns the bunches and tails that swing as you move.
function hair(head, style, color, hatKind) {
  const g = new THREE.Group();
  const shellMat = toon(color, { side: THREE.DoubleSide });
  const mat = toon(color);
  const covered = CROWN_HATS.includes(hatKind);
  const sway = [];
  const add = (m) => {
    g.add(m);
    return m;
  };
  const cover = (k, opts) => add(mesh(shell(k, opts), shellMat, 0, 0, 0, HEAD.sx, HEAD.sy, HEAD.sz));
  // The top and the back, clear of the forehead.
  const cap = () => cover(1.07, { thetaLength: 1.59, tilt: 0.6 });
  // A lock of hair lying flat over the forehead, rolled round in place.
  const lock = (fx, fy, sx, sy, roll = 0) => {
    const p = onFace(fx, fy, 0.014);
    const m = mesh(sphere(1, 14, 10), mat, p.x, p.y, p.z, sx, sy, 0.045);
    m.lookAt(p.clone().multiplyScalar(2));
    m.rotateZ(roll);
    return add(m);
  };
  const swept = () => {
    lock(-0.16, 0.18, 0.1, 0.07, 0.55);
    lock(-0.04, 0.155, 0.11, 0.075, 0.35);
    lock(0.09, 0.165, 0.1, 0.065, 0.15);
  };
  // Something sticking out of the head along the way out, sunk in a little.
  const outward = (m, up, turn, k, sink) => {
    const { p, out } = onHead(up, turn, k);
    m.quaternion.setFromUnitVectors(UP, out);
    m.position.copy(p).addScaledVector(out, sink);
    return add(m);
  };
  // A bunch of hair hanging from a tie, which swings: side 0 behind, -1 or 1 beside.
  const bunch = (x, y, z, side, size) => {
    const b = new THREE.Group();
    b.position.set(x, y, z);
    b.add(mesh(sphere(1, 12, 8), toon(TIE), 0, 0, 0, 0.045));
    // The tie wraps twice round the top of the bunch.
    b.add(mesh(torus(0.05 * size, 0.012), toon(TIE), 0, -0.045 * size, 0).rotateX(Math.PI / 2));
    b.add(mesh(sphere(1, 16, 12), mat, 0, -0.15 * size, 0, 0.085 * size, 0.17 * size, 0.08 * size));
    b.add(mesh(sphere(1, 14, 10), mat, 0, -0.28 * size, 0, 0.062 * size, 0.11 * size, 0.06 * size));
    b.add(mesh(sphere(1, 12, 8), mat, 0, -0.38 * size, 0, 0.038 * size, 0.06 * size, 0.038 * size));
    b.userData = { side, rest: side ? side * 0.45 : 0.4 };
    if (side) b.rotation.z = b.userData.rest;
    else b.rotation.x = b.userData.rest;
    sway.push(b);
    return add(b);
  };
  switch (style) {
    case 'spiky': {
      cap();
      swept();
      // Spikes of two sizes, every one turned a little differently, as one shape.
      if (!covered) {
        const spikes = [];
        for (const [up, turn, len, tilt] of [
          [0.2, 0, 0.17, 0], [0.5, 0.45, 0.14, 0.3], [0.5, -0.45, 0.14, -0.3],
          [0.62, 1.05, 0.13, 0.2], [0.62, -1.05, 0.13, -0.2], [0.75, 1.7, 0.12, 0.1],
          [0.75, -1.7, 0.12, -0.1], [0.8, 2.5, 0.13, 0.15], [0.8, -2.5, 0.13, -0.15],
          [0.86, Math.PI, 0.14, 0.05], [0.35, 2.9, 0.11, 0.2], [0.35, -2.9, 0.11, -0.2],
        ]) {
          const { p, out } = onHead(up, turn, 1.04);
          const q = new THREE.Quaternion().setFromUnitVectors(UP, out).multiply(new THREE.Quaternion().setFromAxisAngle(UP, tilt));
          spikes.push({ g: cone(0.072, len, 10), m: new THREE.Matrix4().compose(p.addScaledVector(out, len / 2 - 0.02), q, new THREE.Vector3(1, 1, 1)) });
        }
        add(mesh(bakeCached('spikes', spikes), mat));
      }
      break;
    }
    case 'curly': {
      cover(1.05, { thetaLength: 1.75, tilt: 0.62 });
      // Curls all over, round the face: spread evenly, then kept to where hair grows.
      const pole = new THREE.Vector3(0, Math.cos(0.68), -Math.sin(0.68));
      const curls = [];
      const n = 70;
      for (let i = 0; i < n; i++) {
        const y = 1 - (2 * (i + 0.5)) / n;
        const r = Math.sqrt(1 - y * y);
        const a = i * 2.39996;
        const d = new THREE.Vector3(r * Math.cos(a), y, r * Math.sin(a));
        if (d.dot(pole) < -0.02) continue;
        const size = 0.085 + (i % 3) * 0.008;
        curls.push({ g: sphere(1, 12, 9), m: new THREE.Matrix4().makeScale(size, size, size).setPosition(d.x * HR[0] * 1.1, d.y * HR[1] * 1.1, d.z * HR[2] * 1.1) });
      }
      add(mesh(bakeCached('curls', curls), mat));
      break;
    }
    case 'bob':
    case 'long': {
      cap();
      // Down the sides and the back, round the face.
      cover(1.1, { phi: Math.PI / 2 + 0.85, phiLength: Math.PI * 2 - 1.7, theta: 0.9, thetaLength: style === 'bob' ? 1.25 : 1.45 });
      for (const fx of [-0.18, -0.06, 0.06, 0.18]) lock(fx, 0.16, 0.08, 0.075);
      if (style === 'bob') {
        // The hem of the bob turns under, all the way round.
        const hem = mesh(torus(0.29, 0.045, Math.PI * 2), mat, 0, -0.16, -0.01, HEAD.sx * 1.02, 1, 0.98);
        hem.rotation.x = Math.PI / 2 + 0.08;
        add(hem);
      }
      if (style === 'long') {
        // On down the back, past the shoulders, with rounded edges.
        const fall = new THREE.Group();
        fall.scale.x = HEAD.sx;
        fall.add(mesh(geo('hair-fall', () => new THREE.CylinderGeometry(0.266, 0.3, 0.3, 20, 1, true, Math.PI - 1.2, 2.4)), shellMat, 0, -0.4, 0));
        fall.add(mesh(geo('hair-end', () => new THREE.TorusGeometry(0.27, 0.05, 8, 20, 2.4).rotateX(Math.PI / 2).rotateY(Math.PI / 2 + 1.2)), mat, 0, -0.55, 0));
        for (const side of [-1, 1]) fall.add(mesh(capsule(0.05, 0.28), mat, side * Math.sin(1.2) * 0.25, -0.41, -Math.cos(1.2) * 0.25));
        add(fall);
      }
      break;
    }
    case 'ponytail':
      cap();
      swept();
      bunch(0, 0.22, -0.33, 0, 1.3);
      break;
    case 'pigtails':
      cap();
      for (const fx of [-0.15, 0, 0.15]) lock(fx, 0.16, 0.085, 0.07);
      for (const side of [-1, 1]) bunch(side * 0.36, 0.1, -0.08, side, 1);
      break;
    case 'bun':
      cap();
      swept();
      if (!covered) {
        add(mesh(sphere(1, 16, 12), mat, 0, 0.36, -0.12, 0.14, 0.13, 0.14));
        add(mesh(torus(0.1, 0.02), toon(TIE), 0, 0.3, -0.1).rotateX(Math.PI / 2 + 0.4));
        add(mesh(torus(0.105, 0.02), toon(TIE), 0, 0.35, -0.1).rotateX(Math.PI / 2 + 0.1));
        // A few loose strands escaping the bun.
        for (const [dx, dy, dz, len, roll] of [[-0.08, 0.3, -0.05, 0.09, 0.5], [0.07, 0.28, -0.04, 0.08, -0.4], [0, 0.42, -0.08, 0.07, 0.2]]) {
          add(mesh(capsule(0.012, len), mat, dx, dy, dz).rotateZ(roll));
        }
      }
      break;
    default: {
      cap();
      // A fuller fringe than the swept locks, all as one shape.
      const fringe = [];
      const Z = new THREE.Vector3(0, 0, 1);
      for (const [fx, fy, sx, sy, roll] of [[-0.21, 0.165, 0.085, 0.06, 0.55], [-0.1, 0.15, 0.1, 0.07, 0.3], [0.01, 0.145, 0.1, 0.07, 0.1], [0.12, 0.155, 0.09, 0.065, -0.15], [0.22, 0.175, 0.075, 0.055, -0.45], [-0.26, 0.19, 0.06, 0.045, 0.7]]) {
        const p = onFace(fx, fy, 0.014);
        const q = new THREE.Quaternion().setFromUnitVectors(Z, p.clone().normalize()).multiply(new THREE.Quaternion().setFromAxisAngle(Z, roll));
        fringe.push({ g: sphere(1, 14, 10), m: new THREE.Matrix4().compose(p, q, new THREE.Vector3(sx, sy, 0.045)) });
      }
      add(mesh(bakeCached('fringe|short', fringe), mat));
      break;
    }
  }
  head.add(g);
  return sway;
}

// lift: how much higher than on an animal's head it sits (on a kid's hair).
// A toy weapon from the shop (shared/shop.js), held in the hand: its grip
// at the hand, pointing forward with the arm down. Soft foam and bubbles,
// in bright toy colours.
export function weapon(kind) {
  const g = new THREE.Group();
  g.name = `weapon ${kind}`;
  g.rotation.x = Math.PI / 2;
  switch (kind) {
    case 'sword':
      g.add(
        mesh(cylinder(0.028, 0.028, 0.14, 10), toon('#ffcf3f'), 0, 0.02, 0),
        mesh(sphere(), toon('#ff7fb2'), 0, -0.06, 0, 0.04),
        mesh(capsule(0.03, 0.04), toon('#ff7fb2'), 0, 0.1, 0, 3.2, 0.5, 1.2),
        mesh(capsule(0.042, 0.42), toon('#5fb8f4'), 0, 0.36, 0, 1, 1, 0.55),
      );
      break;
    case 'blaster':
      g.add(
        mesh(cylinder(0.03, 0.03, 0.14, 10), toon('#9b7bea'), 0, -0.02, -0.06),
        mesh(capsule(0.065, 0.2), toon('#9b7bea'), 0, 0.12, 0),
        mesh(sphere(), toon('#bff3ff', { transparent: true, opacity: 0.75 }), 0, 0.1, 0.09, 0.07),
        mesh(cylinder(0.05, 0.035, 0.08, 14), toon('#ffcf3f'), 0, 0.28, 0),
        mesh(torus(0.045, 0.012), toon('#ff7fb2'), 0, 0.33, 0),
      );
      break;
    case 'hammer': {
      g.add(mesh(cylinder(0.026, 0.026, 0.42, 10), toon('#ffcf3f'), 0, 0.16, 0));
      const head = new THREE.Group();
      head.position.y = 0.4;
      head.rotation.z = Math.PI / 2;
      head.add(
        mesh(cylinder(0.1, 0.1, 0.28, 18), toon('#ff7fb2'), 0, 0, 0),
        mesh(cylinder(0.11, 0.11, 0.03, 18), toon('#ffffff'), 0, 0.14, 0),
        mesh(cylinder(0.11, 0.11, 0.03, 18), toon('#ffffff'), 0, -0.14, 0),
      );
      // A star on the side, like a sticker.
      const star = mesh(cylinder(0.07, 0.07, 0.02, 5), toon('#ffd23f', { emissive: 0.25 }), 0, 0, 0.1);
      star.rotation.x = Math.PI / 2;
      head.add(star);
      g.add(head);
      break;
    }
    default:
      return null;
  }
  return g;
}

function hat(head, kind, shirt, lift = 0) {
  const top = HR[1];
  const g = new THREE.Group();
  g.position.set(0, top * 0.72 + lift, 0);
  const add = (...ms) => ms.forEach((m) => g.add(m));
  switch (kind) {
    case 'cap': {
      const dome = new THREE.Mesh(new THREE.SphereGeometry(0.3, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), toon(shirt));
      dome.scale.set(1.2, 0.8, 1.15);
      add(dome);
      // A band round the base, and a brim reaching forward over the eyes.
      add(mesh(torus(0.29, 0.024), toon(darken(shirt, 0.2)), 0, 0.02, 0, 1.16, 1, 1.11).rotateX(Math.PI / 2));
      add(mesh(roundedBox(0.34, 0.024, 0.24, 0.012), toon(shirt), 0, 0.015, 0.3));
      add(mesh(sphere(1, 12, 8), toon(darken(shirt, 0.2)), 0, 0.235, 0, 0.034));
      break;
    }
    case 'flower': {
      const f = new THREE.Group();
      f.position.set(0.22, 0.08, 0.12);
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        const petal = mesh(sphere(1, 14, 10), toon(i % 2 ? '#ff9fce' : '#ff8fc4'), Math.cos(a) * 0.062, Math.sin(a) * 0.062, 0, 0.048, 0.048, 0.024);
        petal.rotation.z = a;
        f.add(petal);
      }
      f.add(mesh(sphere(1, 12, 8), toon('#ffd84d'), 0, 0, 0.017, 0.036, 0.036, 0.02));
      const leaf = mesh(sphere(1, 12, 8), toon('#5fae4e'), 0.05, -0.03, -0.01, 0.05, 0.022, 0.026);
      leaf.rotation.z = 0.7;
      f.add(leaf);
      f.rotation.y = 0.5;
      add(f);
      break;
    }
    case 'bow': {
      const b = new THREE.Group();
      b.position.set(0.16, 0.12, 0.05);
      b.rotation.z = -0.3;
      // Each loop of the bow in two lobes, with a knot in the middle and two tails.
      for (const side of [-1, 1]) {
        b.add(mesh(sphere(1, 16, 12), toon('#ff5f8f'), side * 0.075, 0.018, 0, 0.072, 0.052, 0.038));
        b.add(mesh(sphere(1, 16, 12), toon('#ff5f8f'), side * 0.075, -0.028, 0, 0.062, 0.044, 0.034));
        const tail = mesh(capsule(0.016, 0.07), toon('#e0406f'), side * 0.05, -0.075, 0.005);
        tail.rotation.z = side * 0.5;
        b.add(tail);
      }
      b.add(mesh(sphere(1, 12, 8), toon('#e0406f'), 0, 0, 0.012, 0.034, 0.03, 0.026));
      add(b);
      break;
    }
    case 'party': {
      const c = mesh(cone(0.13, 0.32, 18), toon(shirt), 0, 0.2, 0);
      add(c, mesh(sphere(1, 14, 10), toon('#ffd84d'), 0, 0.37, 0, 0.05));
      for (let i = 0; i < 3; i++) add(mesh(torus(0.1 - i * 0.03, 0.012), toon(WHITE), 0, 0.09 + i * 0.08, 0).rotateX(Math.PI / 2));
      // A ruffle round the base, where the hat sits on the head.
      add(mesh(torus(0.115, 0.028, Math.PI * 2), toon(lighten(shirt, 0.3)), 0, 0.045, 0).rotateX(Math.PI / 2));
      break;
    }
    case 'crown': {
      const gold = toon('#ffcf3f', { emissive: 0.15 });
      add(mesh(cylinder(0.17, 0.17, 0.08, 20, true), gold, 0, 0.06, 0));
      add(mesh(torus(0.168, 0.012), gold, 0, 0.022, 0).rotateX(Math.PI / 2));
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        add(mesh(cone(0.04, 0.09, 4), gold, Math.cos(a) * 0.16, 0.14, Math.sin(a) * 0.16));
      }
      // A jewel at each point, and one big one at the front.
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2 + Math.PI / 6;
        add(mesh(sphere(1, 10, 8), toon(i % 2 ? '#4fc3f7' : '#ff4f6f', { emissive: 0.2 }), Math.cos(a) * 0.16, 0.085, Math.sin(a) * 0.16, 0.022));
      }
      add(mesh(sphere(1, 12, 8), toon('#ff4f6f', { emissive: 0.25 }), 0, 0.06, 0.17, 0.03));
      break;
    }
    case 'beanie': {
      const dome = new THREE.Mesh(new THREE.SphereGeometry(0.3, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), toon(shirt));
      dome.scale.set(1.18, 0.9, 1.12);
      add(dome);
      // Ribs running up the knit, and a turned-up brim.
      const ribs = [];
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        const { p, out } = onHead(0.5, Math.PI / 2 - a, 1.16 * 1.18);
        const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), out);
        ribs.push({ g: capsule(0.008, 0.2), m: new THREE.Matrix4().compose(p, q, new THREE.Vector3(1, 1, 1)) });
      }
      add(mesh(bakeCached(`beanie-ribs|${shirt}`, ribs), toon(darken(shirt, 0.15))));
      add(mesh(torus(0.33, 0.045), toon(lighten(shirt, 0.35)), 0, 0.02, 0, 1.05, 1, 1).rotateX(Math.PI / 2));
      add(mesh(sphere(1, 14, 10), toon(WHITE), 0, 0.3, 0, 0.07), mesh(sphere(1, 10, 8), toon('#f0e8e0'), 0.02, 0.33, 0.01, 0.035));
      break;
    }
    case 'sprout': {
      add(mesh(cylinder(0.012, 0.012, 0.14, 6), toon('#4fae3e'), 0, 0.22, 0));
      for (const side of [-1, 1]) {
        const l = mesh(sphere(1, 14, 10), toon(side > 0 ? '#6fcf55' : '#5fbf49'), side * 0.07, 0.3, 0, 0.08, 0.035, 0.04);
        l.rotation.z = side * 0.4;
        add(l);
      }
      const bud = mesh(sphere(1, 10, 8), toon('#8fe072'), 0, 0.31, 0.02, 0.024);
      add(bud);
      break;
    }
    case 'straw': {
      const straw = toon('#f2d27a');
      add(mesh(cylinder(0.42, 0.42, 0.025, 28), straw, 0, 0.02, 0));
      // The weave: rings of ridges on the brim, all as one shape.
      const weave = [];
      for (let i = 0; i < 14; i++) {
        const a = (i / 14) * Math.PI * 2;
        weave.push({ g: capsule(0.008, 0.13), m: new THREE.Matrix4().makeRotationY(a).setPosition(Math.cos(a) * 0.31, 0.033, Math.sin(a) * 0.31) });
      }
      add(mesh(bakeCached('straw-weave', weave), toon('#dabc5f')));
      const dome = new THREE.Mesh(new THREE.SphereGeometry(0.24, 22, 12, 0, Math.PI * 2, 0, Math.PI / 2), straw);
      dome.scale.set(1.1, 0.8, 1.1);
      add(dome, mesh(cylinder(0.25, 0.25, 0.05, 24), toon('#ff6f8f'), 0, 0.04, 0));
      add(mesh(torus(0.252, 0.012), toon('#e05580'), 0, 0.062, 0).rotateX(Math.PI / 2));
      break;
    }
    case 'headphones': {
      const band = mesh(torus(0.34, 0.025, Math.PI), toon(shirt), 0, -0.1, 0);
      add(band);
      // A padded band riding just over it, and cups with cushions that meet the head.
      add(mesh(torus(0.345, 0.033, Math.PI), toon(darken(shirt, 0.15)), 0, -0.1, 0));
      for (const side of [-1, 1]) {
        add(mesh(cylinder(0.09, 0.09, 0.06, 18), toon(darken(shirt, 0.2)), side * 0.35, -0.12, 0).rotateZ(Math.PI / 2));
        add(mesh(torus(0.072, 0.02), toon('#3d3644'), side * 0.385, -0.12, 0).rotateY(Math.PI / 2));
        add(mesh(sphere(1, 12, 8), toon(lighten(shirt, 0.25)), side * 0.315, -0.12, 0, 0.028, 0.05, 0.05));
      }
      break;
    }
    default:
      return null;
  }
  head.add(g);
  return g;
}

export class Avatar {
  constructor(look, { name = '' } = {}) {
    this.root = new THREE.Group();
    this.root.name = `avatar ${name}`;
    this.look = null;
    this.phase = 0;
    this.blinkAt = 2 + Math.random() * 3;
    this.emote = null;
    this.emoteAt = 0;
    this.time = 0;
    this.anim = ANIM.idle;
    this.speed = 0;
    // On an animal: how far round it the legs reach (see shared/critters.js).
    this.ride = null;
    this.setLook(look);
    // A soft round shadow under the feet.
    const shadow = blobShadow(0.42);
    shadow.position.y = 0.02;
    this.shadow = shadow;
  }

  setLook(full) {
    // A pet goes along beside you (render/pet-models.js), not on you.
    const { pet: _, ...look } = full;
    const same = this.look && JSON.stringify(this.look) === JSON.stringify(look);
    if (same) return;
    this.look = { ...look };
    if (this.body) this.root.remove(this.body);
    this.curlFit = null;
    const kid = isPerson(look);
    const grown = look.animal === GROWN_UP;
    // How much taller a grown-up is than a kid: their legs, then the rest.
    this.tall = lookTall(look);
    const legLong = this.tall * 0.55;
    this.legLong = legLong;
    const up = this.tall - legLong;
    // Sitting down, only the top half is taller.
    this.sitTall = up;
    const armLong = grown ? 0.09 : 0;
    // A kid's (or a grown-up's) skin is where an animal's fur is: face, neck and hands.
    const fur = kid ? (SKIN_TONES[look.skin] ?? SKIN_TONES.golden) : (FUR_COLORS[look.fur] ?? FUR_COLORS.white);
    const shirt = shirtColor(look.shirt);
    const body = new THREE.Group();
    this.body = body;
    this.root.add(body);

    this.legs = [-1, 1].map((side) => {
      const leg = new THREE.Group();
      leg.position.set(side * 0.1, 0.28 + legLong, 0);
      // Trouser legs, tapering to the ankle; a frog's legs are its skin.
      const trouser = look.animal === 'frog' ? fur : darken(shirt, 0.35);
      leg.add(mesh(cylinder(0.062, 0.05, 0.2 + legLong, 14), toon(trouser), 0, -0.1 - legLong / 2, 0));
      // The shorts, a little wider, ending above the knee.
      leg.add(mesh(cylinder(0.082, 0.075, 0.1, 14), toon(trouser), 0, -0.05 - legLong * 0.15, 0));
      // A shoe: a rounded sole, a toe cap over it and a little heel behind.
      const shoe = look.animal === 'frog' ? darken(fur, 0.1) : '#6b4a3a';
      leg.add(mesh(roundedBox(0.17, 0.055, 0.27, 0.024), toon(shoe), 0, -0.265 - legLong, 0.035));
      leg.add(mesh(sphere(1, 16, 12), toon(lighten(shoe, 0.18)), 0, -0.245 - legLong, 0.115, 0.072, 0.05, 0.075));
      leg.add(mesh(sphere(1, 12, 8), toon(shoe), 0, -0.25 - legLong, -0.06, 0.06, 0.045, 0.05));
      body.add(leg);
      return leg;
    });
    this.torso = new THREE.Group();
    this.torso.position.y = 0.28 + legLong;
    body.add(this.torso);
    // A shirt with a shape of its own: shoulders, a waist, a hem that flares.
    this.torso.add(
      mesh(
        lathe([
          [0.015, -0.05],
          [0.13, -0.05],
          [0.16, 0.04],
          [0.15, 0.12 + up * 0.4],
          [0.158, 0.22 + up * 0.55],
          [0.152, 0.32 + up * 0.75],
          [0.135, 0.4 + up * 0.9],
          [0.085, 0.46 + up],
          [0.06, 0.5 + up],
        ]),
        toon(shirt),
        0,
        0,
        0,
        grown ? 1.08 : 1,
        1,
        0.85,
      ),
    );
    // A hem band at the bottom of the shirt, and two little buttons down the front.
    this.torso.add(mesh(torus(0.148, 0.016), toon(darken(shirt, 0.22)), 0, 0.0, 0, grown ? 1.08 : 1, 1, 0.85).rotateX(Math.PI / 2));
    this.torso.add(mesh(sphere(1, 10, 8), toon(lighten(shirt, 0.4)), 0, 0.3 + up * 0.7, 0.128, 0.016));
    this.torso.add(mesh(sphere(1, 10, 8), toon(lighten(shirt, 0.4)), 0, 0.2 + up * 0.55, 0.14, 0.016));
    // A little collar in the fur colour, so the head sits nicely.
    this.torso.add(mesh(sphere(), toon(fur), 0, 0.44 + up, 0, 0.14, 0.06, 0.12));
    this.arms = [-1, 1].map((side) => {
      const arm = new THREE.Group();
      arm.position.set(side * (grown ? 0.245 : 0.23), 0.4 + up, 0);
      arm.rotation.z = side * 0.18;
      // A sleeve to past the elbow, a cuff, and a bare forearm to the hand.
      arm.add(mesh(capsule(0.066, 0.1 + armLong), toon(shirt), 0, -0.06 - armLong / 2, 0));
      arm.add(mesh(torus(0.058, 0.014), toon(darken(shirt, 0.18)), 0, -0.12 - armLong, 0).rotateX(Math.PI / 2));
      arm.add(mesh(cylinder(0.045, 0.04, 0.08, 12), toon(fur), 0, -0.17 - armLong, 0));
      // A mitten hand with a thumb at the side.
      arm.add(mesh(sphere(1, 16, 12), toon(fur), 0, -0.225 - armLong, 0, 0.062, 0.068, 0.055));
      arm.add(mesh(sphere(1, 10, 8), toon(fur), side * 0.052, -0.215 - armLong, 0.012, 0.024, 0.034, 0.024));
      this.torso.add(arm);
      return arm;
    });
    // A toy weapon in the right hand.
    this.weapon = look.weapon ? weapon(look.weapon) : null;
    this.weaponKind = this.weapon ? look.weapon : null;
    if (this.weapon) {
      this.weapon.position.set(0, -0.24 - armLong, 0.02);
      this.arms[1].add(this.weapon);
    }
    this.head = new THREE.Group();
    this.head.position.y = 0.5 + up;
    this.torso.add(this.head);
    const skull = new THREE.Group();
    skull.position.y = 0.3;
    this.head.add(skull);
    this.skull = skull;
    skull.add(mesh(sphere(HEAD_R, 28, 20), toon(fur), 0, 0, 0, HEAD.sx, HEAD.sy, HEAD.sz));
    if (kid) {
      const hairColor = HAIR_COLORS[look.hairColor] ?? HAIR_COLORS.brown;
      this.eyes = kidFace(skull, fur, { ears: look.hair !== 'bob' && look.hair !== 'long', grown, extra: grown ? (look.face ?? 'none') : 'none', hairColor });
      this.sway = hair(skull, look.hair, hairColor, look.hat);
    } else {
      ears(skull, look.animal, fur);
      this.eyes = face(skull, look.animal, fur);
      this.sway = [];
    }
    this.hat = hat(skull, look.hat, shirt, kid ? (look.hair === 'curly' ? 0.07 : 0.025) : 0);
    this.tail = tail(this.torso, look.animal, fur);
    this.root.traverse((o) => {
      if (o.isMesh) o.castShadow = false;
    });
  }

  // A swing at a monster, with whatever is in hand (see SWINGS). Returns how
  // long until it lands, in seconds.
  swing() {
    this.swingAt = this.time;
    const swing = SWINGS[this.weaponKind] ?? SWINGS.punch;
    return swing.secs * swing.strike;
  }

  playEmote(key) {
    this.emote = key;
    this.emoteAt = this.time;
  }

  // anim: one of ANIM; speed: ground speed (for the walk cycle, and the
  // bounce in the saddle).
  update(dt, anim, speed) {
    this.time += dt;
    const t = this.time;
    this.anim = anim;
    const moving = anim === ANIM.walk || anim === ANIM.run;
    const riding = anim === ANIM.ride;
    this.phase += dt * (moving ? 3.2 + speed * 1.6 : 0);
    const s = Math.sin(this.phase);
    const [legL, legR] = this.legs;
    const [armL, armR] = this.arms;
    // Rest pose.
    let bob = 0;
    let lean = 0;
    let legSwing = 0;
    let armSwing = 0;
    let armRaiseL = 0.18;
    let armRaiseR = 0.18;
    let armFwdL = 0;
    let armFwdR = 0;
    let spin = 0;
    let headTilt = 0;
    let headNod = 0;

    if (moving) {
      const k = anim === ANIM.run ? 1 : 0.75;
      legSwing = s * 0.7 * k;
      armSwing = -s * 0.6 * k;
      bob = Math.abs(s) * 0.05 * k;
      lean = 0.08 * k;
    } else if (anim === ANIM.air) {
      legSwing = 0.3;
      armRaiseL = armRaiseR = 1.4;
    } else if (anim === ANIM.swim) {
      lean = 0.5;
      armFwdL = Math.sin(t * 6) * 0.9 - 1.2;
      armFwdR = Math.sin(t * 6 + Math.PI) * 0.9 - 1.2;
      legSwing = Math.sin(t * 8) * 0.4;
      bob = Math.sin(t * 3) * 0.04 - 0.35;
    } else if (anim === ANIM.fly) {
      armRaiseL = armRaiseR = 1.25;
      lean = 0.25;
      bob = Math.sin(t * 2.5) * 0.06;
      legSwing = 0.15;
    } else if (anim === ANIM.dizzy) {
      // Sat down with a bump, head going round and round.
      bob = -0.24 - this.legLong;
      lean = -0.12;
      armRaiseL = armRaiseR = 0.55;
      armFwdL = armFwdR = -0.35;
      headTilt = Math.sin(t * 5) * 0.28;
      headNod = 0.12 + Math.cos(t * 5) * 0.1;
    } else if (anim === ANIM.sit) {
      // Sitting back in the seat, hands in the lap, looking about now and then.
      bob = -0.24 - this.legLong;
      lean = -0.05;
      armRaiseL = armRaiseR = 0.2;
      armFwdL = armFwdR = -0.55;
      headTilt = Math.sin(t * 0.7) * 0.06;
      headNod = Math.sin(t * 0.45) * 0.05;
    } else if (anim === ANIM.curl) {
      // Hugging your knees, chin tucked in, breathing slowly.
      bob = 0;
      armRaiseL = armRaiseR = 0.15;
      armFwdL = armFwdR = -1.25 + Math.sin(t * 1.6) * 0.02;
      headNod = 0.65;
    } else if (anim === ANIM.lie) {
      // Flat on your back, arms by your sides, breathing slowly.
      bob = Math.sin(t * 1.6) * 0.006;
      armRaiseL = armRaiseR = 0.12;
    } else if (riding) {
      // Astride an animal, hands forward on the reins (or its neck), going
      // up and down with it, more the faster it goes.
      const k = Math.min(1, speed / 8);
      this.phase += dt * (speed > 0.4 ? 5 + speed * 1.2 : 0);
      // Hips where a kid's would be, longer legs reaching further down its sides.
      bob = Math.abs(Math.sin(this.phase)) * (0.015 + k * 0.06) - this.legLong;
      lean = 0.1 + k * 0.15;
      armFwdL = armFwdR = -0.8 - Math.sin(this.phase) * 0.12 * k;
      armRaiseL = armRaiseR = 0.22;
    } else {
      bob = Math.sin(t * 2) * 0.008;
      armRaiseL = armRaiseR = 0.18 + Math.sin(t * 2) * 0.03;
    }

    // Emotes play over the pose for a few seconds.
    let hop = 0;
    if (this.emote) {
      const e = t - this.emoteAt;
      const done = e > (this.emote === 'dance' ? 3.2 : 2.2);
      if (done) this.emote = null;
      else {
        switch (this.emote) {
          case 'wave':
            armRaiseR = 2.6;
            armFwdR = Math.sin(e * 12) * 0.35;
            headTilt = 0.15;
            break;
          case 'dance':
            spin = e * Math.PI * 1.3;
            hop = Math.abs(Math.sin(e * 7)) * 0.12;
            armRaiseL = 2.2 + Math.sin(e * 7) * 0.5;
            armRaiseR = 2.2 - Math.sin(e * 7) * 0.5;
            legSwing = Math.sin(e * 7) * 0.4;
            break;
          case 'cheer':
            armRaiseL = armRaiseR = 2.7;
            hop = Math.max(0, Math.sin(e * 6)) * 0.3;
            break;
          case 'hearts':
            headTilt = Math.sin(e * 3) * 0.2;
            armFwdL = armFwdR = -0.9;
            armRaiseL = armRaiseR = -0.35;
            break;
          case 'clap': {
            const c = Math.abs(Math.sin(e * 10));
            armFwdL = armFwdR = -1.3;
            armRaiseL = -0.5 * c - 0.05;
            armRaiseR = -0.5 * c - 0.05;
            break;
          }
          case 'sleepy':
            headTilt = 0.35;
            headNod = 0.25 + Math.sin(e * 2) * 0.05;
            break;
          case 'laugh':
            headNod = -0.3;
            bob = Math.abs(Math.sin(e * 16)) * 0.03;
            armFwdL = armFwdR = -0.6;
            armRaiseL = armRaiseR = -0.2;
            break;
          case 'surprise':
            hop = Math.max(0, Math.sin(Math.min(e, 0.6) * 5.2)) * 0.18;
            armRaiseL = armRaiseR = 1.1;
            headNod = -0.2;
            break;
          default:
            break;
        }
      }
    }

    // A swing (see SWINGS), over whatever the avatar is doing: the arms blend
    // into it and back out, the shoulders twist, it leans in and steps in.
    let twist = 0;
    let dip = 0;
    let step = 0;
    let wrist = 0;
    const swing = SWINGS[this.weaponKind] ?? SWINGS.punch;
    const swung = t - (this.swingAt ?? -Infinity);
    if (swung < swing.secs) {
      const p = swingPose(swing, swung / swing.secs);
      // The walking arm swing fades out while it swings.
      armFwdR = armFwdR + (p.fwd + armSwing - armFwdR) * p.w;
      armRaiseR = armRaiseR + (p.raise - armRaiseR) * p.w;
      wrist = p.wrist * p.w;
      if (p.wL) {
        armFwdL = armFwdL + (p.fwdL - armSwing - armFwdL) * p.wL;
        armRaiseL = armRaiseL + (p.raiseL - armRaiseL) * p.wL;
      }
      twist = p.twist;
      lean += p.lean;
      dip = p.dip;
      headNod += p.nod;
      step = p.step;
    }

    // Riding, the legs reach round the animal's sides and a little forward;
    // on a wide back, out in front.
    const spread = riding ? (this.ride?.spread ?? 0.85) : 0;
    const reach = riding ? (this.ride?.reach ?? 0.35) : 0;
    // A step in to swing only standing; walking, the legs are busy.
    const stepIn = anim === ANIM.idle ? step : 0;
    legL.rotation.set(riding ? -reach : legSwing - stepIn, 0, -spread);
    legR.rotation.set(riding ? -reach : -legSwing + stepIn * 0.6, 0, spread);
    if (anim === ANIM.dizzy) {
      // Legs out in front, sitting.
      legL.rotation.set(-1.4, 0, -0.18);
      legR.rotation.set(-1.4, 0, 0.18);
      spin = 0;
      hop = 0;
    }
    const curled = anim === ANIM.curl;
    const sitting = anim === ANIM.sit || curled;
    const lying = anim === ANIM.lie;
    if (sitting) {
      // Legs out over the front of the seat, a little apart (curled up,
      // drawn right up).
      legL.rotation.set(curled ? -1.7 : -1.35, 0, -0.08);
      legR.rotation.set(curled ? -1.7 : -1.35, 0, 0.08);
    }
    if (lying) {
      legL.rotation.set(0, 0, -0.04);
      legR.rotation.set(0, 0, 0.04);
    }
    if (sitting || lying) {
      // Emotes play with the arms and the head, but nobody spins or hops out of bed.
      spin = 0;
      hop = 0;
    }
    if (riding) {
      // Nor do emotes turn them round or lift them out of the saddle.
      spin = 0;
      hop = 0;
    }
    // The arms hang from mirrored shoulders, so each side opens outward with its own sign.
    armL.rotation.set(armSwing + armFwdL, 0, -(armRaiseL ?? 0.18));
    armR.rotation.set(-armSwing + armFwdR, 0, armRaiseR ?? 0.18);
    this.body.position.y = bob + hop + dip;
    // In bed, the whole of you tips back about your feet, face up, and sinks
    // to lie on your back.
    this.body.rotation.set(lying || curled ? -Math.PI / 2 : 0, curled ? Math.PI / 2 : spin, 0);
    this.body.position.x = 0;
    this.body.position.z = 0;
    this.body.scale.setScalar(1);
    if (lying) this.body.position.y += LIE_LIFT;
    this.torso.rotation.set(lean, twist, 0);
    if (this.weapon) this.weapon.rotation.x = Math.PI / 2 + wrist;
    this.head.rotation.set(headNod, 0, headTilt);
    if (this.tail) this.tail.rotation.y = Math.sin(t * (moving ? 10 : 3)) * 0.3;
    // A ponytail swings to and fro, pigtails from side to side; more on the move.
    for (const b of this.sway) {
      const { side, rest } = b.userData;
      const swing = Math.sin(t * (moving ? 9 : 2.2) + side) * (moving ? 0.2 : 0.05);
      if (side) b.rotation.z = rest + swing * side;
      else b.rotation.x = rest + swing;
    }
    if (curled) {
      // Curled up on your side (turned a quarter round, then tipped back),
      // shrunk to fit the bed and moved so all of you is in the middle of it:
      // measured once the whole pose is set.
      const fit = (this.curlFit ??= this.measureCurl());
      this.body.scale.setScalar(fit.scale);
      this.body.position.set(fit.x, fit.y, fit.z);
    }
    // Blink now and then.
    if (this.eyes) {
      this.blinkAt -= dt;
      const closed = this.blinkAt < 0.12 || this.emote === 'sleepy' || this.emote === 'laugh' || ((lying || curled) && !this.emote);
      this.eyes.scale.y = closed ? 0.12 : 1;
      if (this.blinkAt < 0) this.blinkAt = 2.5 + Math.random() * 3;
    }
  }

  // How the curled-up pose (already set on the body, at full size) has to be
  // shrunk and moved to fit CURL_ROOM, centred on the root and resting on it.
  measureCurl() {
    const { root } = this;
    const [p, r] = [root.position.clone(), root.rotation.clone()];
    root.position.set(0, 0, 0);
    root.rotation.set(0, 0, 0);
    this.body.position.set(0, 0, 0);
    this.body.scale.setScalar(1);
    root.updateMatrixWorld(true);
    // Only what shows: a weapon put away or a hidden hat does not count.
    const box = new THREE.Box3();
    const part = new THREE.Box3();
    const visit = (o) => {
      if (!o.visible) return;
      if (o.isMesh) {
        if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
        box.union(part.copy(o.geometry.boundingBox).applyMatrix4(o.matrixWorld));
      }
      for (const c of o.children) visit(c);
    };
    visit(this.body);
    root.position.copy(p);
    root.rotation.copy(r);
    root.updateMatrixWorld(true);
    const size = box.getSize(new THREE.Vector3());
    const scale = Math.min(1, CURL_ROOM.long / size.z, CURL_ROOM.wide / size.x);
    const mid = box.getCenter(new THREE.Vector3());
    return { scale, x: -mid.x * scale, y: -box.min.y * scale, z: -mid.z * scale };
  }

  dispose() {
    this.root.removeFromParent();
    this.shadow.removeFromParent();
    this.shadow.geometry.dispose();
    this.shadow.material.dispose();
  }
}

export const shirtHex = (index) => shirtColor(index);
export const brickIdForShirt = (index) => TOY_BRICKS[index];
