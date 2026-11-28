// Treasure chests as real ones look (blocks.js CHEST, GOLD_CHEST and their
// open kinds; shared/treasure.js), not made of boxes: a box of wooden
// planks with dark gaps between them on a plinth, a rounded barrel lid of
// curved staves, iron bands with rivets over it all, brass corners, ring
// handles at the sides, a hasp on the lid and a padlock hanging from it.
// The golden chest is the same chest in gold with purple bands and jewels.
//
// A chest just opened (openingChest) plays its opening: it rattles, the
// padlock pops off, the lid flies up and bounces, a heap of gold coins and
// jewels (a crown in a golden chest's) heaves up glowing and a beam of
// light shines out of it; then the treasure whirls up out of the chest and
// is gone, taken by whoever opened it, and the beam fades. Open after
// that, the chest stands empty, its lid thrown back. Its time goes by group.userData.tick, which
// render/terrain.js calls.
//
// Laid out in a cell's units, its foot in the middle of the floor at the
// origin, its front to -z.
import * as THREE from '../../vendor/three.module.js';
import { at, bake, roundedBox } from './gashapon-model.js';

// How each part takes the light: three's physical material settings.
export const CHEST_FINISH = {
  woodA: { color: '#9a5a2c', roughness: 0.75, envMapIntensity: 0.4 },
  woodB: { color: '#8a4f25', roughness: 0.78, envMapIntensity: 0.4 },
  woodC: { color: '#a8662f', roughness: 0.72, envMapIntensity: 0.4 },
  // Between the planks, and inside.
  gap: { color: '#3a2212', roughness: 0.9, envMapIntensity: 0.2 },
  iron: { color: '#4b5058', roughness: 0.45, metalness: 0.6, envMapIntensity: 0.9 },
  brass: { color: '#d6a63a', roughness: 0.32, metalness: 0.8, envMapIntensity: 1.2 },
  hole: { color: '#121212', roughness: 0.9, envMapIntensity: 0.1 },
  coin: { color: '#ffcb3d', roughness: 0.25, metalness: 0.9, envMapIntensity: 1.4 },
  ruby: { color: '#e8304a', roughness: 0.12, envMapIntensity: 1.5 },
  sapphire: { color: '#2f7ef0', roughness: 0.12, envMapIntensity: 1.5 },
  emerald: { color: '#25c26a', roughness: 0.12, envMapIntensity: 1.5 },
  pearl: { color: '#fbf6ee', roughness: 0.3, envMapIntensity: 1.2 },
  // The golden chest's own.
  goldA: { color: '#f2c44a', roughness: 0.28, metalness: 0.85, envMapIntensity: 1.3 },
  goldB: { color: '#e3b23b', roughness: 0.3, metalness: 0.85, envMapIntensity: 1.3 },
  goldC: { color: '#ffd45c', roughness: 0.26, metalness: 0.85, envMapIntensity: 1.3 },
  royal: { color: '#5b2a86', roughness: 0.35, metalness: 0.3, envMapIntensity: 0.9 },
  velvet: { color: '#7a1f3a', roughness: 0.95, envMapIntensity: 0.2 },
  amethyst: { color: '#b066ff', roughness: 0.1, envMapIntensity: 1.6 },
  // The heap's glow: never lit, it shines.
  glow: { basic: true, color: '#ffe680' },
};

// How long a chest just opened rattles before its lid flies up, and how
// long the lid takes to come up (game.js times the treasure bursting out
// and its sound to these).
export const CHEST_RATTLE_MS = 450;
export const CHEST_LID_MS = 650;
// When the treasure is taken out of a chest opening (from the start of its
// opening), and how long it takes to whirl up and go: game.js sends coins
// flying to whoever opened it then.
export const CHEST_TAKE_MS = 1300;
export const CHEST_TAKE_SECS = 0.5;
// How far the lid swings back, open (radians, past upright).
export const LID_OPEN = 1.95;

// The chest's measures: its box, and the barrel lid on it, hinged at the
// back of the box's top.
const W = 0.74;
const D = 0.5;
const H = 0.42;
const R = D / 2;
const BANDS = [-0.22, 0.22];

// When each chest was opened (performance.now()), by its cell, so the
// model drawn for it (and drawn again, as its chunk is) plays its opening
// from where it has got to.
const opened = new Map();
const cellKey = (x, y, z) => `${x},${y},${z}`;

// A chest at (x, y, z) opened just now: its model plays its opening.
export function openingChest(x, y, z, now = performance.now()) {
  for (const [k, t] of opened) if (now - t > 20_000) opened.delete(k);
  opened.set(cellKey(x, y, z), now);
}

// Materials for every part, each made by `make` from its settings.
export function chestMaterials(make = (f) => new THREE.MeshPhysicalMaterial({ metalness: 0, ...f })) {
  const out = {};
  for (const [k, f] of Object.entries(CHEST_FINISH)) {
    const { basic, ...rest } = f;
    out[k] = basic ? new THREE.MeshBasicMaterial(rest) : make(rest);
  }
  for (const k of ['gap', 'iron', 'royal', 'velvet']) out[k].side = THREE.DoubleSide;
  return out;
}

// A small random, the same every time (for where the coins lie).
const rand = (i) => {
  const s = Math.sin(i * 12.9898 + 78.233) * 43758.5453;
  return s - Math.floor(s);
};

// The parts of a chest, by material, gold or not: the box (body), the lid
// (lid, about its hinge), the padlock (lock) and the treasure (heap).
function chestParts(gold) {
  const wood = gold ? ['goldA', 'goldB', 'goldC'] : ['woodA', 'woodB', 'woodC'];
  const band = gold ? 'royal' : 'iron';
  const trim = gold ? 'goldC' : 'brass';
  const inside = gold ? 'velvet' : 'gap';
  const body = {};
  const lid = {};
  const lock = {};
  const heap = {};
  const put = (to, k, g, m) => (to[k] ??= []).push({ g, m });

  // The box: a dark core, three rows of planks on each side, and a plinth.
  put(body, 'gap', new THREE.BoxGeometry(W - 0.03, H - 0.06, D - 0.03), at(0, (H - 0.06) / 2 + 0.02, 0));
  put(body, inside, new THREE.BoxGeometry(W - 0.06, 0.005, D - 0.06), at(0, H - 0.09, 0));
  const rows = 3;
  const rowH = (H - 0.04) / rows;
  for (let r = 0; r < rows; r++) {
    const y = 0.04 + rowH * (r + 0.5);
    const k = (i) => wood[(r + i) % 3];
    for (const s of [-1, 1]) {
      put(body, k(s > 0 ? 1 : 0), roundedBox(W, rowH - 0.012, 0.03, 0.008, 2), at(0, y, s * (D / 2 - 0.015)));
      put(body, k(s > 0 ? 2 : 1), roundedBox(0.03, rowH - 0.012, D - 0.04, 0.008, 2), at(s * (W / 2 - 0.015), y, 0));
    }
  }
  put(body, gold ? 'goldB' : 'gap', roundedBox(W + 0.04, 0.045, D + 0.04, 0.012, 2), at(0, 0.0225, 0));
  // Iron bands up the front and back, and round the rim of the box.
  for (const x of BANDS) {
    for (const s of [-1, 1]) {
      put(body, band, new THREE.BoxGeometry(0.05, H - 0.04, 0.012), at(x, 0.04 + (H - 0.04) / 2, s * (D / 2 + 0.004)));
      for (let i = 0; i < 4; i++) put(body, trim, new THREE.SphereGeometry(0.009, 8, 6), at(x, 0.08 + i * 0.1, s * (D / 2 + 0.011)));
    }
  }
  for (const s of [-1, 1]) {
    put(body, band, new THREE.BoxGeometry(W + 0.01, 0.03, 0.012), at(0, H - 0.02, s * (D / 2 + 0.005)));
    put(body, band, new THREE.BoxGeometry(0.012, 0.03, D + 0.01), at(s * (W / 2 + 0.005), H - 0.02, 0));
  }
  // Brass corners, top and bottom of each upright edge.
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      for (const y of [0.1, H - 0.08]) {
        put(body, trim, new THREE.BoxGeometry(0.07, 0.1, 0.008), at(sx * (W / 2 - 0.03), y, sz * (D / 2 + 0.008)));
        put(body, trim, new THREE.BoxGeometry(0.008, 0.1, 0.07), at(sx * (W / 2 + 0.008), y, sz * (D / 2 - 0.03)));
      }
    }
  }
  // Ring handles at the sides, hanging from little plates.
  for (const s of [-1, 1]) {
    put(body, trim, new THREE.BoxGeometry(0.008, 0.06, 0.12), at(s * (W / 2 + 0.008), 0.29, 0));
    const ring = new THREE.TorusGeometry(0.05, 0.009, 6, 18, Math.PI);
    ring.rotateZ(Math.PI);
    ring.rotateY(Math.PI / 2);
    put(body, band, ring, at(s * (W / 2 + 0.02), 0.3, 0));
  }
  // The staple on the front that the padlock hangs from.
  put(body, trim, roundedBox(0.12, 0.1, 0.014, 0.005, 2), at(0, H - 0.07, -(D / 2 + 0.008)));

  // The lid, laid out about its hinge at the back of the box's top: its
  // axis R in front of the hinge, curved staves over a dark shell, ends,
  // bands over the top with rivets, a rim and the hasp.
  const z0 = -R;
  const staves = 6;
  const gap = 0.012;
  const across = (g) => {
    g.rotateZ(Math.PI / 2);
    return g;
  };
  put(lid, 'gap', across(new THREE.CylinderGeometry(R - 0.012, R - 0.012, W - 0.01, 24, 1, true, 0, Math.PI)), at(0, 0, z0));
  for (let i = 0; i < staves; i++) {
    const a0 = (i / staves) * Math.PI + gap;
    const len = Math.PI / staves - 2 * gap;
    put(lid, wood[i % 3], across(new THREE.CylinderGeometry(R, R, W, 4, 1, false, a0, len)), at(0, 0, z0));
  }
  for (const s of [-1, 1]) {
    const end = new THREE.CircleGeometry(R + 0.002, 20, 0, Math.PI);
    end.rotateY((s * Math.PI) / 2);
    put(lid, wood[1], end, at((s * W) / 2, 0, z0));
    // The shell's underside: the lid's inside, seen when it is open.
    put(lid, inside, new THREE.BoxGeometry(W - 0.01, 0.006, D - 0.01), at(0, 0.004, z0));
  }
  for (const x of BANDS) {
    put(lid, band, across(new THREE.CylinderGeometry(R + 0.01, R + 0.01, 0.05, 24, 1, true, 0, Math.PI)), at(x, 0, z0));
    for (let i = 1; i < 6; i++) {
      const a = (i / 6) * Math.PI;
      put(lid, trim, new THREE.SphereGeometry(0.009, 8, 6), at(x, Math.sin(a) * (R + 0.012), z0 + Math.cos(a) * (R + 0.012)));
    }
  }
  for (const s of [-1, 1]) put(lid, band, new THREE.BoxGeometry(W + 0.01, 0.03, 0.012), at(0, 0.015, z0 + s * (R + 0.004)));
  // The hasp, hanging down over the front of the box.
  put(lid, trim, roundedBox(0.08, 0.13, 0.014, 0.006, 2), at(0, -0.035, z0 - R - 0.012));
  put(lid, 'hole', new THREE.BoxGeometry(0.02, 0.035, 0.004), at(0, -0.07, z0 - R - 0.02));
  if (gold) {
    // Jewels set in the lid's front, and a big one on the hasp.
    const jewels = ['ruby', 'amethyst', 'sapphire', 'amethyst', 'emerald'];
    jewels.forEach((k, i) => {
      const a = Math.PI * 0.62;
      const x = -0.28 + i * 0.14;
      if (Math.abs(x) < 0.05) return;
      put(lid, k, new THREE.OctahedronGeometry(0.026, 0), at(x, Math.sin(a) * (R + 0.015), z0 + Math.cos(a) * (R + 0.015), 0, 0, 0, 1, 1.3, 0.6));
    });
    put(lid, 'amethyst', new THREE.OctahedronGeometry(0.03, 0), at(0, 0.0, z0 - R - 0.022, 0, 0, 0, 1, 1.3, 0.5));
  }

  // The padlock, hanging from the staple, shut through the hasp.
  put(lock, 'brass', roundedBox(0.1, 0.085, 0.04, 0.012, 2), at(0, H - 0.135, -(D / 2 + 0.04)));
  put(lock, 'iron', new THREE.TorusGeometry(0.03, 0.008, 6, 16, Math.PI), at(0, H - 0.095, -(D / 2 + 0.04)));
  put(lock, 'hole', new THREE.CylinderGeometry(0.01, 0.01, 0.006, 10).rotateX(Math.PI / 2), at(0, H - 0.128, -(D / 2 + 0.061)));
  put(lock, 'hole', new THREE.BoxGeometry(0.006, 0.022, 0.006), at(0, H - 0.145, -(D / 2 + 0.061)));

  // The treasure: a heap of gold, coins scattered over it every which way,
  // jewels among them, a string of pearls, and on a golden chest a crown.
  const top = H - 0.06;
  put(heap, 'coin', new THREE.SphereGeometry(1, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), at(0, top, 0, 0, 0, 0, W / 2 - 0.05, 0.1, D / 2 - 0.05));
  const coins = gold ? 46 : 32;
  for (let i = 0; i < coins; i++) {
    const u = rand(i) * 2 - 1;
    const v = rand(i + 100) * 2 - 1;
    const x = u * (W / 2 - 0.08);
    const z = v * (D / 2 - 0.08);
    const y = top + 0.1 * Math.sqrt(Math.max(0, 1 - u * u * 0.9 - v * v * 0.9)) + 0.004;
    put(heap, 'coin', new THREE.CylinderGeometry(0.034, 0.034, 0.008, 14), at(x, y, z, (rand(i + 200) - 0.5) * 1.6, rand(i + 300) * 6, (rand(i + 400) - 0.5) * 1.6));
  }
  const gems = gold ? ['ruby', 'sapphire', 'emerald', 'amethyst', 'ruby', 'amethyst'] : ['ruby', 'sapphire', 'emerald'];
  gems.forEach((k, i) => {
    const x = (rand(i + 500) - 0.5) * (W - 0.24);
    const z = (rand(i + 600) - 0.5) * (D - 0.2);
    put(heap, k, new THREE.OctahedronGeometry(0.036, 0), at(x, top + 0.09, z, rand(i) * 2, rand(i + 1) * 3, 0, 1, 1.25, 1));
  });
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 1.4 - 0.4;
    put(heap, 'pearl', new THREE.SphereGeometry(0.013, 8, 6), at(0.12 + Math.cos(a) * 0.12, top + 0.085 + Math.sin(i) * 0.006, -0.03 + Math.sin(a) * 0.09));
  }
  if (gold) {
    // A crown, sitting tipped on the heap: a band with points round it,
    // a jewel on each point.
    const crown = at(-0.14, top + 0.11, 0.02, 0.25, 0.4, -0.15);
    put(heap, 'goldC', new THREE.CylinderGeometry(0.075, 0.07, 0.05, 20, 1, true), crown);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      put(heap, 'goldC', new THREE.ConeGeometry(0.02, 0.06, 6), crown.clone().multiply(at(Math.cos(a) * 0.072, 0.054, Math.sin(a) * 0.072)));
      put(heap, i % 2 ? 'ruby' : 'sapphire', new THREE.SphereGeometry(0.011, 8, 6), crown.clone().multiply(at(Math.cos(a) * 0.074, 0.088, Math.sin(a) * 0.074)));
    }
  }
  return { body, lid, lock, heap };
}

const shapes = {};

function chestShapes(gold) {
  const k = gold ? 'gold' : 'wood';
  if (shapes[k]) return shapes[k];
  const parts = chestParts(gold);
  const out = {};
  for (const [name, byMat] of Object.entries(parts)) {
    out[name] = {};
    for (const [m, list] of Object.entries(byMat)) out[name][m] = bake(list);
  }
  // The beam of light out of an open chest: an open cone, wider at the top.
  const beam = new THREE.CylinderGeometry(0.36, 0.22, 2.2, 24, 1, true);
  beam.translate(0, 1.1 + H - 0.04, 0);
  out.beam = beam;
  shapes[k] = out;
  return out;
}

const BEAM_VERT = /* glsl */ `
  varying float vUp;
  void main() {
    vUp = uv.y;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;
const BEAM_FRAG = /* glsl */ `
  uniform vec3 uColor;
  uniform float uAlpha;
  varying float vUp;
  void main() {
    // (Clamped: pow of a hair below nought is NaN, a black speck.)
    float up = clamp(vUp, 0.0, 1.0);
    float a = uAlpha * pow(1.0 - up, 1.6) * smoothstep(0.0, 0.06, up);
    gl_FragColor = vec4(uColor * a, a);
  }
`;

function beamMaterial(color) {
  return new THREE.ShaderMaterial({
    uniforms: { uColor: { value: new THREE.Color(color) }, uAlpha: { value: 0 } },
    vertexShader: BEAM_VERT,
    fragmentShader: BEAM_FRAG,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
  });
}

// A group of meshes, one for each material's parts.
function meshes(parts, materials) {
  const g = new THREE.Group();
  for (const [k, geo] of Object.entries(parts)) {
    const m = new THREE.Mesh(geo, materials[k]);
    m.userData.shared = true;
    g.add(m);
  }
  return g;
}

const easeOutBack = (t) => {
  const c = 2.2;
  return 1 + (c + 1) * (t - 1) ** 3 + c * (t - 1) ** 2;
};

// A shut chest's parts apart, for something that only looks like one (a
// Golden Mimic: gold-mimic-model.js), in the materials given: its box, its
// lid on its hinge (turned about x to open it) and its padlock, each a group,
// and its measures. Laid out as a chest is, its front to -z.
export function chestPieces(materials, gold = true) {
  const s = chestShapes(gold);
  const lid = meshes(s.lid, materials);
  lid.position.set(0, H, R);
  return { box: meshes(s.body, materials), lid, lock: meshes(s.lock, materials), size: { w: W, d: D, h: H, r: R } };
}

// A whole chest in the materials given (chestMaterials): kind is its
// block's `real` ('treasure-chest', 'gold-chest' or either's '-open'), and
// cell where it stands, [x, y, z, block], to play its opening by.
export function chestModel(materials, kind, cell = null) {
  const gold = kind.startsWith('gold');
  const open = kind.endsWith('-open');
  const s = chestShapes(gold);
  const group = new THREE.Group();
  group.name = kind;
  // All of it, to rattle as it opens.
  const whole = new THREE.Group();
  group.add(whole);
  whole.add(meshes(s.body, materials));
  const lid = meshes(s.lid, materials);
  lid.position.set(0, H, R);
  whole.add(lid);
  const lock = meshes(s.lock, materials);
  whole.add(lock);
  if (!open) return group;

  // Open: the lid back, the treasure in it, glowing, and the opening to
  // play if it was opened just now.
  lock.visible = false;
  lid.rotation.x = LID_OPEN;
  const heap = meshes(s.heap, materials);
  whole.add(heap);
  const glow = new THREE.Mesh(new THREE.PlaneGeometry(W - 0.1, D - 0.1).rotateX(-Math.PI / 2), materials.glow);
  glow.position.y = H - 0.065;
  glow.userData.shared = true;
  whole.add(glow);
  const beamMat = beamMaterial(gold ? '#ffe9a8' : '#fff1b8');
  const beam = new THREE.Mesh(s.beam, beamMat);
  beam.userData.shared = true;
  beam.renderOrder = 4;
  beam.visible = false;
  whole.add(beam);
  const key = cell ? cellKey(cell[0], cell[1], cell[2]) : '';
  let settled = false;
  const set = () => {
    for (const o of [whole, lid, lock, heap, beam]) o.updateMatrix();
  };
  group.userData.together = true;
  group.userData.tick = (time) => {
    const t0 = opened.get(key);
    const s = t0 === undefined ? Infinity : (performance.now() - t0) / 1000;
    const rattle = CHEST_RATTLE_MS / 1000;
    const up = CHEST_LID_MS / 1000;
    if (s > 6 || s < 0) {
      // Long open (or never seen opening): open and empty, its treasure
      // taken.
      if (!settled) {
        Object.assign(whole.rotation, { x: 0, z: 0 });
        whole.position.y = 0;
        whole.scale.setScalar(1);
        lid.rotation.x = LID_OPEN;
        lock.visible = false;
        heap.visible = glow.visible = beam.visible = false;
        settled = true;
      }
      set();
      return;
    }
    settled = false;
    if (s < rattle) {
      // Rattling, shut, the padlock still on it.
      const k = 1 - s / rattle;
      whole.rotation.z = Math.sin(s * 70) * 0.06 * (0.4 + k);
      whole.rotation.x = Math.sin(s * 53) * 0.025;
      whole.position.y = Math.abs(Math.sin(s * 35)) * 0.03;
      lid.rotation.x = Math.abs(Math.sin(s * 40)) * 0.08;
      lock.visible = true;
      heap.visible = glow.visible = true;
      heap.position.y = -0.1;
      heap.scale.setScalar(1);
      heap.rotation.y = 0;
      beam.visible = false;
    } else {
      // The lid flying up with a bounce, the chest squashing down and
      // springing back, the treasure heaving up and the beam shining.
      const t = Math.min(1, (s - rattle) / up);
      whole.rotation.set(0, 0, 0);
      whole.position.y = 0;
      const squash = s - rattle < 0.25 ? Math.sin(((s - rattle) / 0.25) * Math.PI) * 0.08 : 0;
      whole.scale.set(1 + squash * 0.6, 1 - squash, 1 + squash * 0.6);
      lid.rotation.x = LID_OPEN * easeOutBack(t);
      lock.visible = false;
      const h = Math.min(1, (s - rattle) / 0.5);
      // Then taken: whirling up out of the chest, shrinking away to nothing.
      const take = Math.min(1, Math.max(0, (s - CHEST_TAKE_MS / 1000) / CHEST_TAKE_SECS));
      heap.visible = take < 1;
      glow.visible = take < 0.5;
      heap.position.y = -0.1 + 0.1 * easeOutBack(h) + take * take * 0.45;
      heap.rotation.y = take * take * 5;
      heap.scale.setScalar((1 + Math.max(0, Math.sin(h * Math.PI)) * 0.08) * (1 - take));
      const glowIn = Math.min(1, (s - rattle) / 0.3);
      const fade = s < 1.9 ? 1 : Math.max(0, 1 - (s - 1.9) / 1.6);
      beam.visible = fade > 0;
      beamMat.uniforms.uAlpha.value = glowIn * fade * (gold ? 1.1 : 0.9);
    }
    set();
  };
  group.userData.dispose = () => beamMat.dispose();
  return group;
}
