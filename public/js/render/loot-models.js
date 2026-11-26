// What a popped monster drops (shared/loot.js), as the toys it is: a fat gold
// coin with a raised rim and a star stamped on both faces, standing on its
// edge to spin; a sack of coins tied at the neck with a red cord, a coin
// stitched on its front and two more peeking out of the top; a glossy red
// heart; a round glass flask of pink potion glowing inside, a cork in its
// neck; and the jewels, cut with facets that catch the light (ruby, sapphire,
// emerald, amethyst and diamond). Each glows softly, even at night, and the
// rarest stand in a beam of their own colour, to be found from afar.
//
// Every shape and material is made once and shared (a drop only ever moves
// as a whole); a model is laid out round its middle, its spinning part apart
// (spin), with how high off the ground its middle hovers (hover).
import * as THREE from '../../vendor/three.module.js';
import { at, bake, lathe } from './gashapon-model.js';
import { blobShadow, toyMaterial } from './toon.js';

// How each kind looks: its colour (for its glow and beam), how much bigger
// than it is made it is drawn (big enough to see from where the camera is),
// how big its glow is, whether it stands in a beam, and how high its middle
// hovers.
export const LOOT_LOOK = {
  coin: { glow: '#ffd84d', scale: 1.6, size: 0.9, hover: 0.42 },
  bag: { glow: '#ffd84d', scale: 1.45, size: 1.05, hover: 0.3 },
  heart: { glow: '#ff5f8f', scale: 1.5, size: 1, hover: 0.42 },
  potion: { glow: '#ff7ad9', scale: 1.5, size: 1.05, hover: 0.33, beam: true },
  ruby: { glow: '#ff4d6a', scale: 1.7, size: 1, hover: 0.38, beam: true },
  sapphire: { glow: '#5aa8ff', scale: 1.7, size: 1, hover: 0.38, beam: true },
  emerald: { glow: '#3fe28a', scale: 1.7, size: 1, hover: 0.38, beam: true },
  amethyst: { glow: '#c07bff', scale: 1.7, size: 1, hover: 0.38, beam: true },
  diamond: { glow: '#e6fbff', scale: 1.8, size: 1.15, hover: 0.4, beam: true },
};

const FINISH = {
  gold: { color: '#ffc531', metalness: 0.85, roughness: 0.24, clearcoat: 0.6, clearcoatRoughness: 0.1, envMapIntensity: 1.6, emissive: '#b07000', emissiveIntensity: 0.5 },
  goldBright: { color: '#ffe27a', metalness: 0.8, roughness: 0.16, clearcoat: 0.8, envMapIntensity: 1.8, emissive: '#c88a00', emissiveIntensity: 0.6 },
  sack: { color: '#c99550', roughness: 0.82, envMapIntensity: 0.4, emissive: '#3a2410', emissiveIntensity: 0.25 },
  cord: { color: '#c23a2c', roughness: 0.6, envMapIntensity: 0.5, emissive: '#3a0a06', emissiveIntensity: 0.3 },
  heart: { color: '#ff3b6e', roughness: 0.18, clearcoat: 1, clearcoatRoughness: 0.05, envMapIntensity: 1.3, emissive: '#ff2a5c', emissiveIntensity: 0.32 },
  glass: { color: '#f2f8ff', roughness: 0.04, clearcoat: 1, clearcoatRoughness: 0.02, envMapIntensity: 1.4, transparent: true, opacity: 0.38, depthWrite: false },
  potion: { color: '#ff4fa8', roughness: 0.15, clearcoat: 1, envMapIntensity: 1, emissive: '#ff3d9a', emissiveIntensity: 0.65 },
  cork: { color: '#b9814b', roughness: 0.8, envMapIntensity: 0.3, emissive: '#2a1808', emissiveIntensity: 0.2 },
  ruby: { color: '#ff2f55', roughness: 0.06, clearcoat: 1, envMapIntensity: 2, emissive: '#c0102e', emissiveIntensity: 0.4, flatShading: true },
  sapphire: { color: '#2f7ef0', roughness: 0.06, clearcoat: 1, envMapIntensity: 2, emissive: '#0d3fa6', emissiveIntensity: 0.4, flatShading: true },
  emerald: { color: '#1fd277', roughness: 0.06, clearcoat: 1, envMapIntensity: 2, emissive: '#078a43', emissiveIntensity: 0.4, flatShading: true },
  amethyst: { color: '#b066ff', roughness: 0.06, clearcoat: 1, envMapIntensity: 2, emissive: '#6a1fc0', emissiveIntensity: 0.4, flatShading: true },
  diamond: { color: '#eafcff', metalness: 0.1, roughness: 0.02, clearcoat: 1, envMapIntensity: 2.6, emissive: '#8fdcff', emissiveIntensity: 0.3, flatShading: true },
};

const mats = new Map();
function mat(key) {
  let m = mats.get(key);
  if (!m) {
    const { emissive, ...rest } = FINISH[key];
    m = toyMaterial({ ...rest, ...(emissive ? { emissive: new THREE.Color(emissive) } : {}) });
    mats.set(key, m);
  }
  return m;
}

const geos = new Map();
const geo = (key, make) => {
  let g = geos.get(key);
  if (!g) geos.set(key, (g = make()));
  return g;
};

// A five-pointed star, flat in x-y, `out` to its points.
function starShape(out, inner) {
  const s = new THREE.Shape();
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2 + Math.PI / 2;
    const r = i % 2 ? inner : out;
    if (i) s.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    else s.moveTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  return s;
}

// The coin: R across its middle, its faces along z.
const R = 0.17;
const T = 0.03;
const coinBody = () =>
  geo('coin', () => {
    const g = lathe([[0, -T * 0.62], [R * 0.74, -T * 0.62], [R * 0.79, -T], [R * 0.96, -T], [R, -T * 0.55], [R, T * 0.55], [R * 0.96, T], [R * 0.79, T], [R * 0.74, T * 0.62], [0, T * 0.62]], 40);
    g.rotateX(Math.PI / 2);
    return g;
  });
const coinStars = () =>
  geo('coin-star', () => {
    const star = new THREE.ExtrudeGeometry(starShape(R * 0.48, R * 0.2), { depth: 0.006, bevelEnabled: true, bevelThickness: 0.004, bevelSize: 0.004, bevelSegments: 1 });
    return bake([
      { g: star, m: at(0, 0, T * 0.6) },
      { g: star, m: at(0, 0, -T * 0.6, 0, Math.PI, 0) },
    ]);
  });

// The bag of coins, its foot at -0.17, its middle at the origin.
const bagSack = () =>
  geo('bag', () => {
    const pts = [[0, 0], [0.12, 0.012], [0.175, 0.07], [0.19, 0.14], [0.165, 0.215], [0.1, 0.27], [0.058, 0.3], [0.064, 0.315], [0.11, 0.35], [0.12, 0.365], [0.1, 0.37]];
    const g = lathe(pts, 22);
    // A little lumpy, as a sack full of coins is.
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i);
      const y = p.getY(i);
      const z = p.getZ(i);
      const a = Math.atan2(z, x);
      const k = 1 + 0.05 * Math.sin(a * 5 + y * 9) * Math.min(1, y * 6) * (y < 0.29 ? 1 : 0.4);
      p.setXYZ(i, x * k, y - 0.17, z * k);
    }
    g.computeVertexNormals();
    return g;
  });
const bagCord = () => geo('bag-cord', () => bake([{ g: new THREE.TorusGeometry(0.066, 0.017, 8, 24), m: at(0, 0.13, 0, Math.PI / 2) }, { g: new THREE.SphereGeometry(0.026, 10, 8), m: at(0.05, 0.12, 0.05) }]));
const bagCoins = () =>
  geo('bag-coins', () => {
    const face = new THREE.CylinderGeometry(0.058, 0.058, 0.02, 20);
    return bake([
      { g: face, m: at(0, 0.02, 0.183, Math.PI / 2 - 0.12, 0, 0) },
      { g: face, m: at(-0.03, 0.21, 0.02, 0.5, 0, 0.35) },
      { g: face, m: at(0.035, 0.205, -0.02, -0.4, 0.3, -0.5) },
    ]);
  });

// The heart: about 0.34 across, its faces along z.
const heartBody = () =>
  geo('heart', () => {
    const s = new THREE.Shape();
    s.moveTo(0, -0.14);
    s.bezierCurveTo(-0.07, -0.08, -0.17, -0.02, -0.16, 0.06);
    s.bezierCurveTo(-0.15, 0.14, -0.05, 0.16, 0, 0.09);
    s.bezierCurveTo(0.05, 0.16, 0.15, 0.14, 0.16, 0.06);
    s.bezierCurveTo(0.17, -0.02, 0.07, -0.08, 0, -0.14);
    const g = new THREE.ExtrudeGeometry(s, { depth: 0.05, bevelEnabled: true, bevelThickness: 0.045, bevelSize: 0.03, bevelSegments: 5, curveSegments: 18 });
    g.translate(0, 0.01, -0.025);
    g.deleteAttribute('uv');
    g.computeVertexNormals();
    return g;
  });

// The potion: a round flask, its middle at the origin.
const FLASK = [[0, 0], [0.075, 0.004], [0.118, 0.045], [0.13, 0.105], [0.112, 0.165], [0.06, 0.205], [0.044, 0.225], [0.044, 0.29], [0.054, 0.3], [0.05, 0.312]];
const potionGlass = () => geo('potion-glass', () => lathe(FLASK, 28).translate(0, -0.15, 0));
const potionLiquid = () =>
  geo('potion-liquid', () =>
    lathe([[0, 0.012], [0.07, 0.016], [0.106, 0.05], [0.117, 0.105], [0.1, 0.15], [0, 0.155]], 24).translate(0, -0.15, 0),
  );
const potionCork = () => geo('potion-cork', () => new THREE.CylinderGeometry(0.036, 0.032, 0.06, 14).translate(0, 0.17, 0));

// A cut jewel: its table up, its point down, faceted.
const jewel = (wide = 1) =>
  geo(`jewel${wide}`, () => {
    const g = lathe([[0, -0.115], [0.13 * wide, -0.005], [0.13 * wide, 0.012], [0.08 * wide, 0.068], [0, 0.068]], 8);
    return g.toNonIndexed();
  });

// A soft round glow, the same picture for all of them (tinted), and a beam
// of light fading out upwards.
let glowMap = null;
function glowTexture() {
  if (glowMap) return glowMap;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,0.9)');
  g.addColorStop(0.35, 'rgba(255,255,255,0.35)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  glowMap = new THREE.CanvasTexture(c);
  glowMap.colorSpace = THREE.SRGBColorSpace;
  return glowMap;
}
let beamMap = null;
function beamTexture() {
  if (beamMap) return beamMap;
  const c = document.createElement('canvas');
  c.width = 4;
  c.height = 64;
  const ctx = c.getContext('2d');
  const g = ctx.createLinearGradient(0, 64, 0, 0);
  g.addColorStop(0, 'rgba(255,255,255,0.7)');
  g.addColorStop(0.25, 'rgba(255,255,255,0.32)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 4, 64);
  beamMap = new THREE.CanvasTexture(c);
  beamMap.colorSpace = THREE.SRGBColorSpace;
  return beamMap;
}
const glowMats = new Map();
function glowMaterial(color) {
  let m = glowMats.get(color);
  if (!m) {
    m = new THREE.SpriteMaterial({ map: glowTexture(), color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.75 });
    glowMats.set(color, m);
  }
  return m;
}
const beamMats = new Map();
function beamMaterial(color) {
  let m = beamMats.get(color);
  if (!m) {
    m = new THREE.MeshBasicMaterial({ map: beamTexture(), color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, opacity: 0.8 });
    beamMats.set(color, m);
  }
  return m;
}
const BEAM_H = 1.7;
const beamShape = () => geo('beam', () => new THREE.CylinderGeometry(0.05, 0.12, BEAM_H, 12, 1, true).translate(0, BEAM_H / 2, 0));

// The parts of each kind, each [shape, material] in its spinning part.
function parts(k) {
  switch (k) {
    case 'coin':
      return [[coinBody(), 'gold'], [coinStars(), 'goldBright']];
    case 'bag':
      return [[bagSack(), 'sack'], [bagCord(), 'cord'], [bagCoins(), 'gold']];
    case 'heart':
      return [[heartBody(), 'heart']];
    case 'potion':
      return [[potionLiquid(), 'potion'], [potionCork(), 'cork'], [potionGlass(), 'glass']];
    case 'emerald':
      return [[jewel(0.82), 'emerald']];
    case 'diamond':
      return [[jewel(1.08), 'diamond']];
    default:
      return [[jewel(), k in FINISH ? k : 'ruby']];
  }
}

// One drop's model: { group (placed where it is, its middle), spin (turned
// as it spins), glow, beam (or null; it stands on the ground, under the
// middle), shadow (a blob of its own, to place on the ground), look }.
export function lootModel(k) {
  const look = LOOT_LOOK[k] ?? LOOT_LOOK.coin;
  const group = new THREE.Group();
  group.name = `loot-${k}`;
  const spin = new THREE.Group();
  for (const [g, key] of parts(k)) {
    const m = new THREE.Mesh(g, mat(key));
    // (The see-through glass casts no shadow, and is drawn after what is in it.)
    if (FINISH[key].transparent) {
      m.renderOrder = 2;
      m.userData.noShadow = true;
    }
    spin.add(m);
  }
  // (A jewel lies tipped a little, to show its table and its facets as it turns.)
  if (JEWEL_TILT[k]) spin.rotation.x = JEWEL_TILT[k];
  spin.scale.setScalar(look.scale);
  group.add(spin);
  const glow = new THREE.Sprite(glowMaterial(look.glow));
  glow.scale.setScalar(look.size);
  glow.renderOrder = 3;
  glow.userData.noFlash = true;
  group.add(glow);
  let beam = null;
  if (look.beam) {
    beam = new THREE.Mesh(beamShape(), beamMaterial(look.glow));
    beam.position.y = -look.hover;
    beam.renderOrder = 3;
    beam.userData.noShadow = true;
    group.add(beam);
  }
  const shadow = blobShadow(0.17 * look.scale, 0.2);
  return { group, spin, glow, beam, shadow, look };
}

const JEWEL_TILT = { ruby: 0.35, sapphire: 0.35, emerald: 0.35, amethyst: 0.35, diamond: 0.35 };

// A model done with: its own shadow goes (shapes and materials are shared).
export function disposeLoot(model) {
  model.group.removeFromParent();
  model.shadow.removeFromParent();
  model.shadow.geometry.dispose();
  model.shadow.material.dispose();
}
