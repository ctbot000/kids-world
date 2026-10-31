// The food in the 3D kitchen of a cooking class (render/kitchen3d.js), a
// set of it for each recipe: everything the dish will ever have in it,
// made once, and shown as far as the class has got — eggs cracked into the
// bowl and milk rising round them, flour stirred into a smooth batter, a
// pancake browning in the pan; dough rolled out, sauce where you have
// spread it, cheese melting in the oven; vegetables washed of their mud and
// chopped into more and more pieces; cookies spreading as they bake; soup
// going golden; a sandwich cut in two.
//
// Each set is { group, vesselOf(step), surfaceOf(step), update(f) }, f the
// frame: { step (the one being shown), p (how far it has got), heatOf(k)
// (how hot step k is or came off at), view (the window's hands: covered
// places, spin, down), t, dt }.
import * as THREE from '../../vendor/three.module.js';
import { RoundedBoxGeometry } from '../../vendor/three-addons/geometries/RoundedBoxGeometry.js';
import { DARKEST, GOLDEN } from '../shared/cooking.js';
import { hash2 } from '../shared/rng.js';
import { clamp01, lerp, lumpGeometry, MM, mesh, mixColor, paintTexture, sheetGeometry, TAU, wx, wz } from './kitchen-parts.js';
import { COOKIES, rubPoints, SLICE, VESSEL, wholeAt } from './kitchen.js';

// The vessels' sizes the food sits in (metres; render/kitchen3d.js makes
// the vessels to them). A bowl's inside widens from its floor to its rim.
export const BOWL = { floor: 0.006, rim: 0.068, rIn: (y) => 0.046 + 0.046 * Math.sin(clamp01((y - 0.006) / 0.062) * (Math.PI / 2)) };
export const PAN = { y: 0.026, floor: 0.006, r: 0.078 };
export const POT = { y: 0.026, floor: 0.005, r: 0.074, wall: 0.058 };
export const TRAY = { top: 0.0045, w: 0.25, d: 0.164 };
export const BOARD = { top: 0.02, w: 0.26, d: 0.156 };
export const PLATE = { top: 0.008 };

// How cooked a heat is, as a share: 0 raw, 1 golden, 2 as dark as it gets.
const cooked = (heat) => (heat <= GOLDEN[0] ? heat / GOLDEN[0] : heat <= GOLDEN[1] ? 1 : 1 + (heat - GOLDEN[1]) / (DARKEST - GOLDEN[1]));
// A colour for something cooked that far: raw, golden, then dark.
const bakedColor = (out, raw, golden, dark, c) => (c <= 1 ? mixColor(out, raw, golden, c) : mixColor(out, golden, dark, c - 1));
const easeBack = (t) => {
  const s = 1.7;
  const u = clamp01(t) - 1;
  return 1 + u * u * ((s + 1) * u + s);
};

// Things dropping in: each new one grows into place with a little bounce.
class Arrivals {
  constructor() {
    this.at = new Map();
  }
  // How far key's arrival has got (0-1), it being there now or not.
  scale(key, there, t) {
    if (!there) {
      this.at.delete(key);
      return 0;
    }
    if (!this.at.has(key)) this.at.set(key, t);
    return easeBack((t - this.at.get(key)) / 0.32);
  }
}

// Many of one small thing, placed one by one (hidden ones shrunk away).
class Pieces {
  constructor(geometry, material, n) {
    this.mesh = new THREE.InstancedMesh(geometry, material, n);
    this.mesh.castShadow = this.mesh.receiveShadow = true;
    this.mesh.frustumCulled = false;
    this.n = n;
    this.m = new THREE.Matrix4();
    this.q = new THREE.Quaternion();
    this.e = new THREE.Euler();
    this.p = new THREE.Vector3();
    this.s = new THREE.Vector3();
    this.hideAll();
  }
  hideAll() {
    this.m.makeScale(0, 0, 0);
    for (let i = 0; i < this.n; i++) this.mesh.setMatrixAt(i, this.m);
    this.mesh.instanceMatrix.needsUpdate = true;
  }
  set(i, x, y, z, rx, ry, rz, sx, sy = sx, sz = sx) {
    this.q.setFromEuler(this.e.set(rx, ry, rz));
    this.m.compose(this.p.set(x, y, z), this.q, this.s.set(sx, sy, sz));
    this.mesh.setMatrixAt(i, this.m);
  }
  hide(i) {
    this.m.makeScale(0, 0, 0);
    this.mesh.setMatrixAt(i, this.m);
  }
  done() {
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}

const phys = (o) => new THREE.MeshPhysicalMaterial(o);
const std = (o) => new THREE.MeshStandardMaterial(o);

// A liquid's top, a flat disc (sized each frame).
const liquidDisc = (material) => {
  const m = mesh(new THREE.CircleGeometry(1, 72), material);
  m.rotation.x = -Math.PI / 2;
  m.castShadow = false;
  return m;
};

// Flour, a soft heap.
const flourHeap = (mats, seed) => mesh(lumpGeometry(0.026, 0.017, 0.024, { amp: 0.16, freq: 2.4, seed, flatBottom: true }), mats.flour);

// A cracked egg: its white spread out, the yolk sitting up in it.
function crackedEgg(mats, seed) {
  const g = new THREE.Group();
  const white = mesh(sheetGeometry(0.031, { wobble: 0.22, ruffle: 0.0015, freq: 1.6, seed, dome: 0.0065 }), mats.eggWhite);
  white.castShadow = false;
  const yolk = mesh(lumpGeometry(0.0125, 0.0082, 0.0125, { amp: 0.03, seed }), mats.yolk);
  yolk.position.set(0.004, 0.005, -0.002);
  g.add(white, yolk);
  return g;
}

// A swirl painted on a disc, laid over a liquid being stirred.
const swirlTexture = (colour) =>
  paintTexture(
    256,
    256,
    (x, w) => {
      x.filter = 'blur(3px)';
      x.translate(w / 2, w / 2);
      for (let k = 0; k < 7; k++) {
        x.strokeStyle = colour;
        x.globalAlpha = 0.25 + (k % 3) * 0.12;
        x.lineWidth = 3 + (k % 2) * 3;
        x.beginPath();
        for (let a = 0; a < 5; a += 0.05) {
          const r = 14 + a * 22 + k * 4;
          if (r > 120) break;
          x.lineTo(Math.cos(a + k * 0.9) * r, Math.sin(a + k * 0.9) * r);
        }
        x.stroke();
      }
    },
    { data: true },
  );

// Painted from the places rubbed over (render/kitchen.js rubPoints): a
// texture over a square of the kitchen, x0..x0+size, y0..y0+size (units),
// that a soft blob of colour goes on at each place covered.
class Painted {
  constructor(x0, y0, size, paint) {
    this.x0 = x0;
    this.y0 = y0;
    this.size = size;
    this.paint = paint;
    this.canvas = document.createElement('canvas');
    this.canvas.width = this.canvas.height = 256;
    this.ctx = this.canvas.getContext('2d');
    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.shown = -1;
  }
  // Brought up to the covered places (all of them when `all`).
  update(points, covered, all) {
    let n = 0;
    if (!all) for (let i = 0; i < covered.length; i++) n += covered[i];
    const key = all ? Infinity : n;
    if (key === this.shown) return;
    this.shown = key;
    const c = this.ctx;
    c.clearRect(0, 0, 256, 256);
    const k = 256 / this.size;
    if (all) this.paint(c, null, null, k, 256);
    else points.forEach(([x, y], i) => covered[i] && this.paint(c, (x - this.x0) * k, (y - this.y0) * k, k, 256, i));
    this.texture.needsUpdate = true;
  }
}

// ------------------------------------------------------------ pancakes

function pancakes(mats) {
  const group = new THREE.Group();
  const bowl = new THREE.Group();
  const milk = liquidDisc(mats.milk.clone());
  const swirl = liquidDisc(new THREE.MeshBasicMaterial({ color: '#c99a45', alphaMap: swirlTexture('#fff'), transparent: true, depthWrite: false }));
  const eggs = [crackedEgg(mats, 1), crackedEgg(mats, 2)];
  const eggAt = [
    [-0.022, -0.014],
    [0.02, 0.016],
  ];
  const heaps = [flourHeap(mats, 3), flourHeap(mats, 4)];
  const heapAt = [
    [0.026, -0.026],
    [-0.026, 0.024],
  ];
  bowl.add(milk, swirl, ...eggs, ...heaps);
  // In the pan: the pancake, its top painted as it browns, and bubbles
  // coming up through it before it is done.
  const pan = new THREE.Group();
  const topCanvas = document.createElement('canvas');
  topCanvas.width = topCanvas.height = 256;
  const topTex = new THREE.CanvasTexture(topCanvas);
  topTex.colorSpace = THREE.SRGBColorSpace;
  const top = mesh(new THREE.CircleGeometry(0.058, 72), phys({ map: topTex, roughness: 0.2, clearcoat: 0.6, bumpMap: mats.bump, bumpScale: 0.4 }));
  top.rotation.x = -Math.PI / 2;
  top.position.y = PAN.floor + 0.007;
  const side = mesh(new THREE.CylinderGeometry(0.058, 0.06, 0.007, 72, 1, true), std({ color: '#e9c98b', roughness: 0.5 }));
  side.position.y = PAN.floor + 0.0035;
  const bubbles = new Pieces(new THREE.SphereGeometry(1, 10, 6, 0, TAU, 0, Math.PI / 2), phys({ color: '#f7e9c0', roughness: 0.1, clearcoat: 1, transparent: true, opacity: 0.8 }), 40);
  pan.add(top, side, bubbles.mesh);
  pan.position.y = PAN.y;
  group.add(bowl, pan);
  const arrive = new Arrivals();
  let painted = -1;
  const paintTop = (c) => {
    const key = Math.round(c * 25);
    if (key === painted) return;
    painted = key;
    const x = topCanvas.getContext('2d');
    const base = bakedColor(new THREE.Color(), '#f4e4b6', '#d9963f', '#5e3412', c);
    x.fillStyle = `#${base.getHexString()}`;
    x.fillRect(0, 0, 256, 256);
    // Golden lace: darker patches, thickest in the middle, as it cooks.
    const lace = clamp01(c);
    for (let i = 0; i < 520; i++) {
      const a = hash2(5, i, 1) * TAU;
      const d = Math.sqrt(hash2(5, i, 2)) * 118;
      const r = 3 + hash2(5, i, 3) * 9;
      x.fillStyle = `rgba(${c > 1 ? '60,30,10' : '150,85,25'},${(0.05 + 0.18 * (1 - d / 128)) * lace})`;
      x.beginPath();
      x.arc(128 + Math.cos(a) * d, 128 + Math.sin(a) * d, r, 0, TAU);
      x.fill();
    }
    // A paler edge, and little holes where bubbles burst.
    const edge = x.createRadialGradient(128, 128, 96, 128, 128, 128);
    edge.addColorStop(0, 'rgba(255,240,200,0)');
    edge.addColorStop(1, `rgba(255,240,200,${0.35 * (1 - clamp01(c - 1))})`);
    x.fillStyle = edge;
    x.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 60 * clamp01(c * 1.4); i++) {
      x.fillStyle = 'rgba(120,70,25,0.35)';
      x.beginPath();
      x.arc(128 + (hash2(8, i, 1) - 0.5) * 190, 128 + (hash2(8, i, 2) - 0.5) * 190, 1.5 + hash2(8, i, 3) * 2, 0, TAU);
      x.fill();
    }
    topTex.needsUpdate = true;
  };
  return {
    group,
    vesselOf: (step) => (step < 4 ? 'bowl' : 'pan'),
    surfaceOf: (step) => (step < 4 ? 0.03 : PAN.y + PAN.floor + 0.008),
    update({ step, p, heatOf, view, t }) {
      bowl.visible = step < 4;
      pan.visible = step >= 4;
      if (step < 4) {
        const eggN = step === 0 ? Math.round(p * 2) : 2;
        const level = step === 1 ? p : step > 1 ? 1 : 0;
        const heapN = step === 2 ? Math.round(p * 2) : step > 2 ? 2 : 0;
        const smooth = step === 3 ? p : 0;
        const y = BOWL.floor + 0.002 + level * 0.024 + smooth * 0.004;
        milk.visible = level > 0;
        const r = BOWL.rIn(y) - 0.001;
        milk.scale.set(r, r, 1);
        milk.position.y = y;
        mixColor(milk.material.color, '#f7f4ec', '#f0cf7e', smooth);
        milk.material.roughness = lerp(0.08, 0.2, smooth);
        swirl.visible = step === 3 && smooth < 0.98;
        swirl.scale.set(r * 0.92, r * 0.92, 1);
        swirl.position.y = y + 0.0004;
        swirl.rotation.z = -view.spin;
        swirl.material.opacity = 0.35 * (1 - smooth);
        eggs.forEach((egg, i) => {
          const s = arrive.scale(`egg${i}`, i < eggN, t) * (1 - smooth);
          egg.visible = s > 0.01;
          egg.scale.setScalar(s);
          const turn = step === 3 ? view.spin * 0.6 : 0;
          const [ex, ez] = eggAt[i];
          egg.position.set(ex * Math.cos(turn) - ez * Math.sin(turn), Math.max(BOWL.floor, y - 0.002), ex * Math.sin(turn) + ez * Math.cos(turn));
        });
        heaps.forEach((heap, i) => {
          const s = arrive.scale(`flour${i}`, i < heapN, t) * (1 - smooth);
          heap.visible = s > 0.01;
          heap.scale.setScalar(s);
          const turn = step === 3 ? view.spin * 0.6 : 0;
          const [hx, hz] = heapAt[i];
          heap.position.set(hx * Math.cos(turn) - hz * Math.sin(turn), y - 0.004, hx * Math.sin(turn) + hz * Math.cos(turn));
        });
        return;
      }
      const c = cooked(heatOf(4));
      paintTop(c);
      top.material.roughness = lerp(0.12, 0.62, clamp01(c));
      top.material.clearcoat = lerp(0.8, 0.1, clamp01(c));
      bakedColor(side.material.color, '#ecd49a', '#c98636', '#4f2b0e', c);
      // Bubbles rise and pop while it is still wet on top.
      const wet = c > 0.15 && c < 0.95 ? 1 : 0;
      for (let i = 0; i < bubbles.n; i++) {
        const life = (t * (0.6 + hash2(2, i, 1)) + hash2(2, i, 2)) % 1;
        const a = hash2(2, i, 3) * TAU;
        const d = Math.sqrt(hash2(2, i, 4)) * 0.048;
        const s = wet * Math.sin(life * Math.PI) * (0.0012 + hash2(2, i, 5) * 0.0018) * (i < 40 * c ? 1 : 0);
        if (s <= 0) bubbles.hide(i);
        else bubbles.set(i, Math.cos(a) * d, PAN.floor + 0.007, Math.sin(a) * d, 0, 0, 0, s, s * 0.6, s);
      }
      bubbles.done();
    },
  };
}

// ------------------------------------------------------------ pizza

function pizza(mats) {
  const group = new THREE.Group();
  const doughMat = mats.dough.clone();
  const dough = mesh(lumpGeometry(1, 1, 1, { amp: 0.05, freq: 1.6, seed: 9, flatBottom: true }), doughMat);
  const rim = mesh(new THREE.TorusGeometry(0.066, 0.0068, 14, 96), doughMat);
  rim.rotation.x = -Math.PI / 2;
  const sauce = new Painted(VESSEL.x - 72, VESSEL.y - 72, 144, (c, x, y, k, size, at) => {
    const blob = (bx, by, r, i) => {
      const g = c.createRadialGradient(bx, by, 0, bx, by, r);
      const tone = i % 3 === 0 ? '150,24,10' : i % 3 === 1 ? '178,38,18' : '196,52,26';
      g.addColorStop(0, `rgba(${tone},1)`);
      g.addColorStop(0.75, `rgba(${tone},0.95)`);
      g.addColorStop(1, `rgba(${tone},0)`);
      c.fillStyle = g;
      c.beginPath();
      c.arc(bx, by, r, 0, TAU);
      c.fill();
    };
    if (x === null) {
      c.fillStyle = '#a8200d';
      c.beginPath();
      c.arc(size / 2, size / 2, 63 * k, 0, TAU);
      c.fill();
      for (let i = 0; i < 90; i++) {
        const a = hash2(13, i, 1) * TAU;
        const d = Math.sqrt(hash2(13, i, 2)) * 56 * k;
        blob(size / 2 + Math.cos(a) * d, size / 2 + Math.sin(a) * d, (5 + hash2(13, i, 3) * 6) * k, i);
      }
    } else blob(x, y, 11 * k, Math.floor(hash2(15, at, 1) * 3));
  });
  // Flecks of herbs in the sauce.
  const herbs = paintTexture(256, 256, (c) => {
    for (let i = 0; i < 160; i++) {
      c.fillStyle = i % 2 ? 'rgba(40,80,20,0.7)' : 'rgba(120,20,10,0.5)';
      c.fillRect(hash2(3, i, 1) * 256, hash2(3, i, 2) * 256, 2, 1.5);
    }
  });
  const sauceMesh = mesh(new THREE.PlaneGeometry(0.144, 0.144), phys({ map: sauce.texture, transparent: true, roughness: 0.32, clearcoat: 0.5, depthWrite: false }));
  sauceMesh.rotation.x = -Math.PI / 2;
  sauceMesh.castShadow = false;
  const herbMesh = mesh(new THREE.CircleGeometry(0.06, 48), new THREE.MeshBasicMaterial({ map: herbs, transparent: true, depthWrite: false }));
  herbMesh.rotation.x = -Math.PI / 2;
  const points = rubPoints('pizza', 3);
  const cheeseMat = std({ color: '#f7dc6e', roughness: 0.5 });
  const shreds = new Pieces(new RoundedBoxGeometry(0.011, 0.0014, 0.0018, 1, 0.0006), cheeseMat, points.length);
  // Melted cheese, with golden-brown spots where it bubbled up.
  const meltSpots = paintTexture(256, 256, (c) => {
    for (let i = 0; i < 46; i++) {
      const a = hash2(16, i, 1) * TAU;
      const d = Math.sqrt(hash2(16, i, 2)) * 92;
      const x = 128 + Math.cos(a) * d;
      const y = 128 + Math.sin(a) * d;
      const r = 18 + hash2(16, i, 3) * 20;
      const g = c.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, 'rgba(255,255,255,1)');
      g.addColorStop(0.7, 'rgba(255,255,255,0.95)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      c.fillStyle = g;
      c.fillRect(x - r, y - r, r * 2, r * 2);
    }
    for (let i = 0; i < 70; i++) {
      const x = 128 + (hash2(14, i, 1) - 0.5) * 220;
      const y = 128 + (hash2(14, i, 2) - 0.5) * 220;
      const r = 4 + hash2(14, i, 3) * 12;
      const g = c.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, 'rgba(176,102,30,0.75)');
      g.addColorStop(1, 'rgba(176,102,30,0)');
      c.fillStyle = g;
      c.fillRect(x - r, y - r, r * 2, r * 2);
    }
  });
  const melt = mesh(new THREE.CircleGeometry(0.06, 64), phys({ color: '#f2c14e', map: meltSpots, alphaMap: meltSpots, roughness: 0.28, clearcoat: 0.7, transparent: true, depthWrite: false }));
  melt.rotation.x = -Math.PI / 2;
  group.add(dough, rim, sauceMesh, herbMesh, shreds.mesh, melt);
  const arrive = new Arrivals();
  return {
    group,
    vesselOf: () => 'tray',
    surfaceOf: (step) => TRAY.top + (step === 0 ? 0.02 : 0.008),
    update({ step, p, heatOf, view, t }) {
      const rolled = step === 1 ? p : step > 1 ? 1 : 0;
      const s = arrive.scale('dough', step > 0 || p > 0, t);
      const rx = lerp(0.03, 0.071, rolled);
      const ry = lerp(0.026, 0.0045, rolled);
      dough.visible = s > 0.01;
      dough.scale.set(rx * s, ry * s, rx * s * (1 - 0.04 * rolled));
      dough.position.y = TRAY.top;
      const c = step === 4 ? cooked(heatOf(4)) : 0;
      bakedColor(doughMat.color, '#efd9ac', '#d9963f', '#6b3812', c);
      rim.visible = rolled > 0.85;
      rim.scale.setScalar(lerp(0.9, 1, clamp01((rolled - 0.85) / 0.15)));
      rim.position.y = TRAY.top + 0.004;
      const top = TRAY.top + ry * 0.92 + 0.0005;
      sauceMesh.visible = step >= 2;
      sauceMesh.position.y = top;
      if (step === 2) sauce.update(view.points, view.covered, false);
      else if (step > 2) sauce.update(null, null, true);
      herbMesh.visible = step > 2;
      herbMesh.position.y = top + 0.0003;
      // Cheese: a shred at each place sprinkled, melting in the oven.
      const m = clamp01(c);
      bakedColor(cheeseMat.color, '#f7dc6e', '#f0b93c', '#9b5a17', c);
      // Shreds melt away into the cheese as it bakes.
      const gone = clamp01((m - 0.45) / 0.45);
      for (let i = 0; i < points.length; i++) {
        const shown = step === 3 ? view.covered?.[i] : step > 3;
        if (!shown || gone >= 1) {
          shreds.hide(i);
          continue;
        }
        const [x, y] = points[i];
        const j = (hash2(4, i, 1) - 0.5) * 6;
        shreds.set(i, wx(x + j), top + 0.0012 + hash2(4, i, 2) * 0.0015, wz(y + (hash2(4, i, 3) - 0.5) * 6), (hash2(4, i, 4) - 0.5) * 0.4, hash2(4, i, 5) * TAU, 0, lerp(1, 1.3, m) * (1 - gone), lerp(1, 0.2, m) * (1 - gone), lerp(1, 1.3, m) * (1 - gone));
      }
      shreds.done();
      melt.visible = step === 4 && m > 0.05;
      melt.position.y = top + 0.0009;
      melt.material.opacity = m * 0.95;
      bakedColor(melt.material.color, '#f8dc78', '#f0b53c', '#8a4d14', c);
    },
  };
}

// ------------------------------------------------------------ salad

const SALAD = ['🥬', '🍅', '🥒'];
// How high the top of each whole vegetable is.
const SALAD_TOP = [0.024, 0.038, 0.024];

function lettuceHead(mats, seed) {
  const g = new THREE.Group();
  const leaf = std({ color: '#6fb43e', roughness: 0.45, side: THREE.DoubleSide, bumpMap: mats.bump, bumpScale: 0.5 });
  const pale = std({ color: '#b6dc6a', roughness: 0.45, side: THREE.DoubleSide });
  for (let k = 0; k < 5; k++) {
    const m = mesh(sheetGeometry(0.026 - k * 0.003, { wobble: 0.28, ruffle: 0.006, freq: 3.5, seed: seed + k, dome: 0.012 - k * 0.0015 }), k > 2 ? pale : leaf);
    m.position.set((hash2(seed, k, 1) - 0.5) * 0.01, 0.003 + k * 0.0035, (hash2(seed, k, 2) - 0.5) * 0.01);
    m.rotation.y = k * 1.3;
    g.add(m);
  }
  return g;
}

function tomato(mats, r = 0.021) {
  const g = new THREE.Group();
  const body = mesh(lumpGeometry(r, r * 0.84, r, { amp: 0.035, freq: 2.5, seed: 4 }), phys({ color: '#d42a18', roughness: 0.18, clearcoat: 1, clearcoatRoughness: 0.1 }));
  body.position.y = r * 0.84;
  g.add(body);
  const green = std({ color: '#3f7d26', roughness: 0.6 });
  for (let k = 0; k < 5; k++) {
    const leaf = mesh(new THREE.ConeGeometry(0.0022, 0.012, 5), green);
    leaf.rotation.z = Math.PI / 2;
    leaf.position.set(0.005, 0, 0);
    const holder = new THREE.Group();
    holder.add(leaf);
    holder.rotation.y = (k / 5) * TAU;
    holder.position.y = r * 1.66;
    g.add(holder);
  }
  const stem = mesh(new THREE.CylinderGeometry(0.0012, 0.0016, 0.006, 6), green);
  stem.position.y = r * 1.7;
  g.add(stem);
  return g;
}

function cucumber(mats) {
  const stripes = paintTexture(128, 64, (x, w, h) => {
    x.fillStyle = '#2f6a26';
    x.fillRect(0, 0, w, h);
    for (let i = 0; i < 9; i++) {
      x.fillStyle = 'rgba(140,190,90,0.35)';
      x.fillRect(0, (i / 9) * h, w, 2);
    }
    for (let i = 0; i < 120; i++) {
      x.fillStyle = 'rgba(200,230,170,0.5)';
      x.fillRect(hash2(6, i, 1) * w, hash2(6, i, 2) * h, 1.5, 1.5);
    }
  });
  const m = mesh(new THREE.CapsuleGeometry(0.0115, 0.072, 8, 24), std({ map: stripes, roughness: 0.38, bumpMap: mats.bump, bumpScale: 0.6 }));
  m.rotation.z = Math.PI / 2;
  m.position.y = 0.0115;
  const g = new THREE.Group();
  g.add(m);
  g.rotation.y = 0.35;
  return g;
}

// A cut-open slice: its skin round the side and its pale inside on top.
const slice = (r, h, skin, inside) => {
  const g = new THREE.CylinderGeometry(r, r, h, 20);
  return { geometry: g, material: [skin, inside, inside] };
};

function salad(mats) {
  const group = new THREE.Group();
  const board = new THREE.Group();
  const whole = [lettuceHead(mats, 1), tomato(mats), cucumber(mats)];
  whole[0].scale.setScalar(1.35);
  whole.forEach((w, i) => {
    w.position.set(wx(wholeAt(SALAD, i)[0]), BOARD.top, 0);
    board.add(w);
  });
  // Mud on the vegetables until they are washed.
  const washPoints = rubPoints('salad', 0);
  const muddy = washPoints.map(([x, y], i) => {
    const k = SALAD.findIndex((_, k) => Math.hypot(x - wholeAt(SALAD, k)[0], y - wholeAt(SALAD, k)[1]) < 24);
    return k >= 0 && hash2(4, x, y) < 0.35 ? k : -1;
  });
  const mud = new Pieces(lumpGeometry(0.0042, 0.0016, 0.0036, { amp: 0.3, freq: 3, seed: 2, detail: 10 }), std({ color: '#6a4a2c', roughness: 1 }), washPoints.length);
  board.add(mud.mesh);
  // The pieces, chopped and then in the bowl.
  const lettuceBits = new Pieces(sheetGeometry(0.017, { wobble: 0.35, ruffle: 0.004, freq: 2, seed: 5, segments: 32, rings: 5, dome: 0.006 }), std({ color: '#79bd45', roughness: 0.4, side: THREE.DoubleSide, bumpMap: mats.bump, bumpScale: 0.4 }), 30);
  const tomatoBits = new Pieces(lumpGeometry(0.0085, 0.007, 0.0075, { amp: 0.12, freq: 2, seed: 8, detail: 14 }), phys({ color: '#d42a18', roughness: 0.16, clearcoat: 1 }), 30);
  const cuke = slice(0.0115, 0.0038, std({ color: '#2f6a26', roughness: 0.4 }), std({ color: '#cfe6a0', roughness: 0.3 }));
  const cukeBits = new Pieces(cuke.geometry, cuke.material, 30);
  const bits = [lettuceBits, tomatoBits, cukeBits];
  const drops = new Pieces(lumpGeometry(0.0035, 0.0007, 0.0035, { amp: 0.15, detail: 12 }), phys({ color: '#e2c84e', roughness: 0.02, clearcoat: 1, transparent: true, opacity: 0.55 }), 30);
  const pile = new THREE.Group();
  for (const b of bits) pile.add(b.mesh);
  group.add(board, pile, drops.mesh);
  return {
    group,
    vesselOf: (step) => (step < 2 ? 'board' : 'bowl'),
    surfaceOf: (step) => (step < 2 ? BOARD.top + 0.02 : 0.045),
    update({ step, p, view, t }) {
      board.visible = step < 2;
      const chops = step === 1 ? Math.round(p * 6) : step > 1 ? 6 : 0;
      whole.forEach((w) => (w.visible = step === 0 || (step === 1 && chops === 0)));
      for (let i = 0; i < washPoints.length; i++) {
        const k = muddy[i];
        if (step !== 0 || k < 0 || view.covered?.[i]) {
          mud.hide(i);
          continue;
        }
        const [x, y] = washPoints[i];
        const [cx, cy] = wholeAt(SALAD, k);
        const d = Math.hypot(x - cx, y - cy) / 24;
        mud.set(i, wx(x), BOARD.top + SALAD_TOP[k] * Math.sqrt(Math.max(0.05, 1 - d * d)) + 0.001, wz(y), 0, hash2(1, i, 1) * TAU, 0, 1);
      }
      mud.done();
      // Chopped: more and smaller pieces with every chop, on the board; in
      // the bowl, all of them in a heap, tossed round as you stir.
      const inBowl = step >= 2;
      pile.rotation.y = step === 3 ? -view.spin * 0.7 : 0;
      bits.forEach((b, k) => {
        const n = chops ? Math.min(b.n, inBowl ? b.n : 2 + chops * 2) : 0;
        const size = chops ? 1 / Math.sqrt(1 + (chops - 1) * 0.2) : 1;
        for (let i = 0; i < b.n; i++) {
          if (i >= n) {
            b.hide(i);
            continue;
          }
          let x;
          let y;
          let z;
          if (inBowl) {
            const a = hash2(10 + k, i, 1) * TAU;
            const d = Math.sqrt(hash2(10 + k, i, 2)) * 0.062;
            const bounce = step === 3 && view.down ? Math.abs(Math.sin(t * 9 + i * 1.7)) * 0.006 : 0;
            x = Math.cos(a) * d;
            z = Math.sin(a) * d;
            // A heap, highest in the middle, filling the bowl's curve.
            y = Math.max(BOWL.floor + 0.004, BOWL.floor + 0.03 * (1 - (d / 0.062) ** 2) + 0.012 * (d / 0.062) ** 2) + hash2(10 + k, i, 3) * 0.008 + bounce;
          } else {
            const spread = 0.008 + chops * 0.0035;
            x = wx(wholeAt(SALAD, k)[0]) + (hash2(20 + k, i, 1) - 0.5) * 2 * spread;
            z = (hash2(20 + k, i, 2) - 0.5) * 2 * spread * 1.4;
            y = BOARD.top + 0.004;
          }
          const tilt = inBowl ? (hash2(30 + k, i, 1) - 0.5) * 1.6 : 0;
          b.set(i, x, y, z, tilt, hash2(30 + k, i, 2) * TAU, tilt * 0.5, size * (k === 2 ? 1 : 1.1));
        }
        b.done();
      });
      const oil = step === 2 ? p : step > 2 ? 1 : 0;
      for (let i = 0; i < drops.n; i++) {
        if (i >= oil * drops.n) {
          drops.hide(i);
          continue;
        }
        const a = hash2(40, i, 1) * TAU + (step === 3 ? -view.spin * 0.7 : 0);
        const d = Math.sqrt(hash2(40, i, 2)) * 0.05;
        drops.set(i, Math.cos(a) * d, BOWL.floor + 0.042 - (d / 0.05) * 0.016, Math.sin(a) * d, 0, a, 0, 0.7 + hash2(40, i, 3) * 0.6);
      }
      drops.done();
    },
  };
}

// ------------------------------------------------------------ cookies

function cookies(mats) {
  const group = new THREE.Group();
  const bowl = new THREE.Group();
  const butter = mesh(new RoundedBoxGeometry(0.046, 0.022, 0.032, 3, 0.004), mats.butter);
  butter.position.set(-0.006, BOWL.floor + 0.011, 0.004);
  butter.rotation.y = 0.4;
  const heaps = [flourHeap(mats, 7), flourHeap(mats, 8)];
  const heapAt = [
    [0.03, -0.022],
    [-0.03, 0.026],
  ];
  const doughMat = mats.dough.clone();
  doughMat.color.set('#e6c48c');
  const doughBall = mesh(lumpGeometry(0.056, 0.024, 0.05, { amp: 0.12, freq: 2.2, seed: 6, flatBottom: true }), doughMat);
  doughBall.position.y = BOWL.floor;
  bowl.add(butter, ...heaps, doughBall);
  // On the tray: baking paper and six balls of dough, chips on top.
  const tray = new THREE.Group();
  const paper = mesh(new THREE.PlaneGeometry(0.228, 0.146), mats.parchment);
  paper.rotation.x = -Math.PI / 2;
  paper.position.y = TRAY.top + 0.0004;
  tray.add(paper);
  const ballMat = mats.dough.clone();
  ballMat.color.set('#e8c995');
  const balls = COOKIES.map(([x, y], i) => {
    const b = mesh(lumpGeometry(0.02, 0.014, 0.02, { amp: 0.1, freq: 2.5, seed: 20 + i, flatBottom: true }), ballMat);
    b.position.set(wx(x), TRAY.top + 0.0005, wz(y));
    tray.add(b);
    return b;
  });
  const points = rubPoints('cookies', 3);
  const chipGeo = new THREE.ConeGeometry(0.0034, 0.0042, 8);
  const chipMat = phys({ color: '#3a2112', roughness: 0.3, clearcoat: 0.5 });
  const chips = new Pieces(chipGeo, chipMat, points.length);
  tray.add(chips.mesh);
  group.add(bowl, tray);
  const arrive = new Arrivals();
  // How high the top of a cookie is over a place on it.
  const ballTop = (x, y, h) => {
    for (const [cx, cy] of COOKIES) {
      const d = Math.hypot(x - cx, y - cy) / 21;
      if (d < 1) return TRAY.top + h * Math.sqrt(1 - d * d);
    }
    return TRAY.top;
  };
  return {
    group,
    vesselOf: (step) => (step < 3 ? 'bowl' : 'tray'),
    surfaceOf: (step) => (step < 3 ? 0.03 : TRAY.top + 0.012),
    update({ step, p, heatOf, view, t }) {
      bowl.visible = step < 3;
      tray.visible = step >= 3;
      if (step < 3) {
        const smooth = step === 2 ? p : 0;
        const b = arrive.scale('butter', step > 0 || p > 0, t) * (1 - smooth);
        butter.visible = b > 0.01;
        butter.scale.setScalar(b);
        const heapN = step === 1 ? Math.round(p * 2) : step > 1 ? 2 : 0;
        heaps.forEach((heap, i) => {
          const s = arrive.scale(`flour${i}`, i < heapN, t) * (1 - smooth);
          heap.visible = s > 0.01;
          heap.scale.setScalar(s);
          const turn = step === 2 ? view.spin * 0.6 : 0;
          const [hx, hz] = heapAt[i];
          heap.position.set(hx * Math.cos(turn) - hz * Math.sin(turn), BOWL.floor, hx * Math.sin(turn) + hz * Math.cos(turn));
        });
        doughBall.visible = smooth > 0.02;
        doughBall.scale.setScalar(lerp(0.4, 1, smooth));
        doughBall.rotation.y = -view.spin * 0.5;
        return;
      }
      const c = step === 4 ? cooked(heatOf(4)) : 0;
      const spread = clamp01(c);
      bakedColor(ballMat.color, '#e8c995', '#d39048', '#5c3210', c);
      const h = lerp(0.014, 0.0075, spread);
      for (const b of balls) b.scale.set(lerp(1, 1.32, spread), lerp(1, 0.54, spread), lerp(1, 1.32, spread));
      for (let i = 0; i < points.length; i++) {
        const shown = step === 3 ? view.covered?.[i] && i % 2 === 0 : i % 2 === 0;
        const [x, y] = points[i];
        const top = ballTop(x, y, h);
        if (!shown || top <= TRAY.top + 0.001) {
          chips.hide(i);
          continue;
        }
        const s = 1 + spread * 0.3;
        chips.set(i, wx(x) * (1 + spread * 0.32) - wx(COOKIES.find(([cx, cy]) => Math.hypot(x - cx, y - cy) < 21)[0]) * spread * 0.32, top + 0.0012, wz(y), (hash2(5, i, 1) - 0.5) * 0.5, 0, (hash2(5, i, 2) - 0.5) * 0.5, s, s * (1 - spread * 0.3), s);
      }
      chips.done();
    },
  };
}

// ------------------------------------------------------------ soup

const SOUP = ['🥕', '🥔'];

function carrot() {
  const g = new THREE.Group();
  const body = mesh(new THREE.ConeGeometry(0.0125, 0.1, 24, 8), std({ color: '#f1771b', roughness: 0.5 }));
  body.rotation.z = Math.PI / 2;
  body.position.y = 0.0125;
  g.add(body);
  const green = std({ color: '#4c8c2b', roughness: 0.6 });
  for (let k = -1; k <= 1; k++) {
    const top = mesh(new THREE.CylinderGeometry(0.0012, 0.0016, 0.03, 5), green);
    top.rotation.z = Math.PI / 2 + k * 0.35;
    top.position.set(-0.064, 0.0125, k * 0.004);
    g.add(top);
  }
  g.rotation.y = -0.25;
  return g;
}

function potato() {
  const p = mesh(lumpGeometry(0.03, 0.021, 0.025, { amp: 0.09, freq: 1.6, seed: 12, flatBottom: true }), std({ color: '#b48a55', roughness: 0.85 }));
  return p;
}

function soup(mats) {
  const group = new THREE.Group();
  const board = new THREE.Group();
  const whole = [carrot(), potato()];
  whole.forEach((w, i) => {
    w.position.set(wx(wholeAt(SOUP, i)[0]) - (i ? 0 : 0.01), BOARD.top, 0);
    board.add(w);
  });
  const coin = slice(0.0105, 0.0042, std({ color: '#e96d16', roughness: 0.5 }), std({ color: '#f79a45', roughness: 0.45 }));
  const coins = new Pieces(coin.geometry, coin.material, 18);
  const cubes = new Pieces(new RoundedBoxGeometry(0.012, 0.011, 0.012, 2, 0.0022), std({ color: '#efdca2', roughness: 0.6 }), 18);
  const bits = [coins, cubes];
  const pieces = new THREE.Group();
  for (const b of bits) pieces.add(b.mesh);
  const broth = liquidDisc(mats.water.clone());
  const bubbles = new Pieces(new THREE.SphereGeometry(1, 10, 8), phys({ color: '#ffffff', roughness: 0.05, transparent: true, opacity: 0.55, clearcoat: 1 }), 40);
  const salt = new Pieces(new THREE.BoxGeometry(0.0012, 0.0012, 0.0012), std({ color: '#ffffff', roughness: 0.4 }), 40);
  const pot = new THREE.Group();
  pot.add(broth, bubbles.mesh, salt.mesh);
  pot.position.y = POT.y;
  group.add(board, pieces, pot);
  return {
    group,
    vesselOf: (step) => (step < 1 ? 'board' : 'pot'),
    surfaceOf: (step) => (step < 1 ? BOARD.top + 0.02 : POT.y + POT.floor + 0.035),
    update({ step, p, heatOf, t }) {
      board.visible = step < 1;
      const chops = step === 0 ? Math.round(p * 6) : 6;
      whole.forEach((w) => (w.visible = step === 0 && chops === 0));
      const inPot = step >= 1;
      const level = step === 1 ? p : step > 1 ? 1 : 0;
      const waterY = POT.floor + 0.004 + level * 0.034;
      const c = step === 2 ? cooked(heatOf(2)) : step > 2 ? cooked(heatOf(2)) : 0;
      bits.forEach((b, k) => {
        const n = chops ? Math.min(b.n, 3 + chops * 2) : 0;
        const size = chops ? 1 / Math.sqrt(1 + (chops - 1) * 0.25) : 1;
        for (let i = 0; i < b.n; i++) {
          if (i >= n) {
            b.hide(i);
            continue;
          }
          let x;
          let y;
          let z;
          if (inPot) {
            const a = hash2(50 + k, i, 1) * TAU + (step === 2 ? t * 0.3 * clamp01(c) : 0);
            const d = Math.sqrt(hash2(50 + k, i, 2)) * 0.058;
            x = Math.cos(a) * d;
            z = Math.sin(a) * d;
            y = POT.y + POT.floor + 0.004 + hash2(50 + k, i, 3) * 0.008 + (step === 2 ? Math.sin(t * 4 + i) * 0.002 * clamp01(c) : 0);
          } else {
            const spread = 0.01 + chops * 0.004;
            x = wx(wholeAt(SOUP, k)[0]) + (hash2(60 + k, i, 1) - 0.5) * 2 * spread;
            z = (hash2(60 + k, i, 2) - 0.5) * 2 * spread * 1.3;
            y = BOARD.top + 0.0055;
          }
          const tilt = inPot ? (hash2(70 + k, i, 1) - 0.5) * 2 : k === 0 ? 0 : 0;
          b.set(i, x, y, z, tilt, hash2(70 + k, i, 2) * TAU, 0, size);
        }
        b.done();
      });
      pieces.visible = chops > 0;
      broth.visible = level > 0;
      broth.scale.set(POT.r - 0.001, POT.r - 0.001, 1);
      broth.position.y = waterY;
      bakedColor(broth.material.color, '#a9d6ef', '#d9892c', '#9a4a14', c);
      broth.material.opacity = lerp(0.45, 0.72, clamp01(c));
      // Bubbles coming up as it simmers.
      const boil = step === 2 ? clamp01(c * 1.2) : 0;
      for (let i = 0; i < bubbles.n; i++) {
        const life = (t * (0.8 + hash2(9, i, 1)) + hash2(9, i, 2)) % 1;
        const a = hash2(9, i, 3) * TAU;
        const d = Math.sqrt(hash2(9, i, 4)) * (POT.r - 0.006);
        const s = i < boil * bubbles.n ? Math.sin(life * Math.PI) * (0.0015 + hash2(9, i, 5) * 0.003) : 0;
        if (s <= 0) bubbles.hide(i);
        else bubbles.set(i, Math.cos(a) * d, waterY + s * 0.3, Math.sin(a) * d, 0, 0, 0, s, s * 0.7, s);
      }
      bubbles.done();
      // Salt on top, a pinch more with every shake.
      const grains = step === 3 ? Math.round(p * 3) * 13 : 0;
      for (let i = 0; i < salt.n; i++) {
        if (i >= grains) {
          salt.hide(i);
          continue;
        }
        const a = hash2(11, i, 1) * TAU;
        const d = Math.sqrt(hash2(11, i, 2)) * 0.03;
        salt.set(i, Math.cos(a) * d, waterY + 0.0006, Math.sin(a) * d, 0, a, 0, 1);
      }
      salt.done();
    },
  };
}

// ------------------------------------------------------------ sandwich

function breadSlice(mats, w = 0.112) {
  const g = new THREE.Group();
  const crust = mesh(new RoundedBoxGeometry(w, 0.013, 0.112, 3, 0.005), mats.crust);
  crust.position.y = 0.0065;
  const top = mesh(new THREE.PlaneGeometry(w - 0.01, 0.102), mats.crumb);
  top.rotation.x = -Math.PI / 2;
  top.position.y = 0.0132;
  g.add(crust, top);
  return g;
}

function sandwich(mats) {
  const group = new THREE.Group();
  const stack = new THREE.Group();
  const bottom = breadSlice(mats);
  const butter = new Painted(SLICE.x, SLICE.y, SLICE.w, (c, x, y, k, size) => {
    c.fillStyle = 'rgba(250,224,120,0.85)';
    if (x === null) c.fillRect(6 * k, 6 * k, size - 12 * k, size - 12 * k);
    else {
      c.beginPath();
      c.arc(x, y, 8 * k, 0, TAU);
      c.fill();
    }
  });
  const butterMesh = mesh(new THREE.PlaneGeometry(SLICE.w * MM, SLICE.h * MM), phys({ map: butter.texture, transparent: true, roughness: 0.2, clearcoat: 0.8, depthWrite: false }));
  butterMesh.rotation.x = -Math.PI / 2;
  butterMesh.position.y = 0.0134;
  butterMesh.castShadow = false;
  const leafMat = std({ color: '#71b83f', roughness: 0.4, side: THREE.DoubleSide, bumpMap: mats.bump, bumpScale: 0.6 });
  const lettuce = mesh(sheetGeometry(0.068, { wobble: 0.16, ruffle: 0.007, freq: 5, seed: 3, dome: 0.003 }), leafMat);
  lettuce.position.y = 0.0145;
  const cheese = mesh(new RoundedBoxGeometry(0.098, 0.003, 0.098, 1, 0.001), phys({ color: '#f5b93a', roughness: 0.45, clearcoat: 0.2, sheen: 0.3, sheenColor: new THREE.Color('#ffe08a') }));
  cheese.position.y = 0.0205;
  cheese.rotation.y = 0.26;
  const topSlice = breadSlice(mats);
  topSlice.position.y = 0.0225;
  stack.add(bottom, butterMesh, lettuce, cheese, topSlice);
  stack.position.y = PLATE.top;
  // Cut in two: the halves, a little apart.
  const halves = new THREE.Group();
  for (const side of [-1, 1]) {
    const half = new THREE.Group();
    const b = breadSlice(mats, 0.056);
    const l = mesh(sheetGeometry(0.034, { wobble: 0.2, ruffle: 0.006, freq: 4, seed: 5 + side, dome: 0.002 }), leafMat);
    l.scale.set(1, 1, 1.9);
    l.position.y = 0.0145;
    const ch = mesh(new RoundedBoxGeometry(0.052, 0.003, 0.098, 1, 0.001), cheese.material);
    ch.position.y = 0.0205;
    const tp = breadSlice(mats, 0.056);
    tp.position.y = 0.0225;
    half.add(b, l, ch, tp);
    half.position.set(side * 0.034, PLATE.top, 0);
    half.rotation.y = side * 0.08;
    halves.add(half);
  }
  group.add(stack, halves);
  const arrive = new Arrivals();
  return {
    group,
    vesselOf: () => 'plate',
    surfaceOf: (step) => PLATE.top + 0.014 + (step >= 3 ? 0.008 : 0),
    update({ step, p, view, t, done }) {
      const cut = done;
      stack.visible = !cut;
      halves.visible = cut;
      const s = arrive.scale('bread', step > 0 || p > 0, t);
      bottom.visible = s > 0.01;
      bottom.scale.setScalar(s);
      butterMesh.visible = step >= 1;
      if (step === 1) butter.update(view.points, view.covered, false);
      else if (step > 1) butter.update(null, null, true);
      const l = arrive.scale('lettuce', step > 2 || (step === 2 && p > 0), t);
      lettuce.visible = l > 0.01;
      lettuce.scale.setScalar(l);
      const c = arrive.scale('cheese', step > 3 || (step === 3 && p > 0), t);
      cheese.visible = c > 0.01;
      cheese.scale.setScalar(c);
      const tp = arrive.scale('top', step >= 4, t);
      topSlice.visible = tp > 0.01;
      topSlice.scale.setScalar(tp);
    },
  };
}

export const FOODS = { pancakes, pizza, salad, cookies, soup, sandwich };
