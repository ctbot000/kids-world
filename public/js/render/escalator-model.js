// An escalator as a real one looks (blocks.js ESCALATOR, ESCALATOR_DOWN),
// not made of boxes: a piece of moving stairs, its steps of ridged
// aluminium edged in yellow gliding up (or down) the slope, a skirt of
// stainless steel down each side over the truss under them, a glass
// balustrade on each skirt and a black handrail along its top. Where the
// escalator starts and ends the steps come up out of the floor and go under
// it again by a comb plate, and the balustrades run on past them to a
// rounded end the handrail loops round; a green arrow on the floor shows
// the way on.
//
// Laid out in a cell's units, its foot in the middle of the floor at the
// origin, facing -z like all furniture (shared/furniture.js): the steps go
// from the floor at the front (z = -0.5) up to the floor of the cell above
// at the back (z = 0.5, y = 1). They move by group.userData.tick(time),
// which render/terrain.js calls with the same time for every piece, so the
// steps of one escalator go along together, as fast as the escalator
// carries you (shared/escalator.js).
import * as THREE from '../../vendor/three.module.js';
import { mergeGeometries } from '../../vendor/three-addons/utils/BufferGeometryUtils.js';
import { ESCALATOR_SPEED } from '../shared/escalator.js';
import { at, bake } from './gashapon-model.js';

// How each part takes the light: three's physical material settings. The
// steps are coloured part by part (their yellow edges, their grooves).
export const ESCALATOR_FINISH = {
  step: { color: '#ffffff', vertexColors: true, metalness: 0.3, roughness: 0.45, envMapIntensity: 0.8 },
  steel: { color: '#d5dae0', metalness: 0.7, roughness: 0.26, clearcoat: 0.3, envMapIntensity: 1.1 },
  truss: { color: '#8d96a1', metalness: 0.5, roughness: 0.45, envMapIntensity: 0.7 },
  glass: { color: '#dff4fc', roughness: 0.05, clearcoat: 1, envMapIntensity: 1, transparent: true, opacity: 0.3, side: THREE.DoubleSide, depthWrite: false },
  rail: { color: '#25282e', roughness: 0.32, clearcoat: 0.7, clearcoatRoughness: 0.2, envMapIntensity: 0.8 },
  // The arrow at the way on is never lit itself: it is a light.
  arrow: { basic: true, color: '#3fe07c' },
};

// Materials for every part, each made by `make` from its settings.
export function escalatorMaterials(make = (f) => new THREE.MeshPhysicalMaterial({ metalness: 0, ...f })) {
  const out = {};
  for (const [k, f] of Object.entries(ESCALATOR_FINISH)) {
    const { basic, ...rest } = f;
    out[k] = basic ? new THREE.MeshBasicMaterial(rest) : make(rest);
  }
  return out;
}

// Its measures: steps to a piece (one to each quarter of a block up), how
// wide they are, how far out each side's skirt and glass stand from the
// middle, how high the handrail runs over the steps, how deep the truss
// is under them, and how far its ends run on past the first step and the
// last, on the floor there.
export const STEPS = 4;
export const SIZE = { width: 0.64, side: 0.352, rail: 0.64, truss: 0.4, end: 0.12 };
const STEP = 1 / STEPS;
const SKIRT = 0.1;

// A slanted plate: from (z0, y0) to (z1, y1) along its middle, with ends
// cut upright, `low` under that line and `high` over it, `thick` across in
// x and centred on x.
function slab(x, thick, z0, y0, z1, y1, low, high) {
  const s = new THREE.Shape();
  s.moveTo(z0, y0 - low);
  s.lineTo(z1, y1 - low);
  s.lineTo(z1, y1 + high);
  s.lineTo(z0, y0 + high);
  s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: thick, bevelEnabled: false });
  // The shape's x along z, its extrusion across x.
  g.rotateY(-Math.PI / 2);
  g.translate(x + thick / 2, 0, 0);
  return g;
}

// A bar from (z0, y0) to (z1, y1) at x, w across and h high.
function bar(x, z0, y0, z1, y1, w, h) {
  const len = Math.hypot(z1 - z0, y1 - y0);
  const g = new THREE.BoxGeometry(w, h, len);
  g.rotateX(-Math.atan2(y1 - y0, z1 - z0));
  g.translate(x, (y0 + y1) / 2, (z0 + z1) / 2);
  return g;
}

// A step, its middle at the origin, a quarter of a block deep and high: a
// block of aluminium, its tread ridged with grooves, edged with yellow along
// its front and down both sides of it.
function stepShape() {
  const W = SIZE.width;
  const colour = (g, hex) => {
    const c = new THREE.Color(hex);
    const n = g.attributes.position.count;
    const a = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) c.toArray(a, i * 3);
    g.setAttribute('color', new THREE.BufferAttribute(a, 3));
    g.deleteAttribute('uv');
    return g;
  };
  const box = (w, h, d, x, y, z, hex) => colour(bake([{ g: new THREE.BoxGeometry(w, h, d), m: at(x, y, z) }]), hex);
  const top = STEP / 2;
  const parts = [box(W, STEP, STEP, 0, 0, 0, '#98a1ab'), box(W - 0.02, 0.012, 0.032, 0, top + 0.005, -STEP / 2 + 0.017, '#ffc928')];
  for (const x of [-1, 1]) parts.push(box(0.026, 0.012, STEP - 0.034, x * (W / 2 - 0.014), top + 0.005, 0.016, '#ffc928'));
  for (let i = 1; i < 8; i++) parts.push(box(0.008, 0.006, STEP - 0.05, -W / 2 + 0.03 + (i * (W - 0.06)) / 8, top + 0.002, 0.016, '#7f8893'));
  return mergeGeometries(parts);
}

const shapes = {};

// What stands still: the skirts over the truss, the glass and the handrail
// on each side, the truss's underside, and at an end the escalator has
// (below: no piece before it, above: none after it) its comb plate and the
// balustrades' rounded ends. One shape for each part, baked together.
function bodyShapes(below, above) {
  const key = `${below}${above}`;
  if (shapes[key]) return shapes[key];
  const { side, rail, truss, end, width } = SIZE;
  const parts = { steel: [], truss: [], glass: [], rail: [] };
  const add = (k, g) => parts[k].push({ g, m: new THREE.Matrix4() });
  for (const s of [-1, 1]) {
    const x = s * side;
    // The skirt, down over the truss, and the glass standing on it.
    add('steel', slab(x, 0.05, -0.5, 0, 0.5, 1, truss, SKIRT));
    add('glass', slab(x, 0.02, -0.5, SKIRT, 0.5, 1 + SKIRT, 0, rail - SKIRT));
    add('rail', bar(x, -0.5, rail + 0.025, 0.5, 1 + rail + 0.025, 0.062, 0.05));
    // An end: the skirt and glass run on level over the floor, and the
    // handrail with them, to loop round the end and back in under itself.
    for (const [on, y, z0, z1, out] of [
      [!below, 0, -0.5 - end, -0.5, -1],
      [!above, 1, 0.5, 0.5 + end, 1],
    ]) {
      if (!on) continue;
      add('steel', slab(x, 0.05, z0, y, z1, y, 0, SKIRT));
      add('glass', slab(x, 0.02, z0, y + SKIRT, z1, y + SKIRT, 0, rail - SKIRT));
      add('rail', bar(x, z0, y + rail + 0.025, z1, y + rail + 0.025, 0.062, 0.05));
      const r = (rail - SKIRT) / 2;
      const loop = new THREE.TorusGeometry(r, 0.028, 8, 18, Math.PI);
      loop.rotateZ(-Math.PI / 2);
      loop.rotateY(out < 0 ? Math.PI / 2 : -Math.PI / 2);
      loop.translate(x, y + rail + 0.025 - r, out < 0 ? z0 : z1);
      add('rail', loop);
      // The glass's rounded end, a half disc under the loop.
      const cap = new THREE.CircleGeometry(r - 0.02, 16, -Math.PI / 2, Math.PI);
      cap.rotateY(out < 0 ? Math.PI / 2 : -Math.PI / 2);
      cap.translate(x, y + rail + 0.025 - r, out < 0 ? z0 : z1);
      add('glass', cap);
      // The comb plate the steps come up from (or go under), on the floor.
      if (s > 0) add('steel', new THREE.BoxGeometry(width + 0.04, 0.02, end + 0.04).translate(0, y + 0.01, (z0 + z1) / 2 - out * 0.02));
    }
  }
  // The truss's underside, between the skirts.
  add('truss', slab(0, side * 2, -0.5, 0, 0.5, 1, truss, -truss + 0.04));
  const body = {};
  for (const [k, l] of Object.entries(parts)) if (l.length) body[k] = bake(l);
  shapes[key] = body;
  return body;
}

// A green arrow lying on the floor, pointing along +z, its middle at the
// origin.
function arrowShape() {
  if (shapes.arrow) return shapes.arrow;
  const s = new THREE.Shape();
  s.moveTo(0, 0.15);
  s.lineTo(0.14, 0.01);
  s.lineTo(0.055, 0.01);
  s.lineTo(0.055, -0.15);
  s.lineTo(-0.055, -0.15);
  s.lineTo(-0.055, 0.01);
  s.lineTo(-0.14, 0.01);
  s.closePath();
  const g = new THREE.ShapeGeometry(s);
  // Flat on the floor, facing up, its point along +z.
  g.rotateX(-Math.PI / 2);
  g.rotateY(Math.PI);
  shapes.arrow = g;
  return g;
}

// Where along a piece its steps are at `time`: each one's front edge, from
// its foot (0) to its head (1), moving up an up escalator (way 1) and down
// a down one, as fast as it carries you. The first piece of an escalator
// has one more coming up out of the floor in front of it.
export function stepsAt(time, way, below) {
  const p = (((time * ESCALATOR_SPEED * STEPS * way) % 1) + 1) % 1;
  const out = [];
  for (let j = below ? 0 : -1; j < STEPS; j++) out.push((j + p) / STEPS);
  return out;
}

// A whole piece of escalator in the materials given (escalatorMaterials):
// going up (way 1) or down (-1), with a piece before it (below) or after it
// (above) or not, which decides its ends.
export function escalatorModel(materials, { way = 1, below = false, above = false } = {}) {
  const group = new THREE.Group();
  group.name = 'escalator';
  for (const [k, g] of Object.entries(bodyShapes(below, above))) {
    const m = new THREE.Mesh(g, materials[k]);
    m.userData.shared = true;
    group.add(m);
  }
  // The arrow on the floor at the way on: the foot of an up escalator, the
  // head of a down one.
  if (way > 0 ? !below : !above) {
    const arrow = new THREE.Mesh(arrowShape(), materials.arrow);
    arrow.userData.shared = true;
    arrow.position.set(0, way > 0 ? 0.022 : 1.022, way > 0 ? -0.74 : 0.74);
    if (way < 0) arrow.rotation.y = Math.PI;
    arrow.updateMatrix();
    group.add(arrow);
  }
  // The steps: one shape, drawn where each one is.
  shapes.step ??= stepShape();
  const steps = new THREE.InstancedMesh(shapes.step, materials.step, STEPS + 1);
  steps.frustumCulled = false;
  group.add(steps);
  const m = new THREE.Matrix4();
  group.userData.together = true;
  group.userData.tick = (time) => {
    const list = stepsAt(time, way, below);
    list.forEach((u, i) => {
      // At the top the steps level out, just under the floor there, and
      // slide in under it.
      const y = above ? u : Math.min(u, 1 - STEP / 2 - 0.006);
      steps.setMatrixAt(i, m.makeTranslation(0, y, u - 0.5 + STEP / 2));
    });
    steps.count = list.length;
    steps.instanceMatrix.needsUpdate = true;
  };
  group.userData.tick(0);
  // Its own copy of where the steps are, to let go of when it goes.
  group.userData.dispose = () => steps.dispose();
  return group;
}
