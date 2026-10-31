// The kitchen of a cooking class in 3D (ui.js cookingDialog), close up and
// seen from above as you stand at the counter: a speckled granite worktop
// under warm light, with soft shadows and real reflections (a studio room,
// RoomEnvironment). On it what the step is done in — a glazed bowl, a
// frying pan or a saucepan on a gas burner with its blue flames, a baking
// tray (inside the glowing oven while it bakes), an oak chopping board or a
// porcelain plate — the food as far as the class has got
// (render/kitchen-food.js), and what is in your hand where your hand is: the
// egg, the milk carton tipping to pour, the wooden spoon stirring, the knife
// coming down, the rolling pin rolling. Steam rises off what is cooking.
//
// The window's hands work in the kitchen's own units (render/kitchen.js):
// toKitchen turns a point on the screen into them, where it meets the food,
// and toScreen the other way. A WebGL context of its own, like the
// gashapon's (render/gasha-stage.js).
import * as THREE from '../../vendor/three.module.js';
import { RoomEnvironment } from '../../vendor/three-addons/environments/RoomEnvironment.js';
import { RoundedBoxGeometry } from '../../vendor/three-addons/geometries/RoundedBoxGeometry.js';
import { recipeByKey } from '../shared/cooking.js';
import { hash2 } from '../shared/rng.js';
import { BOARD, BOWL, FOODS, PAN, PLATE, POT, TRAY } from './kitchen-food.js';
import { kitchenMaterials, lathe, lumpGeometry, MM, mesh, paintTexture, puffTexture, sheetGeometry, TAU, wx, wz } from './kitchen-parts.js';
import { VESSEL } from './kitchen.js';

const ease = (t) => 1 - (1 - Math.max(0, Math.min(1, t))) ** 3;

// ------------------------------------------------------------ vessels

function bowl(mats) {
  const g = new THREE.Group();
  const outer = [];
  const inner = [];
  for (let k = 0; k <= 24; k++) {
    const y = BOWL.floor + (k / 24) * (BOWL.rim - BOWL.floor);
    inner.push([BOWL.rIn(y), y]);
    outer.push([BOWL.rIn(y) + 0.004 + 0.002 * (1 - k / 24), y - 0.006 * (1 - k / 24)]);
  }
  g.add(lathe([[0, 0], [0.04, 0], [0.044, 0.002], ...outer], mats.ceramicOut));
  g.add(lathe([...inner.reverse(), [0, BOWL.floor]], mats.ceramicIn));
  const rim = mesh(new THREE.TorusGeometry(BOWL.rIn(BOWL.rim) + 0.002, 0.0024, 12, 96), mats.ceramicIn);
  rim.rotation.x = -Math.PI / 2;
  rim.position.y = BOWL.rim;
  g.add(rim);
  return g;
}

function pan(mats) {
  const g = new THREE.Group();
  g.add(lathe([[0, 0], [0.074, 0], [0.08, 0.003], [0.089, 0.03], [0.091, 0.032]], mats.panOut));
  g.add(lathe([[0.087, 0.032], [0.079, 0.007], [0.075, PAN.floor], [0, PAN.floor]], mats.nonstick));
  const lip = mesh(new THREE.TorusGeometry(0.089, 0.0022, 10, 96), mats.steel);
  lip.rotation.x = -Math.PI / 2;
  lip.position.y = 0.032;
  const handle = mesh(new RoundedBoxGeometry(0.12, 0.012, 0.018, 3, 0.005), mats.bakelite);
  handle.position.set(0.15, 0.036, 0);
  handle.rotation.z = 0.12;
  const neck = mesh(new THREE.CylinderGeometry(0.005, 0.006, 0.03, 12), mats.steel);
  neck.rotation.z = Math.PI / 2 + 0.12;
  neck.position.set(0.098, 0.03, 0);
  g.add(lip, handle, neck);
  g.position.y = PAN.y;
  return g;
}

function pot(mats) {
  const g = new THREE.Group();
  g.add(lathe([[0, 0], [POT.r + 0.002, 0], [POT.r + 0.004, 0.004], [POT.r + 0.004, POT.wall]], mats.steel));
  g.add(lathe([[POT.r, POT.wall], [POT.r, POT.floor], [0, POT.floor]], mats.steel));
  const lip = mesh(new THREE.TorusGeometry(POT.r + 0.003, 0.0025, 10, 96), mats.steel);
  lip.rotation.x = -Math.PI / 2;
  lip.position.y = POT.wall;
  g.add(lip);
  for (const side of [-1, 1]) {
    const h = mesh(new THREE.TorusGeometry(0.014, 0.0035, 10, 24, Math.PI), mats.steel);
    h.rotation.set(-Math.PI / 2, 0, side > 0 ? -Math.PI / 2 : Math.PI / 2);
    h.position.set(side * (POT.r + 0.004), POT.wall - 0.01, 0);
    g.add(h);
  }
  g.position.y = POT.y;
  return g;
}

function tray(mats) {
  const g = new THREE.Group();
  const base = mesh(new RoundedBoxGeometry(TRAY.w, 0.004, TRAY.d, 2, 0.0015), mats.alu);
  base.position.y = 0.002;
  g.add(base);
  const lip = (w, d, x, z) => {
    const m = mesh(new RoundedBoxGeometry(w, 0.012, d, 2, 0.0015), mats.alu);
    m.position.set(x, 0.008, z);
    g.add(m);
  };
  lip(TRAY.w, 0.005, 0, -TRAY.d / 2);
  lip(TRAY.w, 0.005, 0, TRAY.d / 2);
  lip(0.005, TRAY.d, -TRAY.w / 2, 0);
  lip(0.005, TRAY.d, TRAY.w / 2, 0);
  return g;
}

function board(mats) {
  const m = mesh(new RoundedBoxGeometry(BOARD.w, BOARD.top, BOARD.d, 4, 0.006), mats.wood);
  m.position.y = BOARD.top / 2;
  const g = new THREE.Group();
  g.add(m);
  return g;
}

function plate(mats) {
  const g = new THREE.Group();
  g.add(lathe([[0, PLATE.top], [0.066, PLATE.top], [0.074, 0.009], [0.1, 0.017], [0.104, 0.018], [0.103, 0.016], [0.078, 0.007], [0.06, 0.002], [0.056, 0], [0, 0]], mats.porcelain));
  return g;
}

// The gas burner the pan and the pot stand on: a black glass hob, the
// burner's cap, cast-iron grate arms, and a ring of blue flames.
function burner(mats) {
  const g = new THREE.Group();
  const hob = mesh(new THREE.BoxGeometry(1.4, 0.012, 1.0), mats.cooktop);
  hob.position.y = -0.006;
  g.add(hob);
  const ring = lathe([[0, 0.002], [0.05, 0.002], [0.05, 0.008], [0.046, 0.01], [0, 0.01]], mats.steel, 48);
  const cap = mesh(new THREE.CylinderGeometry(0.034, 0.036, 0.007, 48), mats.iron);
  cap.position.y = 0.0135;
  g.add(ring, cap);
  for (let k = 0; k < 4; k++) {
    const arm = mesh(new THREE.BoxGeometry(0.075, 0.009, 0.01), mats.iron);
    const a = (k / 4) * TAU + Math.PI / 4;
    arm.position.set(Math.cos(a) * 0.105, PAN.y - 0.0045, Math.sin(a) * 0.105);
    arm.rotation.y = -a;
    const leg = mesh(new THREE.BoxGeometry(0.01, PAN.y, 0.01), mats.iron);
    leg.position.set(Math.cos(a) * 0.14, PAN.y / 2, Math.sin(a) * 0.14);
    g.add(arm, leg);
  }
  const flameMat = new THREE.MeshBasicMaterial({ color: '#3d8bff', transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false });
  const tipMat = new THREE.MeshBasicMaterial({ color: '#9fd0ff', transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending, depthWrite: false });
  const flames = [];
  for (let k = 0; k < 32; k++) {
    const a = (k / 32) * TAU;
    const f = new THREE.Group();
    const outer = new THREE.Mesh(new THREE.ConeGeometry(0.0032, 0.016, 8), flameMat);
    const inner = new THREE.Mesh(new THREE.ConeGeometry(0.0016, 0.008, 6), tipMat);
    outer.position.y = 0.008;
    inner.position.y = 0.004;
    f.add(outer, inner);
    f.position.set(Math.cos(a) * 0.038, 0.012, Math.sin(a) * 0.038);
    // Leaning out from the burner, and up.
    f.rotation.set(Math.sin(a) * 0.9, 0, -Math.cos(a) * 0.9);
    g.add(f);
    flames.push(f);
  }
  g.userData = { flames };
  return g;
}

// The inside of the oven, round a tray baking: dark speckled enamel, a
// wire rack, and the heating elements glowing red, lighting it all orange.
function oven(mats) {
  const g = new THREE.Group();
  const floor = mesh(new THREE.PlaneGeometry(0.4, 0.34), mats.enamel);
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -0.002;
  floor.position.z = 0.02;
  g.add(floor);
  const wall = (w, h, x, z, ry) => {
    const m = mesh(new THREE.PlaneGeometry(w, h), mats.enamel);
    m.position.set(x, h / 2 - 0.002, z);
    m.rotation.y = ry;
    g.add(m);
  };
  wall(0.4, 0.24, 0, -0.15, 0);
  wall(0.34, 0.24, -0.2, 0.02, Math.PI / 2);
  wall(0.34, 0.24, 0.2, 0.02, -Math.PI / 2);
  for (let k = -7; k <= 8; k++) {
    const wire = mesh(new THREE.CylinderGeometry(0.0012, 0.0012, 0.38, 6), mats.steel);
    wire.rotation.z = Math.PI / 2;
    wire.position.set(0, 0.0006, k * 0.021);
    g.add(wire);
  }
  const hot = new THREE.MeshStandardMaterial({ color: '#2a1410', emissive: '#ff4410', emissiveIntensity: 0, roughness: 0.5 });
  const rod = (len, x, z, ry) => {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(0.0035, 0.0035, len, 10), hot);
    m.rotation.set(0, ry, Math.PI / 2);
    m.position.set(x, 0.012, z);
    g.add(m);
  };
  rod(0.36, 0, -0.135, 0);
  rod(0.28, -0.18, 0.01, Math.PI / 2);
  rod(0.28, 0.18, 0.01, Math.PI / 2);
  const light = new THREE.PointLight('#ff8a3a', 0, 0.6, 1.5);
  light.position.set(0, 0.14, -0.02);
  g.add(light);
  g.userData = { hot, light };
  return g;
}

// A backsplash of white tiles along the back of the counter.
function backsplash() {
  const tiles = paintTexture(256, 256, (x, w, h) => {
    x.fillStyle = '#d9d6cf';
    x.fillRect(0, 0, w, h);
    for (let r = 0; r < 8; r++) {
      for (let c = -1; c < 4; c++) {
        const ox = c * 64 + (r % 2) * 32 + 2;
        const g = x.createLinearGradient(0, r * 32, 0, r * 32 + 30);
        g.addColorStop(0, '#fbfaf7');
        g.addColorStop(1, '#ebe8e1');
        x.fillStyle = g;
        x.fillRect(ox, r * 32 + 2, 60, 28);
      }
    }
  });
  tiles.repeat.set(4, 2);
  const m = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.5), new THREE.MeshPhysicalMaterial({ map: tiles, roughness: 0.2, clearcoat: 0.8 }));
  m.position.set(0, 0.25, -0.24);
  m.receiveShadow = true;
  return m;
}

// ------------------------------------------------------------ tools

const milkTexture = () =>
  paintTexture(256, 256, (x, w, h) => {
    x.fillStyle = '#fbfbf8';
    x.fillRect(0, 0, w, h);
    x.fillStyle = '#2f6fd1';
    x.fillRect(0, h * 0.55, w, h * 0.22);
    x.fillStyle = '#fbfbf8';
    x.font = 'bold 44px sans-serif';
    x.textAlign = 'center';
    x.fillText('MILK', w / 2, h * 0.71);
    x.fillStyle = '#7fb6ff';
    x.fillRect(0, h * 0.8, w, 6);
  });

// What is in your hand, made for a step's thing: { obj, tip } where tip is
// the point (in obj's frame) that pours or touches.
function toolModel(icon, act, look, mats) {
  const g = new THREE.Group();
  let tip = new THREE.Vector3();
  const add = (m, x = 0, y = 0, z = 0) => {
    m.position.set(x, y, z);
    g.add(m);
    return m;
  };
  if (icon === '🥚') add(mesh(lumpGeometry(0.0205, 0.028, 0.0205, { amp: 0.01 }), mats.shell));
  else if (icon === '🥛') {
    const box = add(mesh(new THREE.BoxGeometry(0.05, 0.1, 0.05), new THREE.MeshStandardMaterial({ map: milkTexture(), roughness: 0.45 })), 0, 0.05, 0);
    box.rotation.y = 0.5;
    const roof = add(mesh(new THREE.ConeGeometry(0.036, 0.024, 4, 1), new THREE.MeshStandardMaterial({ color: '#fbfbf8', roughness: 0.45 })), 0, 0.112, 0);
    roof.rotation.y = Math.PI / 4 + 0.5;
    tip = new THREE.Vector3(-0.025, 0.11, 0);
  } else if (icon === '🌾') {
    add(lathe([[0, 0], [0.02, 0], [0.024, 0.022], [0.0225, 0.022], [0.0185, 0.002], [0, 0.002]], mats.steel, 32));
    add(mesh(lumpGeometry(0.02, 0.012, 0.02, { amp: 0.15, seed: 2, flatBottom: true }), mats.flour), 0, 0.016, 0);
    const h = add(mesh(new RoundedBoxGeometry(0.06, 0.004, 0.012, 2, 0.0015), mats.steel), 0.05, 0.022, 0);
    h.rotation.z = 0.25;
    tip = new THREE.Vector3(-0.02, 0.01, 0);
  } else if (icon === '🥄') {
    add(mesh(lumpGeometry(0.014, 0.004, 0.021, { amp: 0.02 }), mats.woodSpoon));
    const h = add(mesh(new THREE.CylinderGeometry(0.0034, 0.0046, 0.14, 12), mats.woodSpoon), 0.03, 0.05, 0.035);
    h.rotation.set(-0.75, 0, -0.65);
  } else if (icon === '🫓') add(mesh(lumpGeometry(0.03, 0.026, 0.03, { amp: 0.05, seed: 9, flatBottom: true }), mats.dough));
  else if (icon === '🪵') {
    const roller = add(mesh(new THREE.CylinderGeometry(0.0135, 0.0135, 0.16, 32), mats.woodSpoon));
    roller.rotation.z = Math.PI / 2;
    for (const s of [-1, 1]) {
      const h = add(mesh(new THREE.CylinderGeometry(0.006, 0.0075, 0.05, 16), mats.woodSpoon), s * 0.105, 0, 0);
      h.rotation.z = Math.PI / 2;
    }
    g.userData.roller = roller;
  } else if (icon === '🍅') {
    add(mesh(new THREE.SphereGeometry(0.02, 24, 12, 0, TAU, Math.PI / 2, Math.PI / 2), mats.steel));
    const sauce = add(mesh(new THREE.CircleGeometry(0.018, 24), new THREE.MeshPhysicalMaterial({ color: '#b8301b', roughness: 0.3, clearcoat: 0.5 })), 0, -0.004, 0);
    sauce.rotation.x = -Math.PI / 2;
    const h = add(mesh(new THREE.CylinderGeometry(0.0028, 0.0028, 0.16, 10), mats.steel), 0.05, 0.06, 0.03);
    h.rotation.set(-0.5, 0, -0.6);
  } else if (icon === '🧀' && act === 'rub') {
    // A wedge of cheese, its rind on the back.
    const wedge = new THREE.Shape();
    wedge.moveTo(0, 0);
    wedge.lineTo(0.07, 0.016);
    wedge.lineTo(0.07, -0.016);
    wedge.lineTo(0, 0);
    const cheese = new THREE.MeshStandardMaterial({ color: '#f2bf3b', roughness: 0.55 });
    const block = add(mesh(new THREE.ExtrudeGeometry(wedge, { depth: 0.03, bevelEnabled: true, bevelSize: 0.0015, bevelThickness: 0.0015, bevelSegments: 2 }), cheese), -0.035, 0, 0);
    block.rotation.x = -Math.PI / 2;
    const rind = add(mesh(new THREE.BoxGeometry(0.003, 0.03, 0.033), new THREE.MeshStandardMaterial({ color: '#d98f1c', roughness: 0.6 })), 0.036, 0.015, 0);
    rind.rotation.y = 0;
    g.rotation.y = 0.5;
  } else if (icon === '🧀') add(mesh(new RoundedBoxGeometry(0.098, 0.003, 0.098, 1, 0.001), new THREE.MeshPhysicalMaterial({ color: '#ffbf2e', roughness: 0.38 })));
  else if (icon === '🔪') {
    const shape = new THREE.Shape();
    shape.moveTo(0, 0);
    shape.lineTo(0.12, 0);
    shape.quadraticCurveTo(0.14, 0.01, 0.13, 0.03);
    shape.lineTo(0, 0.034);
    shape.lineTo(0, 0);
    const blade = add(mesh(new THREE.ExtrudeGeometry(shape, { depth: 0.0014, bevelEnabled: false }), new THREE.MeshStandardMaterial({ color: '#dfe3e8', metalness: 1, roughness: 0.18 })), -0.065, 0, -0.0007);
    blade.castShadow = true;
    add(mesh(new RoundedBoxGeometry(0.09, 0.022, 0.014, 3, 0.005), mats.bakelite), -0.11, 0.022, 0);
    g.scale.setScalar(0.78);
  } else if (icon === '🫒' || icon === '💧') {
    const liquid = icon === '🫒' ? '#d4b23a' : '#9fd2f0';
    add(mesh(new THREE.CylinderGeometry(0.024, 0.024, 0.09, 24, 1, true), mats.glass), 0, 0.045, 0);
    add(mesh(new THREE.CylinderGeometry(0.0215, 0.0215, 0.06, 24), new THREE.MeshPhysicalMaterial({ color: liquid, roughness: 0.05, transparent: true, opacity: 0.75 })), 0, 0.031, 0);
    if (icon === '🫒') {
      add(mesh(new THREE.CylinderGeometry(0.008, 0.022, 0.03, 20, 1, true), mats.glass), 0, 0.105, 0);
      add(mesh(new THREE.CylinderGeometry(0.009, 0.009, 0.012, 16), new THREE.MeshStandardMaterial({ color: '#2f5f2a', roughness: 0.5 })), 0, 0.124, 0);
      tip = new THREE.Vector3(0, 0.128, 0);
    } else {
      const h = add(mesh(new THREE.TorusGeometry(0.02, 0.004, 10, 24, Math.PI), mats.glass), 0.024, 0.05, 0);
      h.rotation.z = -Math.PI / 2;
      tip = new THREE.Vector3(-0.024, 0.09, 0);
    }
  } else if (icon === '🧈' && act === 'rub') {
    const blade = add(mesh(new RoundedBoxGeometry(0.075, 0.002, 0.018, 2, 0.0009), mats.steel), 0, 0.002, 0);
    blade.rotation.y = 0.3;
    add(mesh(lumpGeometry(0.012, 0.005, 0.009, { amp: 0.2 }), new THREE.MeshPhysicalMaterial({ color: '#f6df86', roughness: 0.3 })), -0.01, 0.005, 0);
    const h = add(mesh(new RoundedBoxGeometry(0.07, 0.012, 0.016, 2, 0.005), mats.woodSpoon), 0.07, 0.008, -0.022);
    h.rotation.y = 0.3;
  } else if (icon === '🧈') add(mesh(new RoundedBoxGeometry(0.046, 0.022, 0.032, 3, 0.004), mats.butter), 0, 0.011, 0);
  else if (icon === '🍫') {
    add(lathe([[0, 0], [0.024, 0], [0.027, 0.022], [0.025, 0.022], [0.022, 0.003], [0, 0.003]], mats.ceramicIn, 32));
    for (let k = 0; k < 9; k++) add(mesh(new THREE.ConeGeometry(0.0034, 0.0042, 8), new THREE.MeshPhysicalMaterial({ color: '#3a2112', roughness: 0.3 })), (hash2(1, k, 1) - 0.5) * 0.03, 0.02, (hash2(1, k, 2) - 0.5) * 0.03);
  } else if (icon === '🧂') {
    add(mesh(new THREE.CylinderGeometry(0.016, 0.017, 0.06, 24, 1, true), mats.glass), 0, 0.03, 0);
    add(mesh(new THREE.CylinderGeometry(0.0145, 0.0155, 0.04, 20), new THREE.MeshStandardMaterial({ color: '#fbfbfb', roughness: 0.6 })), 0, 0.021, 0);
    add(mesh(new THREE.SphereGeometry(0.016, 20, 10, 0, TAU, 0, Math.PI / 2), mats.steel), 0, 0.06, 0);
  } else if (icon === '🍞') {
    add(mesh(new RoundedBoxGeometry(0.112, 0.013, 0.112, 3, 0.005), mats.crust), 0, 0.0065, 0);
    const top = add(mesh(new THREE.PlaneGeometry(0.102, 0.102), mats.crumb), 0, 0.0132, 0);
    top.rotation.x = -Math.PI / 2;
  } else if (icon === '🥬') add(mesh(sheetGeometry(0.068, { wobble: 0.16, ruffle: 0.007, freq: 5, seed: 3, dome: 0.003 }), new THREE.MeshStandardMaterial({ color: '#71b83f', roughness: 0.4, side: THREE.DoubleSide })));
  else return null;
  return { obj: g, tip };
}

// ------------------------------------------------------------ the kitchen

export class Kitchen3D {
  // Throws if WebGL cannot be had (the window then draws it flat).
  constructor(canvas) {
    this.canvas = canvas;
    this.gl = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'low-power' });
    this.gl.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    this.gl.outputColorSpace = THREE.SRGBColorSpace;
    this.gl.toneMapping = THREE.ACESFilmicToneMapping;
    this.gl.toneMappingExposure = 1.0;
    this.gl.shadowMap.enabled = true;
    this.gl.shadowMap.type = THREE.PCFSoftShadowMap;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#e9e4dc');
    const pmrem = new THREE.PMREMGenerator(this.gl);
    const room = new RoomEnvironment();
    this.envMap = pmrem.fromScene(room, 0.03).texture;
    room.dispose();
    pmrem.dispose();
    this.scene.environment = this.envMap;
    this.scene.environmentIntensity = 0.75;
    const key = new THREE.DirectionalLight('#fff1dc', 2.4);
    key.position.set(-0.22, 0.6, -0.26);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    Object.assign(key.shadow.camera, { left: -0.3, right: 0.3, top: 0.3, bottom: -0.3, near: 0.1, far: 1.5 });
    key.shadow.bias = -0.0003;
    key.shadow.normalBias = 0.0015;
    key.shadow.radius = 4;
    this.key = key;
    this.scene.add(key, new THREE.HemisphereLight('#fff8ee', '#b8a890', 0.35));
    this.camera = new THREE.PerspectiveCamera(30, 1.44, 0.01, 4);
    this.camera.position.set(0, 0.43, 0.29);
    this.camera.lookAt(0, 0.006, 0.018);

    this.mats = kitchenMaterials();
    const counter = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.9), this.mats.granite);
    counter.rotation.x = -Math.PI / 2;
    counter.receiveShadow = true;
    this.counter = counter;
    this.scene.add(counter, backsplash());
    this.vessels = { bowl: bowl(this.mats), pan: pan(this.mats), pot: pot(this.mats), tray: tray(this.mats), board: board(this.mats), plate: plate(this.mats) };
    for (const v of Object.values(this.vessels)) this.scene.add(v);
    this.burner = burner(this.mats);
    this.oven = oven(this.mats);
    this.scene.add(this.burner, this.oven);
    this.foods = new Map();
    this.tools = new Map();
    this.held = null;
    // A stream of something poured, from the spout down into the vessel.
    const streamGeo = new THREE.CylinderGeometry(1, 0.8, 1, 14, 1, true);
    streamGeo.translate(0, -0.5, 0);
    this.stream = new THREE.Mesh(streamGeo, new THREE.MeshPhysicalMaterial({ color: '#ffffff', roughness: 0.05, clearcoat: 1, transparent: true, opacity: 0.9 }));
    this.stream.visible = false;
    this.scene.add(this.stream);
    // Steam, and splashes of water.
    const puff = puffTexture();
    this.steam = Array.from({ length: 18 }, (_, i) => {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: puff, transparent: true, depthWrite: false, opacity: 0 }));
      s.userData.seed = i;
      this.scene.add(s);
      return s;
    });
    this.splash = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 8, 6), new THREE.MeshPhysicalMaterial({ color: '#cfeaff', roughness: 0.02, transparent: true, opacity: 0.8 }), 30);
    this.splash.frustumCulled = false;
    this.scene.add(this.splash);
    // Grains falling from the salt shaker, each with its own start.
    this.grains = new THREE.InstancedMesh(new THREE.BoxGeometry(0.0012, 0.0012, 0.0012), new THREE.MeshStandardMaterial({ color: '#ffffff' }), 40);
    this.grains.frustumCulled = false;
    this.grainsAt = -9;
    this.scene.add(this.grains);
    this.ray = new THREE.Raycaster();
    this.plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    this.t = 0;
    this.lastProgress = 0;
    this.rollAt = null;
  }

  // The food set for a recipe, made the first time it is wanted.
  food(key) {
    if (!this.foods.has(key)) {
      const f = FOODS[key](this.mats);
      this.scene.add(f.group);
      this.foods.set(key, f);
    }
    return this.foods.get(key);
  }

  // How high the food's top is, where your hands work, at a lesson's step.
  surface(lesson) {
    const recipe = recipeByKey(lesson?.recipe);
    if (!recipe) return 0.02;
    return this.food(recipe.key).surfaceOf(Math.min(lesson.step, recipe.steps.length - 1));
  }

  // A point on the screen (client pixels) in the kitchen's units, where it
  // meets the food's top, or null.
  toKitchen(cx, cy, lesson) {
    const r = this.canvas.getBoundingClientRect();
    const ndc = new THREE.Vector2(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1);
    this.ray.setFromCamera(ndc, this.camera);
    this.plane.constant = -this.surface(lesson);
    const hit = this.ray.ray.intersectPlane(this.plane, new THREE.Vector3());
    return hit ? { x: hit.x / MM + VESSEL.x, y: hit.z / MM + VESSEL.y } : null;
  }

  // A point in the kitchen's units, on the food's top, on the screen.
  toScreen(x, y, lesson) {
    const r = this.canvas.getBoundingClientRect();
    const v = new THREE.Vector3(wx(x), this.surface(lesson), wz(y)).project(this.camera);
    return { x: r.left + ((v.x + 1) / 2) * r.width, y: r.top + ((1 - v.y) / 2) * r.height };
  }

  resize() {
    const w = this.canvas.clientWidth;
    const h = this.canvas.clientHeight;
    if (!w || !h || (w === this.w && h === this.h)) return;
    this.w = w;
    this.h = h;
    this.gl.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  // One frame: the lesson as it is, and the window's hands (`view`, as
  // render/kitchen.js has it).
  render(lesson, view, dt) {
    this.resize();
    this.t += dt;
    const t = this.t;
    const recipe = recipeByKey(lesson?.recipe);
    if (!recipe) return;
    const at = Math.min(lesson.step, recipe.steps.length - 1);
    const st = recipe.steps[at];
    const done = lesson.done;
    const heating = !done && st.act === 'heat' && lesson.phase === 'work';
    for (const [key, f] of this.foods) f.group.visible = key === recipe.key;
    const food = this.food(recipe.key);
    const vessel = food.vesselOf(at);
    for (const [k, v] of Object.entries(this.vessels)) v.visible = k === vessel;
    const onHob = vessel === 'pan' || vessel === 'pot';
    const inOven = heating && vessel === 'tray';
    this.burner.visible = onHob;
    this.oven.visible = inOven;
    this.counter.visible = !inOven && !onHob;
    food.update({ step: at, p: done ? 1 : lesson.progress, heatOf: (k) => (k === lesson.step && !done ? lesson.heat : (lesson.heats?.[k] ?? 0)), view, t, dt, done });
    // Flames up while it is on the heat, and the oven glowing.
    const { flames } = this.burner.userData;
    flames.forEach((f, i) => {
      f.visible = heating && onHob;
      const flicker = 0.85 + 0.3 * Math.abs(Math.sin(t * 17 + i * 2.3) * Math.sin(t * 7 + i));
      f.scale.set(1, flicker, 1);
    });
    const { hot, light } = this.oven.userData;
    hot.emissiveIntensity = inOven ? 1.4 + 0.3 * Math.sin(t * 3) : 0;
    light.intensity = inOven ? 0.35 : 0;
    this.key.intensity = inOven ? 0.9 : 2.4;
    this.steamUp(heating || (done && (vessel === 'pan' || vessel === 'pot' || vessel === 'tray')), lesson, dt);
    this.hands(lesson, st, view, dt);
    this.gl.render(this.scene, this.camera);
  }

  // Steam off something hot, puffs rising and spreading as they fade.
  steamUp(on, lesson, dt) {
    const strength = on ? Math.min(1, 0.3 + (lesson.heat || 0.8)) : 0;
    const top = this.surface(lesson);
    for (const s of this.steam) {
      const i = s.userData.seed;
      const life = (this.t * 0.35 + hash2(3, i, 1)) % 1;
      s.visible = strength > 0;
      if (!s.visible) continue;
      const a = hash2(3, i, 2) * TAU;
      const d = Math.sqrt(hash2(3, i, 3)) * 0.05;
      s.position.set(Math.cos(a) * d + Math.sin(this.t + i) * 0.01, top + life * 0.12, Math.sin(a) * d);
      s.scale.setScalar(0.02 + life * 0.06);
      s.material.opacity = Math.sin(life * Math.PI) * 0.22 * strength;
    }
  }

  // What is in your hand, where your hand is, doing what the step does;
  // and what it pours, splashes or sprinkles.
  hands(lesson, st, view, dt) {
    const want = view.tool && view.pos ? `${view.tool}|${st?.act}|${st?.look ?? ''}` : null;
    if (this.heldKey !== want) {
      if (this.held) this.scene.remove(this.held.obj);
      this.held = null;
      this.heldKey = want;
      if (want) {
        if (!this.tools.has(want)) this.tools.set(want, toolModel(view.tool, st.act, st.look, this.mats));
        this.held = this.tools.get(want);
        if (this.held) this.scene.add(this.held.obj);
      }
    }
    const top = this.surface(lesson);
    const at = view.pos ? new THREE.Vector3(wx(view.pos.x), top, wz(view.pos.y)) : null;
    this.stream.visible = false;
    let splashing = false;
    if (this.held && at) {
      const o = this.held.obj;
      o.rotation.set(0, 0, 0);
      o.position.copy(at);
      const act = st?.act;
      if (act === 'pour') {
        // Tipped over the vessel, its spout over your hand, pouring.
        const tilt = view.pour ? 1.25 : 0.25;
        o.rotation.z = tilt;
        o.position.y = top + 0.035;
        o.updateMatrixWorld(true);
        const spout = this.held.tip.clone().applyMatrix4(o.matrixWorld);
        o.position.add(at.clone().sub(spout).setY(0));
        o.updateMatrixWorld(true);
        if (view.pour) {
          const from = this.held.tip.clone().applyMatrix4(o.matrixWorld);
          const len = Math.max(0.01, from.y - top + 0.002);
          this.stream.visible = true;
          this.stream.position.copy(from);
          this.stream.scale.set(view.tool === '🫒' ? 0.0016 : 0.0034, len, view.tool === '🫒' ? 0.0016 : 0.0034);
          this.stream.material.color.set(view.tool === '🥛' ? '#f7f4ec' : view.tool === '🫒' ? '#d4b23a' : '#bfe3f7');
          this.stream.material.opacity = view.tool === '💧' ? 0.55 : 0.92;
        }
      } else if (act === 'stir') {
        o.position.y = top + 0.002;
        o.rotation.y = -(view.spin || 0) * 0.4;
      } else if (act === 'chop') {
        o.position.y = top + (view.down ? 0.0005 : 0.032);
        o.rotation.y = 0.2;
      } else if (act === 'rub') {
        if (view.tool === '🪵') {
          o.position.y = top + 0.0135;
          if (this.rollAt) this.held.obj.userData.roller && (this.held.obj.userData.roller.rotation.x += (at.z - this.rollAt.z) / 0.0135);
          this.rollAt = at.clone();
        } else if (view.tool === '🍅') o.position.y = top + 0.012;
        else if (view.tool === '🧈') o.position.y = top + 0.001;
        else o.position.y = top + 0.045;
      } else o.position.y = top + 0.05;
    }
    // Under the tap: a running stream down onto the vegetables, splashing.
    if (view.tool === '🚰' && at && view.down) {
      this.stream.visible = true;
      this.stream.position.set(at.x, top + 0.3, at.z);
      this.stream.scale.set(0.004, 0.3, 0.004);
      this.stream.material.color.set('#cfe9fb');
      this.stream.material.opacity = 0.55;
      splashing = true;
    }
    const m = new THREE.Matrix4();
    for (let i = 0; i < this.splash.count; i++) {
      if (!splashing) {
        m.makeScale(0, 0, 0);
      } else {
        const life = (this.t * 2.2 + hash2(7, i, 1)) % 1;
        const a = hash2(7, i, 2) * TAU;
        const d = life * (0.01 + hash2(7, i, 3) * 0.02);
        const s = 0.0012 * (1 - life);
        m.compose(new THREE.Vector3(at.x + Math.cos(a) * d, top + Math.sin(life * Math.PI) * 0.012, at.z + Math.sin(a) * d), new THREE.Quaternion(), new THREE.Vector3(s, s, s));
      }
      this.splash.setMatrixAt(i, m);
    }
    this.splash.instanceMatrix.needsUpdate = true;
    // A shake of salt: grains falling from the shaker as it is let go.
    if (st?.icon === '🧂' && lesson.progress > this.lastProgress && view.lastDrop) this.grainsAt = this.t;
    this.lastProgress = lesson.progress;
    const since = this.t - this.grainsAt;
    for (let i = 0; i < this.grains.count; i++) {
      const fall = since - hash2(8, i, 1) * 0.25;
      if (fall < 0 || fall > 0.5 || !view.lastDrop) m.makeScale(0, 0, 0);
      else {
        const p = view.lastDrop;
        const y = top + 0.06 - ease(fall / 0.45) * 0.06;
        m.makeTranslation(wx(p.x) + (hash2(8, i, 2) - 0.5) * 0.02, y, wz(p.y) + (hash2(8, i, 3) - 0.5) * 0.02);
      }
      this.grains.setMatrixAt(i, m);
    }
    this.grains.instanceMatrix.needsUpdate = true;
    if (!view.down) this.rollAt = null;
  }

  // The picture as it is now, as a data URL (for the dish made).
  snapshot(lesson, view) {
    this.render(lesson, { ...view, tool: null }, 0);
    return this.canvas.toDataURL('image/jpeg', 0.9);
  }

  dispose() {
    this.scene.traverse((o) => {
      if (o.isMesh || o.isInstancedMesh || o.isSprite) {
        o.geometry?.dispose();
        for (const m of [o.material].flat()) {
          m?.map?.dispose();
          m?.dispose();
        }
      }
    });
    for (const m of Object.values(this.mats)) m.dispose?.();
    this.envMap.dispose();
    this.gl.dispose();
    this.gl.forceContextLoss();
  }
}
