// The capsule toys (shared/gashapon.js TOYS) as little vinyl figures, the
// kind that come out of a real capsule: round and chunky, glossy, with
// shiny black eyes. Each is about one unit tall, standing on the origin and
// facing -z, made of simple rounded shapes.
//
// mat(colour, extra) gives the material for a colour (extra: three's
// physical material settings on top, such as metalness), so whoever shows
// a toy lights it in its own WebGL context.
import * as THREE from '../../vendor/three.module.js';
import { monsterFigure } from './monster-figures.js';

const g = {
  sphere: new THREE.SphereGeometry(1, 28, 20),
  cyl: new THREE.CylinderGeometry(1, 1, 1, 24),
  cone: new THREE.ConeGeometry(1, 1, 24),
  box: new THREE.BoxGeometry(1, 1, 1),
  torus: new THREE.TorusGeometry(1, 0.3, 12, 32, Math.PI),
  ring: new THREE.TorusGeometry(1, 0.12, 10, 36),
};

const EYE = '#1d1a22';
const WHITE = '#ffffff';
const CHEEK = '#ff9db8';

// One shape, placed: geometry, colour, position, scale ([x, y, z] or one
// number) and turn (Euler, radians).
function part(group, mat, geo, color, [x, y, z], s = 1, [rx, ry, rz] = [0, 0, 0], extra) {
  const m = new THREE.Mesh(geo, mat(color, extra));
  m.position.set(x, y, z);
  if (Array.isArray(s)) m.scale.set(...s);
  else m.scale.setScalar(s);
  m.rotation.set(rx, ry, rz);
  group.add(m);
  return m;
}

// Two shiny eyes with a gleam, on the front of a head centred at (0, y, z),
// `gap` apart, each `r` across.
function eyes(group, mat, y, z, gap, r = 0.055) {
  for (const sx of [-1, 1]) {
    part(group, mat, g.sphere, EYE, [sx * gap, y, z], [r, r * 1.2, r * 0.6]);
    part(group, mat, g.sphere, WHITE, [sx * gap - r * 0.3, y + r * 0.45, z - r * 0.45], r * 0.32);
  }
}

function cheeks(group, mat, y, z, gap, r = 0.045) {
  for (const sx of [-1, 1]) part(group, mat, g.sphere, CHEEK, [sx * gap, y, z], [r, r * 0.6, r * 0.3]);
}

const TOYS = {
  dino(t, mat) {
    const C = '#5cc463';
    part(t, mat, g.sphere, C, [0, 0.36, 0.06], [0.27, 0.25, 0.34]);
    part(t, mat, g.sphere, '#c8f0a0', [0, 0.33, -0.12], [0.19, 0.18, 0.16]);
    part(t, mat, g.sphere, C, [0, 0.7, -0.14], 0.21);
    part(t, mat, g.sphere, C, [0, 0.64, -0.3], [0.15, 0.11, 0.13]);
    eyes(t, mat, 0.76, -0.31, 0.085);
    cheeks(t, mat, 0.64, -0.38, 0.11);
    for (const sx of [-1, 1]) {
      part(t, mat, g.cyl, C, [sx * 0.14, 0.1, 0.04], [0.08, 0.2, 0.08]);
      part(t, mat, g.sphere, C, [sx * 0.14, 0.03, -0.02], [0.1, 0.05, 0.13]);
      part(t, mat, g.sphere, C, [sx * 0.2, 0.42, -0.2], [0.05, 0.05, 0.08], [0.6, 0, 0]);
    }
    part(t, mat, g.cone, C, [0, 0.3, 0.46], [0.14, 0.42, 0.14], [Math.PI / 2 + 0.25, 0, 0]);
    for (let i = 0; i < 5; i++) part(t, mat, g.cone, '#ffb13b', [0, 0.92 - i * 0.13 + (i > 1 ? 0.0 : 0), -0.18 + i * 0.13], [0.05, 0.1, 0.05], [0.5 + i * 0.25, 0, 0]);
  },

  octopus(t, mat) {
    const C = '#b56ad8';
    part(t, mat, g.sphere, C, [0, 0.6, 0.02], [0.3, 0.33, 0.3]);
    eyes(t, mat, 0.62, -0.26, 0.1, 0.07);
    cheeks(t, mat, 0.52, -0.27, 0.17);
    part(t, mat, g.torus, '#5a2b70', [0, 0.5, -0.29], [0.04, 0.04, 0.03], [0, 0, Math.PI]);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const leg = new THREE.Group();
      leg.position.set(Math.sin(a) * 0.18, 0.26, Math.cos(a) * 0.18);
      leg.rotation.y = a;
      part(leg, mat, g.torus, C, [0, -0.1, 0.1], [0.12, 0.12, 0.16], [0, Math.PI / 2, -Math.PI / 2]);
      t.add(leg);
    }
  },

  frog(t, mat) {
    const C = '#62c24a';
    part(t, mat, g.sphere, C, [0, 0.26, 0], [0.36, 0.25, 0.32]);
    part(t, mat, g.sphere, '#d9f5a8', [0, 0.2, -0.15], [0.25, 0.16, 0.16]);
    for (const sx of [-1, 1]) {
      part(t, mat, g.sphere, C, [sx * 0.17, 0.5, -0.08], 0.12);
      part(t, mat, g.sphere, WHITE, [sx * 0.17, 0.53, -0.16], [0.08, 0.08, 0.05]);
      part(t, mat, g.sphere, EYE, [sx * 0.17, 0.53, -0.2], [0.045, 0.05, 0.03]);
      part(t, mat, g.sphere, C, [sx * 0.3, 0.05, -0.16], [0.12, 0.04, 0.1]);
      part(t, mat, g.sphere, C, [sx * 0.3, 0.12, 0.12], [0.12, 0.1, 0.16]);
    }
    part(t, mat, g.torus, '#3a2a30', [0, 0.3, -0.31], [0.09, 0.05, 0.03], [0, 0, Math.PI]);
    cheeks(t, mat, 0.32, -0.29, 0.2);
  },

  robot(t, mat) {
    const M = { metalness: 0.7, roughness: 0.25 };
    const C = '#b8c3cf';
    part(t, mat, g.box, C, [0, 0.36, 0], [0.4, 0.34, 0.28], undefined, M);
    part(t, mat, g.box, '#ff6f61', [0, 0.38, -0.145], [0.18, 0.12, 0.01]);
    for (const [x, c] of [[-0.05, '#fcd535'], [0.05, '#62c4f5']]) part(t, mat, g.sphere, c, [x, 0.38, -0.15], 0.025);
    part(t, mat, g.box, C, [0, 0.72, 0], [0.38, 0.3, 0.3], undefined, M);
    for (const sx of [-1, 1]) {
      part(t, mat, g.sphere, '#5ff0ff', [sx * 0.09, 0.74, -0.15], [0.055, 0.055, 0.02], undefined, { emissive: new THREE.Color('#2fd8ff'), emissiveIntensity: 0.8 });
      part(t, mat, g.cyl, C, [sx * 0.25, 0.38, 0], [0.05, 0.26, 0.05], [0, 0, sx * 0.3], M);
      part(t, mat, g.sphere, '#7d8794', [sx * 0.3, 0.25, 0], 0.06, undefined, M);
      part(t, mat, g.cyl, '#7d8794', [sx * 0.1, 0.1, 0], [0.07, 0.2, 0.07], undefined, M);
      part(t, mat, g.sphere, '#7d8794', [sx * 0.21, 0.72, 0], [0.03, 0.07, 0.07], undefined, M);
    }
    part(t, mat, g.box, '#4a5260', [0, 0.65, -0.152], [0.14, 0.03, 0.01]);
    part(t, mat, g.cyl, '#7d8794', [0, 0.92, 0], [0.012, 0.12, 0.012], undefined, M);
    part(t, mat, g.sphere, '#ff4d4d', [0, 0.99, 0], 0.04, undefined, { emissive: new THREE.Color('#ff2020'), emissiveIntensity: 0.6 });
  },

  rocket(t, mat) {
    const body = new THREE.LatheGeometry(
      [[0.0, 0.12], [0.15, 0.12], [0.2, 0.25], [0.21, 0.45], [0.19, 0.62], [0.13, 0.76]].map(([x, y]) => new THREE.Vector2(x, y)),
      32,
    );
    part(t, mat, body, '#f7f5ef', [0, 0, 0]);
    part(t, mat, g.cone, '#e8453c', [0, 0.85, 0], [0.135, 0.2, 0.135]);
    part(t, mat, g.sphere, '#62c4f5', [0, 0.5, -0.19], [0.075, 0.075, 0.03], undefined, { roughness: 0.05, clearcoat: 1 });
    part(t, mat, g.ring, '#c9ced6', [0, 0.5, -0.195], 0.08, undefined, { metalness: 1, roughness: 0.2 });
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2 + Math.PI / 3;
      part(t, mat, g.box, '#e8453c', [Math.sin(a) * 0.22, 0.2, Math.cos(a) * 0.22], [0.03, 0.22, 0.14], [0, a, 0]);
    }
    part(t, mat, g.cone, '#ffb13b', [0, 0.04, 0], [0.11, 0.16, 0.11], [Math.PI, 0, 0], { emissive: new THREE.Color('#ff7a1a'), emissiveIntensity: 0.7 });
  },

  teddy(t, mat) {
    const C = '#b37a4c';
    const L = '#e7c39a';
    part(t, mat, g.sphere, C, [0, 0.3, 0], [0.26, 0.28, 0.24]);
    part(t, mat, g.sphere, L, [0, 0.28, -0.15], [0.15, 0.17, 0.1]);
    part(t, mat, g.sphere, C, [0, 0.68, 0], 0.22);
    part(t, mat, g.sphere, L, [0, 0.63, -0.18], [0.1, 0.08, 0.07]);
    part(t, mat, g.sphere, EYE, [0, 0.66, -0.245], [0.035, 0.028, 0.025]);
    eyes(t, mat, 0.74, -0.19, 0.08, 0.035);
    for (const sx of [-1, 1]) {
      part(t, mat, g.sphere, C, [sx * 0.16, 0.86, 0], 0.08);
      part(t, mat, g.sphere, L, [sx * 0.16, 0.86, -0.04], 0.045);
      part(t, mat, g.sphere, C, [sx * 0.26, 0.36, -0.06], [0.08, 0.13, 0.08], [0, 0, sx * 0.5]);
      part(t, mat, g.sphere, C, [sx * 0.14, 0.07, -0.08], [0.09, 0.08, 0.12]);
    }
    part(t, mat, g.sphere, '#e8453c', [-0.07, 0.5, -0.17], [0.06, 0.04, 0.03], [0, 0, 0.3]);
    part(t, mat, g.sphere, '#e8453c', [0.07, 0.5, -0.17], [0.06, 0.04, 0.03], [0, 0, -0.3]);
    part(t, mat, g.sphere, '#c4302a', [0, 0.5, -0.18], 0.025);
  },

  ghost(t, mat) {
    const C = '#f8f8ff';
    const body = new THREE.LatheGeometry(
      [[0.0, 0.12], [0.26, 0.12], [0.28, 0.3], [0.27, 0.55], [0.22, 0.75], [0.12, 0.86], [0.0, 0.89]].map(([x, y]) => new THREE.Vector2(x, y)),
      32,
    );
    part(t, mat, body, C, [0, 0, 0]);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      part(t, mat, g.sphere, C, [Math.sin(a) * 0.2, 0.12, Math.cos(a) * 0.2], 0.085);
    }
    part(t, mat, g.sphere, EYE, [-0.09, 0.56, -0.235], [0.045, 0.07, 0.03]);
    part(t, mat, g.sphere, EYE, [0.09, 0.56, -0.235], [0.045, 0.07, 0.03]);
    part(t, mat, g.sphere, WHITE, [-0.1, 0.59, -0.26], 0.014);
    part(t, mat, g.sphere, WHITE, [0.08, 0.59, -0.26], 0.014);
    part(t, mat, g.sphere, EYE, [0, 0.44, -0.255], [0.04, 0.05, 0.02]);
    cheeks(t, mat, 0.47, -0.24, 0.16);
    for (const sx of [-1, 1]) part(t, mat, g.sphere, C, [sx * 0.29, 0.42, -0.04], [0.08, 0.06, 0.07], [0, 0, sx * 0.6]);
  },

  chick(t, mat) {
    const C = '#ffd84a';
    part(t, mat, g.sphere, C, [0, 0.3, 0.02], [0.29, 0.28, 0.28]);
    part(t, mat, g.sphere, C, [0, 0.66, -0.04], 0.2);
    part(t, mat, g.cone, '#ff9a2e', [0, 0.62, -0.26], [0.055, 0.1, 0.04], [-Math.PI / 2, 0, 0]);
    eyes(t, mat, 0.7, -0.21, 0.08, 0.04);
    cheeks(t, mat, 0.6, -0.2, 0.13);
    for (const sx of [-1, 1]) {
      part(t, mat, g.sphere, '#ffc42e', [sx * 0.27, 0.34, 0.02], [0.07, 0.15, 0.13], [0, 0, sx * 0.4]);
      part(t, mat, g.sphere, '#ff9a2e', [sx * 0.1, 0.03, -0.06], [0.07, 0.03, 0.1]);
    }
    for (const [x, a] of [[-0.03, -0.4], [0.03, 0.4]]) part(t, mat, g.sphere, C, [x, 0.88, -0.02], [0.03, 0.08, 0.03], [0, 0, a]);
  },

  unicorn(t, mat) {
    const C = '#fbfaff';
    const MANE = ['#f9a8d4', '#c4b5fd', '#93c5fd'];
    part(t, mat, g.sphere, C, [0, 0.42, 0.08], [0.22, 0.2, 0.33]);
    for (const [x, z] of [[-0.12, -0.12], [0.12, -0.12], [-0.12, 0.26], [0.12, 0.26]]) {
      part(t, mat, g.cyl, C, [x, 0.17, z], [0.06, 0.3, 0.06]);
      part(t, mat, g.cyl, '#c9b3f0', [x, 0.03, z], [0.065, 0.05, 0.065]);
    }
    part(t, mat, g.sphere, C, [0, 0.62, -0.18], [0.11, 0.17, 0.11], [0.5, 0, 0]);
    part(t, mat, g.sphere, C, [0, 0.8, -0.27], [0.15, 0.15, 0.17]);
    part(t, mat, g.sphere, '#fde2ef', [0, 0.74, -0.41], [0.09, 0.07, 0.06]);
    eyes(t, mat, 0.84, -0.38, 0.085, 0.035);
    part(t, mat, g.cone, '#ffd23f', [0, 1.0, -0.33], [0.035, 0.2, 0.035], [-0.35, 0, 0], { metalness: 0.6, roughness: 0.25 });
    for (const sx of [-1, 1]) part(t, mat, g.cone, C, [sx * 0.08, 0.95, -0.2], [0.035, 0.08, 0.025], [0, 0, -sx * 0.3]);
    for (let i = 0; i < 5; i++) part(t, mat, g.sphere, MANE[i % 3], [0, 0.92 - i * 0.08, -0.17 + i * 0.05], 0.06 - i * 0.004);
    for (let i = 0; i < 3; i++) part(t, mat, g.sphere, MANE[i], [0, 0.5 - i * 0.08, 0.42 + i * 0.03], [0.05, 0.07, 0.05]);
  },

  whale(t, mat) {
    const C = '#3f88d8';
    part(t, mat, g.sphere, C, [0, 0.3, 0.04], [0.32, 0.27, 0.42]);
    part(t, mat, g.sphere, '#e3f1ff', [0, 0.17, -0.06], [0.24, 0.13, 0.32]);
    eyes(t, mat, 0.36, -0.33, 0.16, 0.035);
    cheeks(t, mat, 0.28, -0.34, 0.2);
    for (const sx of [-1, 1]) {
      part(t, mat, g.sphere, C, [sx * 0.3, 0.16, -0.04], [0.14, 0.03, 0.08], [0, sx * 0.5, sx * 0.4]);
      part(t, mat, g.sphere, C, [sx * 0.12, 0.42, 0.52], [0.14, 0.03, 0.08], [0.5, sx * 0.5, 0]);
    }
    part(t, mat, g.cone, C, [0, 0.33, 0.43], [0.09, 0.2, 0.09], [Math.PI / 2 - 0.4, 0, 0]);
    for (const [x, y, s] of [[0, 0.7, 0.05], [-0.06, 0.78, 0.035], [0.06, 0.78, 0.035], [0, 0.86, 0.03]]) {
      part(t, mat, g.sphere, '#a7dcff', [x, y, -0.05], s, undefined, { roughness: 0.05, clearcoat: 1, transparent: true, opacity: 0.85 });
    }
    part(t, mat, g.cyl, '#a7dcff', [0, 0.6, -0.05], [0.025, 0.12, 0.025], undefined, { transparent: true, opacity: 0.8 });
  },

  ufo(t, mat) {
    const M = { metalness: 0.85, roughness: 0.2 };
    const disc = new THREE.LatheGeometry(
      [[0.0, 0.18], [0.16, 0.2], [0.4, 0.3], [0.42, 0.33], [0.36, 0.38], [0.18, 0.42], [0.0, 0.43]].map(([x, y]) => new THREE.Vector2(x, y)),
      40,
    );
    part(t, mat, disc, '#c9ced6', [0, 0, 0], 1, undefined, M);
    part(t, mat, g.cyl, '#7d8794', [0, 0.13, 0], [0.12, 0.1, 0.12], undefined, M);
    part(t, mat, g.sphere, '#7be26b', [0, 0.53, 0], [0.09, 0.1, 0.09]);
    eyes(t, mat, 0.56, -0.08, 0.035, 0.022);
    for (const sx of [-1, 1]) part(t, mat, g.sphere, '#7be26b', [sx * 0.04, 0.66, 0], [0.01, 0.05, 0.01], [0, 0, -sx * 0.4]);
    part(t, mat, g.sphere, '#bfe9ff', [0, 0.42, 0], [0.2, 0.22, 0.2], undefined, { roughness: 0.03, clearcoat: 1, transparent: true, opacity: 0.35, depthWrite: false });
    const LIGHTS = ['#ff6f61', '#fcd535', '#62c4f5', '#9bd44a'];
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      const c = LIGHTS[i % 4];
      part(t, mat, g.sphere, c, [Math.sin(a) * 0.4, 0.31, Math.cos(a) * 0.4], 0.03, undefined, { emissive: new THREE.Color(c), emissiveIntensity: 0.9 });
    }
  },

  dragon(t, mat) {
    const GOLD = { metalness: 0.85, roughness: 0.22 };
    const C = '#f2b632';
    part(t, mat, g.sphere, C, [0, 0.36, 0.08], [0.25, 0.24, 0.32], undefined, GOLD);
    part(t, mat, g.sphere, '#ffe9a0', [0, 0.32, -0.1], [0.17, 0.17, 0.14], undefined, GOLD);
    part(t, mat, g.sphere, C, [0, 0.72, -0.14], 0.2, undefined, GOLD);
    part(t, mat, g.sphere, C, [0, 0.66, -0.31], [0.13, 0.1, 0.12], undefined, GOLD);
    eyes(t, mat, 0.78, -0.31, 0.085, 0.05);
    for (const sx of [-1, 1]) {
      part(t, mat, g.cone, '#fff4cc', [sx * 0.1, 0.94, -0.08], [0.035, 0.14, 0.035], [-0.4, 0, -sx * 0.4], GOLD);
      part(t, mat, g.cyl, C, [sx * 0.13, 0.1, 0.06], [0.075, 0.2, 0.075], undefined, GOLD);
      part(t, mat, g.sphere, C, [sx * 0.13, 0.03, 0.0], [0.09, 0.05, 0.12], undefined, GOLD);
      // A wing: a fan of three thin ribs with the skin over them.
      const wing = new THREE.Group();
      wing.position.set(sx * 0.12, 0.56, 0.22);
      wing.rotation.set(0.5, sx * -0.5, sx * -0.75);
      part(wing, mat, g.sphere, '#ff8a3d', [sx * 0.12, 0.1, 0], [0.13, 0.11, 0.012], undefined, { transparent: true, opacity: 0.9 });
      for (let i = 0; i < 3; i++) part(wing, mat, g.cyl, C, [sx * (0.06 + i * 0.05), 0.1 + i * 0.02, 0], [0.011, 0.2, 0.011], [0, 0, sx * (0.9 + i * 0.35)], GOLD);
      t.add(wing);
    }
    part(t, mat, g.cone, C, [0, 0.3, 0.46], [0.12, 0.42, 0.12], [Math.PI / 2 + 0.3, 0, 0], GOLD);
    part(t, mat, g.cone, '#e8453c', [0, 0.18, 0.66], [0.06, 0.1, 0.02], [Math.PI / 2, 0, 0]);
    for (let i = 0; i < 4; i++) part(t, mat, g.cone, '#e8453c', [0, 0.62 - i * 0.07, 0.0 + i * 0.12], [0.04, 0.08, 0.04], [0.6 + i * 0.2, 0, 0]);
  },

  penguin(t, mat) {
    const C = '#2b3442';
    part(t, mat, g.sphere, C, [0, 0.4, 0.02], [0.26, 0.36, 0.24]);
    part(t, mat, g.sphere, WHITE, [0, 0.38, -0.08], [0.2, 0.3, 0.17]);
    part(t, mat, g.sphere, C, [0, 0.76, 0], 0.18);
    part(t, mat, g.sphere, WHITE, [0, 0.74, -0.08], [0.13, 0.12, 0.11]);
    eyes(t, mat, 0.78, -0.17, 0.06, 0.035);
    cheeks(t, mat, 0.7, -0.17, 0.1, 0.03);
    part(t, mat, g.cone, '#ffa62b', [0, 0.71, -0.21], [0.04, 0.08, 0.03], [-Math.PI / 2, 0, 0]);
    for (const sx of [-1, 1]) {
      part(t, mat, g.sphere, C, [sx * 0.26, 0.42, 0.02], [0.05, 0.2, 0.1], [0, 0, sx * 0.35]);
      part(t, mat, g.sphere, '#ffa62b', [sx * 0.1, 0.03, -0.06], [0.08, 0.03, 0.11]);
    }
    part(t, mat, g.cyl, '#e8453c', [0, 0.6, 0], [0.19, 0.05, 0.19]);
    part(t, mat, g.box, '#e8453c', [0.12, 0.5, -0.12], [0.06, 0.16, 0.02], [0, 0, 0.2]);
  },

  luckycat(t, mat) {
    const C = '#fbf8f1';
    part(t, mat, g.sphere, C, [0, 0.32, 0], [0.27, 0.3, 0.24]);
    part(t, mat, g.sphere, C, [0, 0.72, -0.02], [0.24, 0.21, 0.21]);
    for (const sx of [-1, 1]) {
      part(t, mat, g.cone, C, [sx * 0.14, 0.92, -0.02], [0.07, 0.12, 0.05], [0, 0, -sx * 0.25]);
      part(t, mat, g.cone, '#ff9db8', [sx * 0.14, 0.91, -0.045], [0.04, 0.08, 0.02], [0, 0, -sx * 0.25]);
      // Eyes shut in a smile.
      part(t, mat, g.torus, EYE, [sx * 0.08, 0.74, -0.2], [0.035, 0.03, 0.02]);
    }
    cheeks(t, mat, 0.67, -0.19, 0.14);
    part(t, mat, g.sphere, '#ff9db8', [0, 0.69, -0.21], [0.022, 0.016, 0.015]);
    // The paw raised to beckon luck, and a gold coin held to the chest.
    part(t, mat, g.sphere, C, [0.2, 0.68, -0.12], [0.07, 0.11, 0.07], [0, 0, -0.3]);
    part(t, mat, g.sphere, C, [-0.16, 0.34, -0.2], [0.07, 0.07, 0.06]);
    part(t, mat, g.cyl, '#f5c542', [-0.06, 0.34, -0.23], [0.11, 0.02, 0.11], [Math.PI / 2, 0, 0], { metalness: 0.5, roughness: 0.25, emissive: new THREE.Color('#a87a10'), emissiveIntensity: 0.35 });
    part(t, mat, g.cyl, '#e8453c', [0, 0.53, 0], [0.2, 0.035, 0.18]);
    part(t, mat, g.sphere, '#f5c542', [0, 0.49, -0.18], 0.035, undefined, { metalness: 0.85, roughness: 0.2 });
    part(t, mat, g.sphere, '#f59331', [0.12, 0.42, 0.16], [0.1, 0.1, 0.06]);
  },

  turtle(t, mat) {
    const SHELL = '#3f9d58';
    const SKIN = '#9bd46a';
    part(t, mat, g.sphere, SHELL, [0, 0.24, 0.04], [0.34, 0.24, 0.36]);
    part(t, mat, g.cyl, '#e2c393', [0, 0.1, 0.04], [0.34, 0.05, 0.36]);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      part(t, mat, g.sphere, '#2f7d45', [Math.sin(a) * 0.17, 0.36, 0.04 + Math.cos(a) * 0.18], [0.08, 0.04, 0.08]);
    }
    part(t, mat, g.sphere, '#2f7d45', [0, 0.46, 0.04], [0.1, 0.04, 0.1]);
    part(t, mat, g.sphere, SKIN, [0, 0.3, -0.38], [0.14, 0.13, 0.14]);
    eyes(t, mat, 0.34, -0.5, 0.06, 0.03);
    cheeks(t, mat, 0.28, -0.5, 0.09, 0.025);
    for (const [x, z] of [[-0.25, -0.18], [0.25, -0.18], [-0.24, 0.28], [0.24, 0.28]]) part(t, mat, g.sphere, SKIN, [x, 0.08, z], [0.09, 0.06, 0.09]);
    part(t, mat, g.cone, SKIN, [0, 0.14, 0.42], [0.04, 0.1, 0.04], [Math.PI / 2, 0, 0]);
  },

  fox(t, mat) {
    const C = '#f2833a';
    part(t, mat, g.sphere, C, [0, 0.32, 0.04], [0.23, 0.27, 0.24]);
    part(t, mat, g.sphere, WHITE, [0, 0.3, -0.12], [0.14, 0.18, 0.1]);
    part(t, mat, g.sphere, C, [0, 0.7, -0.04], [0.22, 0.19, 0.2]);
    part(t, mat, g.cone, C, [0, 0.64, -0.24], [0.08, 0.14, 0.07], [-Math.PI / 2, 0, 0]);
    part(t, mat, g.sphere, WHITE, [0, 0.62, -0.2], [0.1, 0.06, 0.08]);
    part(t, mat, g.sphere, EYE, [0, 0.65, -0.31], 0.022);
    eyes(t, mat, 0.74, -0.18, 0.08, 0.035);
    for (const sx of [-1, 1]) {
      part(t, mat, g.cone, C, [sx * 0.12, 0.92, -0.02], [0.07, 0.15, 0.05], [0, 0, -sx * 0.2]);
      part(t, mat, g.cone, EYE, [sx * 0.125, 0.99, -0.02], [0.03, 0.05, 0.03], [0, 0, -sx * 0.2]);
      part(t, mat, g.sphere, '#3a2a30', [sx * 0.11, 0.05, -0.06], [0.07, 0.05, 0.1]);
    }
    // A big bushy tail curled round to the side, white at the tip.
    part(t, mat, g.sphere, C, [0.2, 0.28, 0.28], [0.12, 0.22, 0.12], [0.6, 0, -0.5]);
    part(t, mat, g.sphere, WHITE, [0.3, 0.46, 0.38], [0.08, 0.09, 0.08]);
  },

  phoenix(t, mat) {
    const SHINE = { metalness: 0.3, roughness: 0.2, clearcoat: 1 };
    const FIRE = ['#ff4d4d', '#ff8a3d', '#ffd23f', '#9bd44a', '#62c4f5', '#b56ad8'];
    part(t, mat, g.sphere, '#ff6a3d', [0, 0.42, 0.04], [0.2, 0.24, 0.24], undefined, SHINE);
    part(t, mat, g.sphere, '#ffb13b', [0, 0.38, -0.12], [0.13, 0.17, 0.1], undefined, SHINE);
    part(t, mat, g.sphere, '#ff6a3d', [0, 0.74, -0.08], 0.15, undefined, SHINE);
    part(t, mat, g.cone, '#ffd23f', [0, 0.71, -0.25], [0.04, 0.09, 0.03], [-Math.PI / 2 - 0.3, 0, 0], { metalness: 0.7, roughness: 0.2 });
    eyes(t, mat, 0.78, -0.2, 0.06, 0.03);
    // A crest of rainbow feathers, wings swept up, and a long tail of them.
    for (let i = 0; i < 3; i++) part(t, mat, g.cone, FIRE[i * 2], [(i - 1) * 0.05, 0.94, -0.04 + i * 0.02], [0.025, 0.14, 0.025], [0.3, 0, (i - 1) * 0.4], { emissive: new THREE.Color(FIRE[i * 2]), emissiveIntensity: 0.4 });
    for (const sx of [-1, 1]) {
      for (let i = 0; i < 5; i++) {
        const c = FIRE[i % FIRE.length];
        part(t, mat, g.sphere, c, [sx * (0.2 + i * 0.05), 0.55 + i * 0.07, 0.08], [0.04, 0.16, 0.02], [0, sx * 0.3, sx * (0.9 - i * 0.15)], { emissive: new THREE.Color(c), emissiveIntensity: 0.35 });
      }
      part(t, mat, g.cone, '#ffd23f', [sx * 0.07, 0.1, -0.02], [0.025, 0.2, 0.025], undefined, { metalness: 0.7, roughness: 0.2 });
    }
    for (let i = 0; i < 6; i++) {
      const c = FIRE[i];
      part(t, mat, g.sphere, c, [(i - 2.5) * 0.045, 0.22 - i * 0.012, 0.32 + Math.abs(i - 2.5) * 0.03], [0.03, 0.03, 0.2], [0.8, (i - 2.5) * 0.18, 0], { emissive: new THREE.Color(c), emissiveIntensity: 0.35 });
    }
  },

  jellyfish(t, mat) {
    const GLOW = { transparent: true, opacity: 0.78, roughness: 0.05, clearcoat: 1, emissive: new THREE.Color('#9b7bff'), emissiveIntensity: 0.35 };
    const bell = new THREE.LatheGeometry(
      [[0.0, 0.5], [0.2, 0.5], [0.3, 0.54], [0.31, 0.64], [0.26, 0.78], [0.15, 0.88], [0.0, 0.91]].map(([x, y]) => new THREE.Vector2(x, y)),
      36,
    );
    part(t, mat, bell, '#c9b6ff', [0, 0, 0], 1, undefined, GLOW);
    part(t, mat, g.sphere, '#ffd84d', [0, 0.68, 0], [0.12, 0.1, 0.12], undefined, { emissive: new THREE.Color('#ffd84d'), emissiveIntensity: 0.9 });
    eyes(t, mat, 0.66, -0.29, 0.09, 0.04);
    cheeks(t, mat, 0.6, -0.29, 0.16);
    // Ribbons trailing down, swaying in curls.
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2;
      const c = ['#f9a8d4', '#c4b5fd', '#93c5fd'][i % 3];
      for (let j = 0; j < 4; j++) {
        part(t, mat, g.sphere, c, [Math.sin(a) * 0.2 + Math.sin(j * 1.3 + a) * 0.04, 0.44 - j * 0.11, Math.cos(a) * 0.2], [0.03, 0.06, 0.03], undefined, { transparent: true, opacity: 0.85, emissive: new THREE.Color(c), emissiveIntensity: 0.3 });
      }
    }
    for (const [x, y, z] of [[0.12, 0.84, -0.18], [-0.16, 0.76, -0.2], [0.2, 0.62, -0.22]]) part(t, mat, g.sphere, '#ffffff', [x, y, z], 0.018, undefined, { emissive: new THREE.Color('#ffffff'), emissiveIntensity: 1 });
  },
};

// The figure of a toy by its key, or null; a monster figure's (one of the
// Monster Gashapon's) is the real monster (monster-figures.js).
export function toyFigure(key, mat) {
  if (key.startsWith('m-')) return monsterFigure(key);
  const make = TOYS[key];
  if (!make) return null;
  const t = new THREE.Group();
  t.name = `toy ${key}`;
  make(t, mat);
  return t;
}

export const FIGURES = Object.keys(TOYS);
