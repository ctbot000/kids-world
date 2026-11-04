// A birthday party as the real thing looks (blocks.js PARTY_TABLE,
// BIRTHDAY_CAKE, PRESENT, BALLOONS, PARTY_BANNER), not made of boxes.
//
// - The cake: two tiers on a white stand, pink frosting under a cream top,
//   icing dripping down them, sprinkles, strawberries, and a candle on every
//   slice. A slice eaten shows the sponge and cream inside the next.
// - A present: a box in glossy paper with a ribbon round it and a bow on its
//   lid, each cell's its own colour and size. Opened, its lid flies off, there
//   is tissue paper inside, and a capsule toy hops out to say hello.
// - Balloons: three on strings from a little gold weight, bobbing a little,
//   two blocks high with room above them.
// - A banner: flags on a string against the wall, a letter on each, spelling
//   the words along the row it is in (shared/party.js bannerPlace).
// - A party table: a white cloth with a band and a scalloped hem, joining up
//   with the one beside it, its places laid with a cupcake, a paper cup and a
//   party hat, unless something stands on it.
//
// Laid out in a cell's units, its foot in the middle of the floor at the
// origin, facing -z like all furniture. Everything is one vertex-coloured
// shape per thing that moves, so a whole party is few draws. How each is going
// comes from the island's Party (shared/party.js), read by group.userData.tick
// each frame in the renderer's time, which render/terrain.js calls.
import * as THREE from '../../vendor/three.module.js';
import { AIR, BLOCKS, SOLID } from '../shared/blocks.js';
import { keyOf } from '../shared/arcade.js';
import { furnitureDrop } from '../shared/furniture.js';
import { BANNER_TEXT, CANDLE_TOP, SLICES, SURPRISES, balloonColors, balloonSpots, bannerPlace, candleSpot, isPresent } from '../shared/party.js';
import { flameMaterial, flameQuads } from './campfire-model.js';
import { toyFigure } from './capsule-toys.js';
import { at, lathe, roundedBox } from './gashapon-model.js';

// How each kind of surface takes the light: three's physical material
// settings, its colours from its shape's corners.
export const PARTY_FINISH = {
  // Frosting, sponge, paper cups.
  satin: { vertexColors: true, roughness: 0.55, clearcoat: 0.25, clearcoatRoughness: 0.35, envMapIntensity: 0.65 },
  // Balloons, wrapping paper, the cake stand.
  gloss: { vertexColors: true, roughness: 0.17, clearcoat: 1, clearcoatRoughness: 0.08, envMapIntensity: 1.15 },
  // A tablecloth and flags.
  cloth: { vertexColors: true, roughness: 0.9, envMapIntensity: 0.35 },
  gold: { vertexColors: true, metalness: 1, roughness: 0.28, envMapIntensity: 1.25 },
};

// Materials for every part, each made by `make` from its settings, the
// candles' flames (uTime moved by the ticks) and whatever colour a capsule toy
// asks for (`figure`, as render/capsule-toys.js takes it).
export function partyMaterials(make = (f) => new THREE.MeshPhysicalMaterial({ metalness: 0, ...f })) {
  const out = {};
  for (const [k, f] of Object.entries(PARTY_FINISH)) out[k] = make(f);
  out.flame = flameMaterial();
  const figures = new Map();
  out.figure = (color, extra = {}) => {
    const k = `${color}|${JSON.stringify(extra, (_, v) => (v?.isColor ? `#${v.getHexString()}` : v))}`;
    if (!figures.has(k)) figures.set(k, make({ color, roughness: 0.3, clearcoat: 0.8, clearcoatRoughness: 0.12, envMapIntensity: 0.9, ...extra }));
    return figures.get(k);
  };
  return out;
}

// ---------------------------------------------------------------- shapes

const BOX = new THREE.BoxGeometry(1, 1, 1);
const BALL = new THREE.SphereGeometry(1, 12, 9);
const ROD = new THREE.CylinderGeometry(1, 1, 1, 6);
const UP = new THREE.Vector3(0, 1, 0);

// Parts ({ g, m, c }: a shape, where it goes and its colour) baked into one
// shape with its colours at its corners.
function paint(parts) {
  let count = 0;
  let indices = 0;
  for (const { g } of parts) {
    count += g.attributes.position.count;
    indices += g.index ? g.index.count : g.attributes.position.count;
  }
  const positions = new Float32Array(count * 3);
  const normals = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const index = new Uint32Array(indices);
  const v3 = new THREE.Vector3();
  const n3 = new THREE.Matrix3();
  const color = new THREE.Color();
  let v = 0;
  let t = 0;
  for (const { g, m, c } of parts) {
    const pos = g.attributes.position;
    const nor = g.attributes.normal;
    n3.getNormalMatrix(m);
    color.set(c);
    for (let i = 0; i < pos.count; i++) {
      v3.fromBufferAttribute(pos, i).applyMatrix4(m).toArray(positions, (v + i) * 3);
      v3.fromBufferAttribute(nor, i).applyMatrix3(n3).normalize().toArray(normals, (v + i) * 3);
      color.toArray(colors, (v + i) * 3);
    }
    const n = g.index ? g.index.count : pos.count;
    for (let i = 0; i < n; i++) index[t + i] = (g.index ? g.index.array[i] : i) + v;
    v += pos.count;
    t += n;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  out.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  out.setIndex(new THREE.BufferAttribute(index, 1));
  return out;
}

const IDENTITY = new THREE.Matrix4();
const cube = (x0, y0, z0, x1, y1, z1, c) => ({ g: BOX, m: at((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2, 0, 0, 0, x1 - x0, y1 - y0, z1 - z0), c });
// A ball squashed to these sizes, turned ry round.
const ball = (x, y, z, sx, sy, sz, c, ry = 0) => ({ g: BALL, m: at(x, y, z, 0, ry, 0, sx, sy, sz), c });
// A thin rod from a to b.
function rod(a, b, r, c) {
  const d = new THREE.Vector3().subVectors(b, a);
  const q = new THREE.Quaternion().setFromUnitVectors(UP, d.clone().normalize());
  return { g: ROD, m: new THREE.Matrix4().compose(a.clone().add(b).multiplyScalar(0.5), q, new THREE.Vector3(r, d.length(), r)), c };
}
const shape = (g, c, m = IDENTITY) => ({ g, m, c });
// Dull random, the same every time.
const dice = (n) => {
  const s = Math.sin(n * 12.9898) * 43758.5453;
  return s - Math.floor(s);
};
const PAPER_BRIGHT = ['#7cc4ff', '#ffd84d', '#ff8fc4', '#7fe08c', '#c9a0ff', '#ffb347'];

// ---------------------------------------------------------------- the cake

// The cake's measures: how high each tier stops and how wide it is.
const CAKE = { plate: 0.075, low: 0.27, top: 0.41, R: 0.335, r: 0.19 };
const PINK = '#f7a8c9';
const DEEP_PINK = '#ef7fb0';
const CREAM = '#fff1da';
const ICING = '#fffaf2';
const SPONGE = '#f0c98a';
const FILLING = '#fff6e6';
const STEP = (Math.PI * 2) / SLICES;

// The flat side of a slice of cake, facing the way its angle grows (side 1) or
// the other way (side -1): a strip of it, from r0 to r1 out and y0 to y1 up.
function cutFace(phi, side, r0, r1, y0, y1, c) {
  const p = (r, y) => [r * Math.sin(phi), y, r * Math.cos(phi)];
  const [a, b, e, d] = [p(r0, y0), p(r1, y0), p(r1, y1), p(r0, y1)];
  const corners = side > 0 ? [a, e, b, a, d, e] : [a, b, e, a, e, d];
  const n = [side * Math.cos(phi), 0, -side * Math.sin(phi)];
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(corners.flat(), 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(corners.flatMap(() => n), 3));
  return shape(g, c);
}

// One slice of the cake, top to bottom, with its candle.
function cakeSlice(i) {
  const { plate, low, top, R, r } = CAKE;
  const phi = i * STEP;
  const wedge = (pts, segs = 6) => new THREE.LatheGeometry(pts.map(([x, y]) => new THREE.Vector2(x, y)), segs, phi, STEP);
  const aim = (k) => phi + STEP * k;
  const onWall = (a, rr, y) => [Math.sin(a) * rr, y, Math.cos(a) * rr];
  const parts = [
    // The tiers' frosting, wall and top.
    shape(wedge([[R, plate], [R, low - 0.02], [R - 0.02, low], [r - 0.01, low]]), PINK),
    shape(wedge([[r, low], [r, top - 0.014], [r - 0.014, top], [0.001, top]]), CREAM),
    // The icing poured over each tier's edge.
    shape(wedge([[R + 0.004, low - 0.032], [R + 0.008, low - 0.012], [R - 0.012, low + 0.006], [R - 0.05, low + 0.004]]), ICING),
    shape(wedge([[r + 0.003, top - 0.022], [r + 0.006, top - 0.008], [r - 0.012, top + 0.005], [r - 0.045, top + 0.004]]), DEEP_PINK),
  ];
  // Inside, seen once the next slice has gone: sponge and a layer of filling.
  for (const [a, side] of [[phi, -1], [phi + STEP, 1]]) {
    parts.push(
      cutFace(a, side, 0, R - 0.012, plate, plate + 0.08, SPONGE),
      cutFace(a, side, 0, R - 0.012, plate + 0.08, plate + 0.105, FILLING),
      cutFace(a, side, 0, R - 0.012, plate + 0.105, low - 0.012, SPONGE),
      cutFace(a, side, R - 0.012, R, plate, low, PINK),
      cutFace(a, side, 0, R - 0.012, low - 0.012, low, PINK),
      cutFace(a, side, 0, r - 0.01, low, low + 0.05, SPONGE),
      cutFace(a, side, 0, r - 0.01, low + 0.05, low + 0.072, FILLING),
      cutFace(a, side, 0, r - 0.01, low + 0.072, top - 0.01, SPONGE),
      cutFace(a, side, r - 0.01, r, low, top, CREAM),
      cutFace(a, side, 0, r - 0.01, top - 0.01, top, CREAM),
    );
  }
  // A ruffle of icing round its foot, and drips down each tier.
  for (let k = 0; k < 3; k++) {
    const a = aim((k + 0.5) / 3);
    parts.push(ball(...onWall(a, R + 0.004, plate + 0.018), 0.05, 0.024, 0.024, ICING, a + Math.PI / 2));
    const len = 0.025 + dice(i * 3 + k) * 0.05;
    parts.push(ball(...onWall(a + 0.08, R + 0.002, low - 0.028 - len / 2), 0.017, len / 2 + 0.012, 0.009, ICING, a));
    const len2 = 0.015 + dice(i * 7 + k + 40) * 0.04;
    parts.push(ball(...onWall(a - 0.06, r + 0.001, top - 0.018 - len2 / 2), 0.014, len2 / 2 + 0.01, 0.008, DEEP_PINK, a));
  }
  // Sprinkles on the walls.
  const crumb = new THREE.IcosahedronGeometry(1, 0);
  for (let k = 0; k < 7; k++) {
    const a = aim(dice(i * 11 + k));
    const y = plate + 0.03 + dice(i * 13 + k) * (low - plate - 0.095);
    parts.push({ g: crumb, m: at(...onWall(a, R + 0.001, y), 0, a, dice(i + k) * 3, 0.011, 0.004, 0.003), c: PAPER_BRIGHT[(i + k) % PAPER_BRIGHT.length] });
  }
  // On the ledge round the top tier: a strawberry and a swirl of icing.
  const ledge = (R + r) / 2 + 0.012;
  const berry = aim(0.3);
  parts.push(ball(...onWall(berry, ledge, low + 0.031), 0.031, 0.036, 0.031, '#e8333f'), ball(...onWall(berry, ledge, low + 0.066), 0.019, 0.007, 0.019, '#57b04a'));
  const swirl = aim(0.75);
  parts.push(ball(...onWall(swirl, ledge, low + 0.022), 0.03, 0.019, 0.03, ICING), ball(...onWall(swirl, ledge, low + 0.046), 0.018, 0.016, 0.018, ICING));
  // Rosettes round the top tier's edge.
  for (let k = 0; k < 2; k++) parts.push(ball(...onWall(aim((k + 0.5) / 2), r - 0.022, top + 0.009), 0.017, 0.013, 0.017, DEEP_PINK));
  // Its candle: wax, a blob of icing to stand in, and a wick.
  const [cx, cz] = candleSpot(i);
  const stick = new THREE.CylinderGeometry(0.0115, 0.013, 0.112, 8);
  parts.push(shape(stick, PAPER_BRIGHT[i % PAPER_BRIGHT.length], at(cx, top + 0.058, cz)), ball(cx, top + 0.004, cz, 0.019, 0.009, 0.019, ICING));
  parts.push(rod(new THREE.Vector3(cx, top + 0.11, cz), new THREE.Vector3(cx, CANDLE_TOP, cz), 0.0028, '#3a3431'));
  return parts;
}

const cakeShapes = new Map();
// A cake with n slices left: the first n round it.
export function cakeBody(n) {
  if (!cakeShapes.has(n)) {
    const parts = [];
    for (let i = 0; i < n; i++) parts.push(...cakeSlice(i));
    cakeShapes.set(n, paint(parts));
  }
  return cakeShapes.get(n);
}

let standShape = null;
let flamesShape = null;
function cakeStand() {
  standShape ??= paint([
    shape(lathe([[0, 0], [0.2, 0], [0.21, 0.008], [0.17, 0.016], [0.055, 0.026], [0.042, 0.045], [0.39, 0.054], [0.41, 0.064], [0.4, 0.078], [0, 0.075]], 32), '#fdfbf6'),
  ]);
  return standShape;
}
function cakeFlames() {
  if (flamesShape) return flamesShape;
  const list = [];
  for (let i = 0; i < SLICES; i++) {
    const [x, z] = candleSpot(i);
    list.push([x, CANDLE_TOP - 0.008, z, 0.062, 0.115, (i * 0.37 + 0.11) % 1]);
  }
  flamesShape = flameQuads(list);
  flamesShape.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, CANDLE_TOP + 0.05, 0), 0.25);
  flamesShape.boundingBox = new THREE.Box3(new THREE.Vector3(-0.2, CANDLE_TOP - 0.05, -0.2), new THREE.Vector3(0.2, CANDLE_TOP + 0.15, 0.2));
  return flamesShape;
}

function cakeModel(materials, key, party) {
  const group = new THREE.Group();
  group.name = 'birthday cake';
  const stand = new THREE.Mesh(cakeStand(), materials.gloss);
  const body = new THREE.Mesh(cakeBody(SLICES), materials.satin);
  const flames = new THREE.Mesh(cakeFlames(), materials.flame);
  flames.renderOrder = 4;
  flames.userData.flames = true;
  for (const m of [stand, body, flames]) {
    m.userData.shared = true;
    group.add(m);
  }
  let shown = SLICES;
  group.userData.body = body;
  group.userData.tick = (time) => {
    materials.flame.uniforms.uTime.value = time;
    const c = party.cake(key, time * 1000);
    flames.visible = c.phase !== 'out';
    if (c.slices !== shown) {
      shown = c.slices;
      body.visible = shown > 0;
      if (shown > 0) body.geometry = cakeBody(shown);
    }
  };
  return group;
}

// ---------------------------------------------------------------- a present

// Each cell's present: its paper, ribbon, whether it has dots on, how wide and
// high it is, and a little turn.
export const PRESENTS = [
  { paper: '#ef4b5f', ribbon: '#ffd166', dots: '#ffe3e7', w: 0.76, h: 0.56, yaw: 0.12 },
  { paper: '#3f9be8', ribbon: '#fffaf2', dots: null, w: 0.66, h: 0.68, yaw: -0.2 },
  { paper: '#ffc93c', ribbon: '#ef4b5f', dots: '#fff4c9', w: 0.72, h: 0.48, yaw: 0.28 },
  { paper: '#45c46e', ribbon: '#ffd166', dots: null, w: 0.62, h: 0.58, yaw: -0.08 },
  { paper: '#9a6be0', ribbon: '#fffaf2', dots: '#e3d4fa', w: 0.7, h: 0.62, yaw: 0.2 },
];
const presentShapes = new Map();

// How high a present's box is under its lid, for its height h.
const boxHigh = (h) => h * 0.8;

function presentShape(v) {
  if (presentShapes.has(v)) return presentShapes.get(v);
  const { paper, ribbon, dots, w, h } = PRESENTS[v];
  const high = boxHigh(h);
  const side = roundedBox(w, high, w, 0.018, 2);
  const box = [
    shape(side, paper, at(0, high / 2, 0)),
    // Tissue paper, for when the lid is off.
    ball(0, high, 0, w * 0.42, 0.05, w * 0.42, '#fff8ef'),
    ball(w * 0.14, high + 0.015, -w * 0.12, w * 0.18, 0.05, w * 0.18, '#ffe9f2'),
    // The ribbon, round it both ways.
    cube(-0.042, 0, -w / 2 - 0.004, 0.042, high + 0.002, w / 2 + 0.004, ribbon),
    cube(-w / 2 - 0.004, 0, -0.042, w / 2 + 0.004, high + 0.002, 0.042, ribbon),
  ];
  if (dots) {
    const dot = new THREE.CircleGeometry(0.03, 12);
    for (let i = 0; i < 4; i++) {
      const a = (i * Math.PI) / 2;
      for (const [u, y] of [[-0.25, 0.3], [-0.2, 0.72], [0.22, 0.26], [0.27, 0.68]]) {
        const across = u * w;
        const out = w / 2 + 0.0015;
        // Round the four walls, each dot flat against its wall.
        box.push(shape(dot, dots, at(Math.sin(a) * out + Math.cos(a) * across, y * high, Math.cos(a) * out - Math.sin(a) * across, 0, a, 0)));
      }
    }
  }
  // The lid, drawn from its own middle, to fly off, with the bow on it.
  const lidH = h - high;
  const top = lidH / 2;
  const loop = new THREE.TorusGeometry(0.058, 0.019, 7, 14);
  const lid = [
    shape(roundedBox(w + 0.05, lidH, w + 0.05, 0.016, 2), paper),
    cube(-0.044, -lidH / 2, -w / 2 - 0.029, 0.044, top + 0.003, w / 2 + 0.029, ribbon),
    cube(-w / 2 - 0.029, -lidH / 2, -0.044, w / 2 + 0.029, top + 0.003, 0.044, ribbon),
    shape(loop, ribbon, at(-0.068, top + 0.045, 0.004, 0.3, 0, 0.5, 1.1, 0.8, 0.6)),
    shape(loop, ribbon, at(0.068, top + 0.045, 0.004, 0.3, 0, -0.5, 1.1, 0.8, 0.6)),
    ball(0, top + 0.024, 0, 0.033, 0.027, 0.033, ribbon),
  ];
  const out = { box: paint(box), lid: paint(lid), lidY: high + lidH / 2 - 0.006 };
  presentShapes.set(v, out);
  return out;
}

// Up with a little overshoot, from 0 to 1 as k does.
const overshoot = (k) => {
  const c = 1.7;
  const u = k - 1;
  return 1 + (c + 1) * u * u * u + c * u * u;
};

// Which present is in a cell.
const presentAt = (x, y, z) => (((x * 7 + y * 11 + z * 3) % PRESENTS.length) + PRESENTS.length) % PRESENTS.length;
// How far down a present is drawn in its cell to sit on the one under it, in a
// pile of them (on a table, furnitureDrop has the lowest of them on its top).
function pileDrop(world, x, y, z) {
  const below = world.get(x, y - 1, z);
  if (!isPresent(below)) return 0;
  return pileDrop(world, x, y - 1, z) + furnitureDrop(below, world.get(x, y - 2, z)) + PRESENTS[presentAt(x, y - 1, z)].h - 1;
}

function presentModel(materials, x, y, z, key, party, world) {
  const v = presentAt(x, y, z);
  const s = presentShape(v);
  const { h, yaw } = PRESENTS[v];
  const group = new THREE.Group();
  group.name = 'present';
  group.userData.variant = v;
  const inner = new THREE.Group();
  inner.rotation.y = yaw;
  inner.position.y = pileDrop(world, x, y, z);
  group.add(inner);
  const box = new THREE.Mesh(s.box, materials.gloss);
  const lid = new THREE.Mesh(s.lid, materials.gloss);
  lid.position.y = s.lidY;
  box.userData.shared = true;
  lid.userData.shared = true;
  inner.add(box, lid);
  group.userData.lid = lid;
  let toy = null;
  let shut = true;
  group.userData.tick = (time) => {
    const open = party.present(key, time * 1000);
    if (!open) {
      if (shut) return;
      shut = true;
      lid.visible = true;
      lid.position.set(0, s.lidY, 0);
      lid.rotation.set(0, 0, 0);
      lid.scale.setScalar(1);
      lid.updateMatrix();
      return;
    }
    shut = false;
    const e = time - open.at / 1000;
    // Up and off, turning over and shrinking away to nothing.
    const fly = e / 0.7;
    lid.visible = fly < 1;
    if (lid.visible) {
      lid.position.set(fly * 0.5, s.lidY + fly * 1.9 - fly * fly * 1.1, fly * -0.2);
      lid.rotation.set(fly * 1.4, 0, fly * -2.6);
      lid.scale.setScalar(Math.max(0.001, 1 - fly * fly * fly));
      lid.updateMatrix();
    }
    // Out hops the toy, turns round to everyone and goes back in.
    if (e > 3.5 || e < 0) {
      if (toy) {
        group.remove(toy);
        toy = null;
      }
      return;
    }
    if (!toy) {
      toy = toyFigure(SURPRISES[open.toy].key, materials.figure);
      group.add(toy);
      group.userData.toy = toy;
    }
    const rise = e < 0.45 ? overshoot(e / 0.45) : e > 3 ? 1 - (e - 3) / 0.5 : 1;
    const high = boxHigh(h);
    const hop = e > 0.45 && e < 3 ? Math.abs(Math.sin((e - 0.45) * 5)) * 0.1 : 0;
    toy.position.set(0, inner.position.y + high - 0.15 + rise * 0.2 + hop, 0);
    toy.rotation.y = Math.PI + Math.sin(e * 2.2) * 0.8;
    toy.scale.setScalar(Math.max(0.001, 0.42 * rise));
  };
  return group;
}

// ---------------------------------------------------------------- balloons

// A balloon's outline, for a radius of 1, from the knot at its foot to its top.
const BALLOON_LINE = new THREE.SplineCurve(
  [[0.02, -1.24], [0.1, -1.17], [0.32, -0.95], [0.68, -0.52], [0.93, -0.08], [1, 0.3], [0.9, 0.72], [0.56, 1.05], [0, 1.16]].map(([x, y]) => new THREE.Vector2(x, y)),
).getPoints(22);
const balloonShapes = new Map();
const WEIGHT_TOP = 0.05;

// Balloon i of a bunch as a shape, from the top of its weight, where its
// string is tied and it sways from, up to the balloon.
function balloonShape(i, tall, color) {
  const key = `${i}|${tall}|${color}`;
  if (balloonShapes.has(key)) return balloonShapes.get(key);
  const [x, y, z, r] = balloonSpots(tall)[i];
  const dy = y - WEIGHT_TOP;
  const line = BALLOON_LINE.map((p) => new THREE.Vector2(Math.max(0.0005, p.x * r), p.y * r));
  const parts = [
    shape(new THREE.LatheGeometry(line, 18), color, at(x, dy, z)),
    // Its knot, and a highlight's worth of a lip under it.
    ball(x, dy - r * 1.27, z, r * 0.11, r * 0.07, r * 0.11, color),
    // The string, in two lengths, curving a little.
    rod(new THREE.Vector3(0, 0, 0), new THREE.Vector3(x * 0.4 + 0.012, dy * 0.45, z * 0.4), 0.0032, '#fffdf8'),
    rod(new THREE.Vector3(x * 0.4 + 0.012, dy * 0.45, z * 0.4), new THREE.Vector3(x, dy - r * 1.28, z), 0.0032, '#fffdf8'),
  ];
  const g = paint(parts);
  balloonShapes.set(key, g);
  return g;
}

let weightShape = null;

function balloonsModel(materials, x, y, z, key, party, world) {
  const tall = !SOLID[world.get(x, y + 1, z)];
  const colors = balloonColors(x, y, z);
  const group = new THREE.Group();
  group.name = 'balloons';
  weightShape ??= paint([shape(lathe([[0, 0], [0.062, 0], [0.066, 0.012], [0.05, 0.036], [0.018, WEIGHT_TOP], [0, WEIGHT_TOP + 0.002]], 16), '#ffd166')]);
  const weight = new THREE.Mesh(weightShape, materials.gold);
  weight.userData.shared = true;
  group.add(weight);
  const bobs = colors.map((color, i) => {
    const m = new THREE.Mesh(balloonShape(i, tall, color), materials.gloss);
    m.position.y = WEIGHT_TOP;
    m.userData.shared = true;
    m.userData.balloon = i;
    group.add(m);
    return { m, phase: x * 1.7 + z * 2.3 + i * 2.1, down: false, grew: null };
  });
  group.userData.balloons = bobs.map((b) => b.m);
  group.userData.tick = (time) => {
    const now = time * 1000;
    bobs.forEach((b, i) => {
      const up = party.balloonUp(key, i, now);
      b.m.visible = up;
      if (!up) {
        b.down = true;
        return;
      }
      if (b.down) {
        b.down = false;
        b.grew = time;
      }
      const k = b.grew === null ? 1 : Math.min(1, (time - b.grew) / 0.5);
      if (k >= 1) b.grew = null;
      b.m.scale.setScalar(Math.max(0.001, overshoot(k)));
      b.m.rotation.z = Math.sin(time * 0.8 + b.phase) * 0.035;
      b.m.rotation.x = Math.cos(time * 0.63 + b.phase * 2) * 0.035;
      b.m.updateMatrix();
    });
  };
  return group;
}

// ---------------------------------------------------------------- a banner

// The letters and the heart, five by seven.
const LETTERS = {
  H: ['#...#', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
  A: ['.###.', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
  P: ['####.', '#...#', '#...#', '####.', '#....', '#....', '#....'],
  Y: ['#...#', '#...#', '.#.#.', '..#..', '..#..', '..#..', '..#..'],
  B: ['####.', '#...#', '#...#', '####.', '#...#', '#...#', '####.'],
  I: ['#####', '..#..', '..#..', '..#..', '..#..', '..#..', '#####'],
  R: ['####.', '#...#', '#...#', '####.', '#.#..', '#..#.', '#...#'],
  T: ['#####', '..#..', '..#..', '..#..', '..#..', '..#..', '..#..'],
  D: ['####.', '#...#', '#...#', '#...#', '#...#', '#...#', '####.'],
  '♥': ['.....', '.#.#.', '#####', '#####', '.###.', '..#..', '.....'],
};
export const bannerLetters = () => Object.keys(LETTERS);
const FLAG_COLORS = ['#ef5b6b', '#f7903a', '#3fbf7f', '#4a90e8', '#9a6be0', '#ee5fa7'];
const FLAG_W = 0.42;
const FLAG_STRAIGHT = 0.3;
const FLAG_H = 0.46;
const PIXEL = 0.037;
// The string against the wall: at the cell's two sides, and sagging between.
const STRING_Y = 0.95;
const SAG = 0.06;
const FLAG_Z = 0.46;
const stringAt = (x) => STRING_Y - SAG * (1 - 4 * x * x);

const flagOutline = new THREE.Shape();
flagOutline.moveTo(-FLAG_W / 2, 0);
flagOutline.lineTo(FLAG_W / 2, 0);
flagOutline.lineTo(FLAG_W / 2, -FLAG_STRAIGHT);
flagOutline.lineTo(0, -FLAG_H);
flagOutline.lineTo(-FLAG_W / 2, -FLAG_STRAIGHT);
flagOutline.closePath();
const FLAG = new THREE.ShapeGeometry(flagOutline);

// A flag on the string, at x across its cell, showing a letter to whoever
// faces it: towards -z, the way furniture does, your left is its +x, so its
// letters read from +x to -x.
function flagParts(x, slot) {
  const top = stringAt(x) - 0.004;
  const parts = [shape(FLAG, FLAG_COLORS[slot % FLAG_COLORS.length], at(x, top, FLAG_Z, 0, Math.PI, 0))];
  const rows = LETTERS[BANNER_TEXT[slot]];
  rows.forEach((row, r) => {
    for (let c = 0; c < row.length; c++) {
      if (row[c] !== '#') continue;
      let end = c;
      while (row[end + 1] === '#') end++;
      const y1 = top - 0.03 - r * PIXEL;
      parts.push(cube(x + (2.5 - end - 1) * PIXEL, y1 - PIXEL, FLAG_Z - 0.006, x + (2.5 - c) * PIXEL, y1, FLAG_Z - 0.0005, '#fffdf8'));
      c = end;
    }
  });
  return parts;
}

const bannerShapes = new Map();
// A piece of banner, `place` along its row.
export function bannerShape(place) {
  const n = BANNER_TEXT.length;
  const first = (place * 2) % n;
  if (bannerShapes.has(first)) return bannerShapes.get(first);
  const parts = [...flagParts(0.25, first), ...flagParts(-0.25, (first + 1) % n)];
  // The string, and a bead where it meets the next piece.
  const STEPS = 8;
  const point = (i) => {
    const px = -0.5 + i / STEPS;
    return new THREE.Vector3(px, stringAt(px), FLAG_Z - 0.008);
  };
  for (let i = 0; i < STEPS; i++) parts.push(rod(point(i), point(i + 1), 0.0055, '#fffdf8'));
  parts.push(ball(0.5, STRING_Y, FLAG_Z - 0.008, 0.016, 0.016, 0.016, '#ffd166'), ball(-0.5, STRING_Y, FLAG_Z - 0.008, 0.016, 0.016, 0.016, '#ffd166'));
  const g = paint(parts);
  bannerShapes.set(first, g);
  return g;
}

function bannerModel(materials, x, y, z, world) {
  const group = new THREE.Group();
  group.name = 'birthday banner';
  const m = new THREE.Mesh(bannerShape(bannerPlace(world, x, y, z)), materials.cloth);
  m.userData.shared = true;
  group.add(m);
  group.userData.banner = true;
  return group;
}

// ---------------------------------------------------------------- a table

const TOP = 0.82;
const CLOTH = '#fffaf2';
const HEM = ['#f7a8c9', '#ffd84d', '#7cc4ff'];
const tableShapes = new Map();

// A place laid at (x, z) on the table: a plate with a cupcake on it, and along
// the table (way: which way that is, [ax, az]) a paper cup and a party hat.
function placeParts(x, z, [ax, az], i) {
  const paper = PAPER_BRIGHT[i % PAPER_BRIGHT.length];
  const other = PAPER_BRIGHT[(i + 2) % PAPER_BRIGHT.length];
  const parts = [
    shape(lathe([[0, 0], [0.085, 0], [0.135, 0.016], [0.13, 0.021], [0.08, 0.008], [0, 0.008]], 18), '#fffdf8', at(x, TOP, z)),
    // The cupcake: a pleated paper case, a swirl of icing and a cherry.
    shape(new THREE.CylinderGeometry(0.05, 0.036, 0.05, 12), paper, at(x, TOP + 0.034, z)),
    ball(x, TOP + 0.066, z, 0.056, 0.026, 0.056, i % 2 ? '#fff4e6' : '#ffc4dc'),
    ball(x, TOP + 0.09, z, 0.036, 0.022, 0.036, i % 2 ? '#fff4e6' : '#ffc4dc'),
    ball(x, TOP + 0.113, z, 0.014, 0.014, 0.014, '#e8333f'),
  ];
  // The cup, a stripe round it.
  const [cx, cz] = [x + ax * 0.28, z + az * 0.28];
  parts.push(
    shape(new THREE.CylinderGeometry(0.038, 0.029, 0.09, 12), other, at(cx, TOP + 0.045, cz)),
    shape(new THREE.CylinderGeometry(0.0375, 0.033, 0.02, 12), '#fffdf8', at(cx, TOP + 0.05, cz)),
  );
  // The party hat: a stripy cone with a pompom.
  const [hx, hz] = [x - ax * 0.28, z - az * 0.28];
  const SECTIONS = 4;
  const hatH = 0.15;
  const hatR = 0.052;
  for (let k = 0; k < SECTIONS; k++) {
    const r1 = hatR * (1 - (k + 1) / SECTIONS);
    const r0 = hatR * (1 - k / SECTIONS);
    parts.push(shape(new THREE.CylinderGeometry(r1, r0, hatH / SECTIONS, 12), k % 2 ? '#fffdf8' : paper, at(hx, TOP + (k + 0.5) * (hatH / SECTIONS), hz)));
  }
  parts.push(ball(hx, TOP + hatH + 0.008, hz, 0.018, 0.018, 0.018, other));
  return parts;
}

// A table's shape: which way there is another beside it (nx: -x, px: +x, nz:
// -z, pz: +z) and whether its places are laid.
function tableShape(nx, px, nz, pz, laid, tint) {
  const key = `${+nx}${+px}${+nz}${+pz}${+laid}${tint}`;
  if (tableShapes.has(key)) return tableShapes.get(key);
  const x0 = nx ? -0.5 : -0.485;
  const x1 = px ? 0.5 : 0.485;
  const z0 = nz ? -0.5 : -0.485;
  const z1 = pz ? 0.5 : 0.485;
  const parts = [cube(x0, TOP - 0.05, z0, x1, TOP, z1, CLOTH)];
  const IN = 0.47;
  // Each open side: a skirt, a band round it and a scalloped hem.
  for (const [open, sx, sz] of [[!nz, 0, -1], [!pz, 0, 1], [!nx, -1, 0], [!px, 1, 0]]) {
    if (!open) continue;
    const [ax0, ax1] = sz ? [x0, x1] : [z0, z1];
    const edge = (u, off) => (sz ? [u, sz * (IN + off)] : [sx * (IN + off), u]);
    const panel = (y0, y1, off, c) => {
      const [a, b] = [edge(ax0, off), edge(ax1, off)];
      const [c0, c1] = [edge(ax0, off - 0.008), edge(ax1, off - 0.008)];
      return cube(Math.min(a[0], c0[0], b[0], c1[0]), y0, Math.min(a[1], c0[1], b[1], c1[1]), Math.max(a[0], c0[0], b[0], c1[0]), y1, Math.max(a[1], c0[1], b[1], c1[1]), c);
    };
    parts.push(panel(0.42, TOP - 0.05, 0, CLOTH), panel(0.56, 0.64, 0.004, HEM[tint % HEM.length]));
    const SCALLOPS = 5;
    for (let k = 0; k < SCALLOPS; k++) {
      const u = ax0 + ((k + 0.5) / SCALLOPS) * (ax1 - ax0);
      const [px2, pz2] = edge(u, 0);
      const across = (ax1 - ax0) / SCALLOPS / 2;
      parts.push(ball(px2, 0.42, pz2, sz ? across : 0.006, 0.045, sz ? 0.006 : across, HEM[(tint + k) % HEM.length]));
    }
  }
  // A white leg at each corner with no table beside it either way.
  for (const [lx, lz, a, b] of [[-0.4, -0.4, nx, nz], [0.4, -0.4, px, nz], [-0.4, 0.4, nx, pz], [0.4, 0.4, px, pz]]) {
    if (!a && !b) parts.push(cube(lx - 0.03, 0, lz - 0.03, lx + 0.03, TOP - 0.05, lz + 0.03, '#f4efe6'));
  }
  if (laid) {
    // A place on each side of a long table, and one on a table on its own.
    const alongZ = nz || pz;
    const alongX = nx || px;
    if (alongZ) for (const s of [-1, 1]) parts.push(...placeParts(s * 0.24, 0, [0, 1], tint + (s > 0 ? 1 : 0)));
    else if (alongX) for (const s of [-1, 1]) parts.push(...placeParts(0, s * 0.24, [1, 0], tint + (s > 0 ? 1 : 0)));
    else parts.push(...placeParts(0, 0, [1, 0], tint));
  }
  const g = paint(parts);
  tableShapes.set(key, g);
  return g;
}

function tableModel(materials, x, y, z, world) {
  const same = (dx, dz) => BLOCKS[world.get(x + dx, y, z + dz)]?.model === 'party-table';
  const laid = world.get(x, y + 1, z) === AIR;
  const tint = (((x + z) % 6) + 6) % 6;
  const group = new THREE.Group();
  group.name = 'party table';
  const m = new THREE.Mesh(tableShape(same(-1, 0), same(1, 0), same(0, -1), same(0, 1), laid, tint), materials.satin);
  m.userData.shared = true;
  group.add(m);
  group.userData.laid = laid;
  return group;
}

// ---------------------------------------------------------------- any of them

// The kinds of block drawn here (blocks.js `real`).
export const PARTY_KINDS = new Set(['party-table', 'birthday-cake', 'present', 'balloons', 'party-banner']);

// The model of a piece of a party standing in cell [x, y, z], in the materials
// given (partyMaterials). world: for what is beside it; party: how it is going
// (shared/party.js Party). What moves goes by the renderer's own time, so
// all of it keeps to the island's clock and none has a time of its own.
export function partyModel(materials, kind, [x, y, z], world, party) {
  const key = keyOf(x, y, z);
  const model =
    kind === 'birthday-cake'
      ? cakeModel(materials, key, party)
      : kind === 'present'
        ? presentModel(materials, x, y, z, key, party, world)
        : kind === 'balloons'
          ? balloonsModel(materials, x, y, z, key, party, world)
          : kind === 'party-banner'
            ? bannerModel(materials, x, y, z, world)
            : tableModel(materials, x, y, z, world);
  model.userData.together = true;
  return model;
}
