// A robot kit's window in 3D (ui-robokit.js): the robot on its build plate,
// a grey baseplate of little studs with the plate's GRID by GRID places
// marked on it, or out on the play mat — the white mat with its black line,
// coloured squares and START arrow, a low wooden fence round it, toy bricks
// in the way — driving about as its program has it (shared/robokit.js
// RobotSim). Lit like a studio (RoomEnvironment), with soft shadows. Drag to
// look round (three's OrbitControls), pinch or scroll to come closer.
//
// A WebGL context of its own, like the kitchen's (render/kitchen3d.js).
import * as THREE from '../../vendor/three.module.js';
import { OrbitControls } from '../../vendor/three-addons/controls/OrbitControls.js';
import { RoomEnvironment } from '../../vendor/three-addons/environments/RoomEnvironment.js';
import { RoundedBoxGeometry } from '../../vendor/three-addons/geometries/RoundedBoxGeometry.js';
import { analyse, BRICK, brickBox, CELL, cellsOf, COLORS, GRID, LINE, MAT_D, MAT_W, PATCH, PATCHES, START } from '../shared/robokit.js';
import { kitMaterials, robotModel } from './robokit-parts.js';

const PLATE = GRID * CELL;
const BRICK_COLORS = ['#e8453c', '#fcd535', '#3a73d8', '#35a852'];

// The play mat's picture, 10 pixels to the centimetre.
function matTexture() {
  const S = 10;
  const c = document.createElement('canvas');
  c.width = MAT_W * S;
  c.height = MAT_D * S;
  const g = c.getContext('2d');
  const X = (x) => (x + MAT_W / 2) * S;
  const Z = (z) => (z + MAT_D / 2) * S;
  g.fillStyle = '#fbfbf7';
  g.fillRect(0, 0, c.width, c.height);
  // A faint grid every 10 cm, and a ruler down the edges.
  g.strokeStyle = 'rgba(80, 120, 170, 0.12)';
  g.lineWidth = 2;
  for (let x = -MAT_W / 2; x <= MAT_W / 2; x += 10) {
    g.beginPath();
    g.moveTo(X(x), 0);
    g.lineTo(X(x), c.height);
    g.stroke();
  }
  for (let z = -MAT_D / 2; z <= MAT_D / 2; z += 10) {
    g.beginPath();
    g.moveTo(0, Z(z));
    g.lineTo(c.width, Z(z));
    g.stroke();
  }
  g.fillStyle = '#7b8794';
  for (let x = 0; x <= MAT_W; x++) {
    const h = x % 10 === 0 ? 26 : x % 5 === 0 ? 16 : 9;
    g.fillRect(x * S - 1, 0, 2, h);
    g.fillRect(x * S - 1, c.height - h, 2, h);
  }
  g.font = 'bold 22px Fredoka, sans-serif';
  g.textAlign = 'center';
  for (let x = 10; x < MAT_W; x += 10) g.fillText(`${x}`, x * S, 50);
  // The black line.
  g.strokeStyle = '#1d2026';
  g.lineWidth = LINE.w * S;
  g.beginPath();
  g.moveTo(X(-LINE.half), Z(-LINE.r));
  g.lineTo(X(LINE.half), Z(-LINE.r));
  g.arc(X(LINE.half), Z(0), LINE.r * S, -Math.PI / 2, Math.PI / 2);
  g.lineTo(X(-LINE.half), Z(LINE.r));
  g.arc(X(-LINE.half), Z(0), LINE.r * S, Math.PI / 2, (3 * Math.PI) / 2);
  g.closePath();
  g.stroke();
  // The coloured squares, with a white star on each.
  for (const p of PATCHES) {
    g.fillStyle = COLORS[p.col].hex;
    g.fillRect(X(p.x - PATCH), Z(p.z - PATCH), PATCH * 2 * S, PATCH * 2 * S);
    star(g, X(p.x), Z(p.z), 26, 'rgba(255,255,255,0.85)');
  }
  // START, an arrow the way robots set off.
  g.save();
  g.translate(X(START.x - 13), Z(START.z + 9));
  g.fillStyle = '#35a852';
  g.font = 'bold 44px Fredoka, sans-serif';
  g.textAlign = 'left';
  g.fillText('START', 0, 0);
  g.beginPath();
  g.moveTo(150, -30);
  g.lineTo(210, -16);
  g.lineTo(150, -2);
  g.closePath();
  g.fill();
  g.restore();
  g.fillStyle = 'rgba(58, 115, 216, 0.55)';
  g.font = 'bold 60px Fredoka, sans-serif';
  g.textAlign = 'center';
  g.fillText('ROBOT PLAY MAT', X(0), Z(-2));
  g.font = 'bold 30px Fredoka, sans-serif';
  g.fillText('build · code · play', X(0), Z(5));
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

function star(g, x, y, r, fill) {
  g.beginPath();
  for (let k = 0; k < 10; k++) {
    const a = -Math.PI / 2 + (k * Math.PI) / 5;
    const rr = k % 2 ? r * 0.45 : r;
    g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  g.closePath();
  g.fillStyle = fill;
  g.fill();
}

// The build plate's places, each a square of five by five studs, marked.
function plateTexture() {
  const S = 64;
  const c = document.createElement('canvas');
  c.width = c.height = GRID * S;
  const g = c.getContext('2d');
  g.fillStyle = '#c9ced6';
  g.fillRect(0, 0, c.width, c.height);
  g.strokeStyle = 'rgba(70, 80, 95, 0.45)';
  g.lineWidth = 2;
  for (let i = 0; i <= GRID; i++) {
    g.beginPath();
    g.moveTo(i * S, 0);
    g.lineTo(i * S, c.height);
    g.moveTo(0, i * S);
    g.lineTo(c.width, i * S);
    g.stroke();
  }
  // An arrow at the top: the way the front of the plate is.
  g.fillStyle = 'rgba(70, 80, 95, 0.5)';
  g.beginPath();
  g.moveTo(c.width / 2, 6);
  g.lineTo(c.width / 2 + 16, 24);
  g.lineTo(c.width / 2 - 16, 24);
  g.fill();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

// A port's letter in a round tag over what is plugged into it.
const tags = new Map();
function tagMaterial(text, color) {
  const key = `${text}|${color}`;
  if (!tags.has(key)) {
    const c = document.createElement('canvas');
    c.width = c.height = 96;
    const g = c.getContext('2d');
    g.fillStyle = color;
    g.beginPath();
    g.arc(48, 48, 42, 0, Math.PI * 2);
    g.fill();
    g.lineWidth = 6;
    g.strokeStyle = '#ffffff';
    g.stroke();
    g.fillStyle = '#ffffff';
    g.font = 'bold 56px Fredoka, sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(text, 48, 52);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    tags.set(key, new THREE.SpriteMaterial({ map: t, depthTest: false, transparent: true }));
  }
  return tags.get(key);
}

export class RoboStage {
  // Throws if WebGL cannot be had.
  constructor(canvas) {
    this.canvas = canvas;
    this.gl = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'low-power' });
    this.gl.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    this.gl.outputColorSpace = THREE.SRGBColorSpace;
    this.gl.toneMapping = THREE.ACESFilmicToneMapping;
    this.gl.shadowMap.enabled = true;
    this.gl.shadowMap.type = THREE.PCFSoftShadowMap;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#dfe8f1');
    const pmrem = new THREE.PMREMGenerator(this.gl);
    const room = new RoomEnvironment();
    this.envMap = pmrem.fromScene(room, 0.03).texture;
    room.dispose();
    pmrem.dispose();
    this.scene.environment = this.envMap;
    this.scene.environmentIntensity = 0.7;
    const key = new THREE.DirectionalLight('#fff4e4', 2.3);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    key.shadow.bias = -0.0004;
    key.shadow.normalBias = 0.02;
    key.shadow.radius = 4;
    this.key = key;
    this.scene.add(key, key.target, new THREE.HemisphereLight('#ffffff', '#b9b2a6', 0.4));
    this.camera = new THREE.PerspectiveCamera(36, 1.5, 1, 1500);
    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.12;
    this.controls.maxPolarAngle = Math.PI * 0.47;
    this.controls.enablePan = false;
    this.mats = kitMaterials();

    // A table under everything.
    const table = new THREE.Mesh(new THREE.PlaneGeometry(2000, 2000), new THREE.MeshPhysicalMaterial({ color: '#d9b98f', roughness: 0.6, clearcoat: 0.2 }));
    table.rotation.x = -Math.PI / 2;
    table.position.y = -1.6;
    table.receiveShadow = true;
    this.scene.add(table);

    this.plate = this.makePlate();
    this.mat = this.makeMat();
    this.scene.add(this.plate, this.mat);
    this.brickGroup = new THREE.Group();
    this.mat.add(this.brickGroup);
    this.robot = null;
    this.extras = new THREE.Group();
    this.scene.add(this.extras);
    this.ray = new THREE.Raycaster();
    this.ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    this.mode = '';
    this.setMode('build');
  }

  makePlate() {
    const g = new THREE.Group();
    const base = new THREE.Mesh(new RoundedBoxGeometry(PLATE + 2, 1.6, PLATE + 2, 3, 0.5), this.mats.make({ color: '#b8bec7', roughness: 0.4, clearcoat: 0.4 }));
    base.position.y = -0.8;
    base.receiveShadow = true;
    g.add(base);
    const top = new THREE.Mesh(new THREE.PlaneGeometry(PLATE, PLATE), this.mats.make({ map: plateTexture(), roughness: 0.42, clearcoat: 0.3 }));
    top.rotation.x = -Math.PI / 2;
    top.position.y = 0.01;
    top.receiveShadow = true;
    g.add(top);
    // Studs, five by five in each place.
    const n = GRID * 5;
    const studs = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.24, 0.24, 0.18, 12), this.mats.make({ color: '#c9ced6', roughness: 0.4, clearcoat: 0.4 }), n * n);
    const m = new THREE.Matrix4();
    let k = 0;
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) studs.setMatrixAt(k++, m.makeTranslation((i + 0.5) * 0.8 - PLATE / 2, 0.09, (j + 0.5) * 0.8 - PLATE / 2));
    studs.receiveShadow = true;
    g.add(studs);
    return g;
  }

  makeMat() {
    const g = new THREE.Group();
    const mat = new THREE.Mesh(new THREE.PlaneGeometry(MAT_W, MAT_D), new THREE.MeshPhysicalMaterial({ map: matTexture(), roughness: 0.75 }));
    mat.rotation.x = -Math.PI / 2;
    mat.receiveShadow = true;
    g.add(mat);
    const under = new THREE.Mesh(new THREE.BoxGeometry(MAT_W + 8, 1.6, MAT_D + 8), new THREE.MeshPhysicalMaterial({ color: '#c49a6a', roughness: 0.6 }));
    under.position.y = -0.81;
    under.receiveShadow = true;
    g.add(under);
    // The fence: wooden boards just outside the mat.
    const wood = new THREE.MeshPhysicalMaterial({ color: '#d6a467', roughness: 0.55, clearcoat: 0.25 });
    const side = (w, d, x, z) => {
      const b = new THREE.Mesh(new RoundedBoxGeometry(w, 5, d, 2, 0.4), wood);
      b.position.set(x, 2.5, z);
      b.castShadow = b.receiveShadow = true;
      g.add(b);
    };
    side(MAT_W + 4, 2, 0, -MAT_D / 2 - 1);
    side(MAT_W + 4, 2, 0, MAT_D / 2 + 1);
    side(2, MAT_D, -MAT_W / 2 - 1, 0);
    side(2, MAT_D, MAT_W / 2 + 1, 0);
    return g;
  }

  // The toy bricks on the mat, by their grid places.
  setBricks(bricks) {
    for (const c of [...this.brickGroup.children]) this.brickGroup.remove(c);
    const body = (this.brickShape ??= new RoundedBoxGeometry(BRICK - 0.2, 6, BRICK - 0.2, 3, 0.35));
    const stud = (this.studShape ??= new THREE.CylinderGeometry(1.2, 1.2, 1.1, 20));
    bricks.forEach((b, i) => {
      const box = brickBox(b);
      const mat = (this.brickMats ??= BRICK_COLORS.map((color) => this.mats.make({ color, roughness: 0.3, clearcoat: 0.7 })))[(i + Math.abs(b[0] * 3 + b[1])) % BRICK_COLORS.length];
      const g = new THREE.Group();
      g.position.set((box.x0 + box.x1) / 2, 0, (box.z0 + box.z1) / 2);
      const m = new THREE.Mesh(body, mat);
      m.position.y = 3;
      g.add(m);
      for (const x of [-1, 1]) {
        for (const z of [-1, 1]) {
          const s = new THREE.Mesh(stud, mat);
          s.position.set(x * 2, 6.5, z * 2);
          g.add(s);
        }
      }
      g.traverse((o) => (o.castShadow = o.receiveShadow = true));
      this.brickGroup.add(g);
    });
  }

  setMode(mode) {
    if (mode === this.mode) return;
    this.mode = mode;
    const build = mode === 'build';
    this.plate.visible = build;
    this.mat.visible = !build;
    this.extras.visible = build;
    const reach = build ? 40 : 110;
    Object.assign(this.key.shadow.camera, { left: -reach, right: reach, top: reach, bottom: -reach, near: 1, far: 600 });
    this.key.shadow.camera.updateProjectionMatrix();
    this.key.position.set(-0.5 * reach * 2, 3 * reach, 0.8 * reach);
    this.key.target.position.set(0, 0, 0);
    if (build) {
      this.camera.position.set(18, 31, 33);
      this.controls.target.set(0, 2, 0);
      this.controls.minDistance = 25;
      this.controls.maxDistance = 120;
    } else {
      this.camera.position.set(0, 100, 106);
      this.controls.target.set(0, 0, 4);
      this.controls.minDistance = 30;
      this.controls.maxDistance = 320;
    }
    this.controls.update();
    this.placeRobot();
  }

  // The robot built from `parts`, and on the plate which part is picked
  // (`selected`, an index) and which are not joined to the hub.
  setParts(parts, selected = -1) {
    if (this.robot) {
      this.scene.remove(this.robot);
      this.robot.userData.dispose();
    }
    this.parts = parts;
    this.info = analyse(parts);
    this.robot = robotModel(parts, this.mats);
    this.scene.add(this.robot);
    for (const c of [...this.extras.children]) {
      this.extras.remove(c);
      c.geometry?.dispose();
    }
    const at = (p) => {
      const cells = cellsOf(p);
      const n = Math.sqrt(cells.length);
      return [(p.x + n / 2) * CELL - PLATE / 2, (p.z + n / 2) * CELL - PLATE / 2, n * CELL];
    };
    parts.forEach((p, i) => {
      const [x, z, w] = at(p);
      const loose = !this.info.joined.has(i);
      if (i === selected || loose) {
        const box = new THREE.Mesh(new THREE.BoxGeometry(w - 0.1, 7.5, w - 0.1), new THREE.MeshBasicMaterial({ color: loose ? '#ff4d4d' : '#ffd52e', transparent: true, opacity: loose ? 0.28 : 0.22, depthWrite: false }));
        box.position.set(x, 3.75, z);
        this.extras.add(box);
        const edges = new THREE.LineSegments(new THREE.EdgesGeometry(box.geometry), new THREE.LineBasicMaterial({ color: loose ? '#e02020' : '#f2a900' }));
        edges.position.copy(box.position);
        this.extras.add(edges);
      }
      const letter = this.info.portOf.get(i);
      if (letter) {
        const tag = new THREE.Sprite(tagMaterial(letter, '#3b4049'));
        tag.scale.set(2.4, 2.4, 1);
        tag.position.set(x, 9, z);
        tag.renderOrder = 5;
        this.extras.add(tag);
      }
    });
    this.placeRobot();
  }

  // On the plate the robot stands where it was built; on the mat it is where
  // the run has it (sim).
  placeRobot(sim = null) {
    if (!this.robot) return;
    const r = this.robot;
    if (this.mode === 'build') {
      const [mx, mz] = this.info.middle;
      r.position.set((mx - GRID / 2) * CELL, 0, (mz - GRID / 2) * CELL);
      r.rotation.y = 0;
    } else {
      const s = sim ?? { x: START.x, z: START.z, a: START.a };
      r.position.set(s.x, 0, s.z);
      r.rotation.y = -(s.a - this.info.front * (Math.PI / 2));
    }
  }

  // The place on the plate under a point on the screen (client pixels):
  // { x, z } studs, or null off the plate. On the mat, centimetres.
  pick(cx, cy) {
    // Tapped before a frame was drawn, the camera is not yet where it looks from.
    this.resize();
    this.camera.updateMatrixWorld();
    const r = this.canvas.getBoundingClientRect();
    const ndc = new THREE.Vector2(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1);
    this.ray.setFromCamera(ndc, this.camera);
    if (this.mode === 'build' && this.robot) {
      // A part hit first: its stud.
      const hit = this.ray.intersectObject(this.robot, true)[0];
      if (hit) {
        let o = hit.object;
        while (o && o.userData.index === undefined) o = o.parent;
        if (o) return { part: o.userData.index };
      }
    }
    const p = this.ray.ray.intersectPlane(this.ground, new THREE.Vector3());
    if (!p) return null;
    if (this.mode === 'build') {
      const x = Math.floor((p.x + PLATE / 2) / CELL);
      const z = Math.floor((p.z + PLATE / 2) / CELL);
      return x >= 0 && z >= 0 && x < GRID && z < GRID ? { x, z } : null;
    }
    return Math.abs(p.x) <= MAT_W / 2 && Math.abs(p.z) <= MAT_D / 2 ? { cx: p.x, cz: p.z } : null;
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

  // One frame. On the mat, `sim` is the robot running (or standing ready);
  // `follow` keeps the camera's eye on it.
  render(sim = null, follow = false) {
    this.resize();
    if (this.mode === 'run' && sim) {
      const before = this.robot?.position.clone();
      this.placeRobot(sim);
      if (follow && before) {
        const d = this.robot.position.clone().sub(this.controls.target);
        d.y = 0;
        this.controls.target.add(d);
        this.camera.position.add(d);
      }
      const seen = {};
      const pressed = {};
      for (const [letter, i] of Object.entries(this.info.ports)) {
        if (this.parts[i].k === 'color') seen[letter] = sim.color(letter);
        if (this.parts[i].k === 'bumper') pressed[letter] = sim.pressed(letter);
      }
      this.robot?.userData.update({ motors: sim.motors, matrix: sim.matrix, lamps: sim.lamps, seen, pressed });
    } else this.robot?.userData.update();
    this.controls.update();
    this.gl.render(this.scene, this.camera);
  }

  dispose() {
    this.controls.dispose();
    this.robot?.userData.dispose();
    this.gl.dispose();
    this.envMap.dispose();
  }
}

