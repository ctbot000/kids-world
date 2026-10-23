// The gashapon machine in its window, in 3D: the same machine as on the
// island (render/gashapon-model.js) on a little table under soft studio
// light, close up. Turn its handle and it clicks round, the machine gives a
// shake, and a capsule pushes out through the chute's flap, drops and
// bounces and rolls to a stop in front. It wobbles until it is opened: its
// lid flips up on its hinge and falls away, the cup drops, and the toy
// figure (render/capsule-toys.js) springs up out of it in a burst of light
// and sparkles, and turns slowly round to be seen.
//
// A WebGL context of its own (the dialog's canvas), so its own materials.
import * as THREE from '../../vendor/three.module.js';
import { RoomEnvironment } from '../../vendor/three-addons/environments/RoomEnvironment.js';
import { toyFigure } from './capsule-toys.js';
import { CAPSULE_R, CHUTE, capsuleModel, gashaponMaterials, gashaponModel, HANDLE, SHELLS } from './gashapon-model.js';

// Where a capsule comes to rest, and how big the toy stands there.
const REST = new THREE.Vector3(-0.5, 0, -0.5);
const TOY_SIZE = 0.46;
// How the burst behind a toy is coloured, by rarity.
const RAYS = { common: '#ffe39a', rare: '#cdb8ff', super: '#ffd84d' };

const ease = (t) => 1 - (1 - t) ** 3;
const clamp01 = (t) => Math.max(0, Math.min(1, t));

// A soft round shadow, painted on a canvas.
function blobTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const x = c.getContext('2d');
  const grd = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  grd.addColorStop(0, 'rgba(40,30,50,0.55)');
  grd.addColorStop(0.6, 'rgba(40,30,50,0.2)');
  grd.addColorStop(1, 'rgba(40,30,50,0)');
  x.fillStyle = grd;
  x.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

// Rays of light fanning out from the middle, faded at the edge.
function rayTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const x = c.getContext('2d');
  x.translate(128, 128);
  for (let i = 0; i < 16; i++) {
    x.rotate((Math.PI * 2) / 16);
    x.beginPath();
    x.moveTo(0, 0);
    x.lineTo(-10, -128);
    x.lineTo(10, -128);
    x.closePath();
    x.fillStyle = 'rgba(255,255,255,0.75)';
    x.fill();
  }
  x.setTransform(1, 0, 0, 1, 0, 0);
  const fade = x.createRadialGradient(128, 128, 10, 128, 128, 128);
  fade.addColorStop(0, 'rgba(255,255,255,1)');
  fade.addColorStop(0.3, 'rgba(255,255,255,0.6)');
  fade.addColorStop(1, 'rgba(255,255,255,0)');
  x.globalCompositeOperation = 'destination-in';
  x.fillStyle = fade;
  x.fillRect(0, 0, 256, 256);
  x.globalCompositeOperation = 'source-over';
  const glow = x.createRadialGradient(128, 128, 0, 128, 128, 70);
  glow.addColorStop(0, 'rgba(255,255,255,0.9)');
  glow.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = glow;
  x.fillRect(0, 0, 256, 256);
  return new THREE.CanvasTexture(c);
}

export class GashaStage {
  // canvas: the dialog's. Throws if WebGL cannot be had (the window then
  // keeps its flat picture).
  constructor(canvas) {
    this.canvas = canvas;
    this.gl = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'low-power' });
    this.gl.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    this.gl.outputColorSpace = THREE.SRGBColorSpace;
    this.gl.toneMapping = THREE.ACESFilmicToneMapping;
    this.gl.toneMappingExposure = 1.05;
    this.scene = new THREE.Scene();
    const pmrem = new THREE.PMREMGenerator(this.gl);
    const room = new RoomEnvironment();
    this.envMap = pmrem.fromScene(room, 0.04).texture;
    room.dispose();
    pmrem.dispose();
    this.scene.environment = this.envMap;
    this.scene.add(new THREE.HemisphereLight(0xfff6ea, 0xd8c8b0, 1.1));
    const key = new THREE.DirectionalLight(0xffffff, 1.6);
    key.position.set(-1.2, 2.2, -1.6);
    this.scene.add(key);
    this.camera = new THREE.PerspectiveCamera(30, 1, 0.05, 20);
    this.camera.position.set(-0.05, 0.95, -2.45);
    this.look = new THREE.Vector3(-0.24, 0.4, -0.22);
    this.camera.lookAt(this.look);

    this.materials = gashaponMaterials();
    this.toyMats = new Map();
    // The table it stands on, and soft shadows under it and the capsule.
    const blob = blobTexture();
    const shadow = (w, d) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshBasicMaterial({ map: blob, transparent: true, depthWrite: false }));
      m.rotation.x = -Math.PI / 2;
      m.position.y = 0.002;
      m.renderOrder = -1;
      this.scene.add(m);
      return m;
    };
    shadow(1.15, 1.15);
    this.capShadow = shadow(0.2, 0.2);
    this.capShadow.visible = false;
    this.machine = gashaponModel(this.materials);
    this.scene.add(this.machine);

    this.rays = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: rayTexture(), transparent: true, depthWrite: false, color: RAYS.common }));
    this.rays.visible = false;
    this.rays.renderOrder = -1;
    this.scene.add(this.rays);
    // Sparkles thrown out as the capsule opens.
    this.sparks = [];

    this.capsule = null;
    this.toy = null;
    // What is going on: { kind, at (seconds), ... }.
    this.turning = null;
    this.state = 'idle';
    this.clock = new THREE.Clock();
    this.size = [0, 0];
    this.frame = this.frame.bind(this);
    this.raf = requestAnimationFrame(this.frame);
  }

  mat(color, extra = {}) {
    const k = `${color}|${JSON.stringify(extra, (_, v) => (v?.isColor ? `#${v.getHexString()}` : v))}`;
    let m = this.toyMats.get(k);
    if (!m) {
      m = new THREE.MeshPhysicalMaterial({ color, roughness: 0.3, clearcoat: 0.8, clearcoatRoughness: 0.12, envMapIntensity: 0.9, ...extra });
      this.toyMats.set(k, m);
    }
    return m;
  }

  // The handle turned: it clicks round once and the machine shakes.
  turn() {
    this.turning = { t: 0 };
    this.clear();
  }

  // A capsule out of the chute, with `toyKey` inside, in a shell of colour
  // `shell` (one of SHELLS, or any colour).
  drop(shell, toyKey) {
    this.clear();
    let i = SHELLS.indexOf(shell);
    if (i < 0) i = 0;
    const r = 0.1;
    this.capsule = capsuleModel(this.materials, i, r);
    this.capsule.position.set(CHUTE.x, CHUTE.y, CHUTE.z);
    this.scene.add(this.capsule);
    // The toy, small and folded away inside the capsule until it opens.
    this.toy = toyFigure(toyKey, (c, e) => this.mat(c, e));
    if (this.toy) {
      this.toy.scale.setScalar(r * 1.3);
      this.toy.position.set(0, -r * 0.55, 0);
      this.capsule.add(this.toy);
    }
    this.r = r;
    this.state = 'drop';
    this.at = 0;
  }

  // Opened (rarity: 'common', 'rare' or 'super'): the lid flips off, and
  // the toy springs out.
  open(rarity = 'common') {
    if (!this.capsule || this.state === 'open') return;
    this.state = 'open';
    this.at = 0;
    this.rays.material.color.set(RAYS[rarity] ?? RAYS.common);
    // The toy comes out of the capsule into the world, where it stands.
    if (this.toy) {
      this.capsule.updateMatrixWorld(true);
      this.toy.removeFromParent();
      this.toy.position.copy(this.capsule.position);
      this.toy.position.y = this.r * 0.4;
      this.toy.rotation.set(0, 0, 0);
      this.toy.scale.setScalar(this.r * 1.3);
      this.scene.add(this.toy);
    }
    const colors = rarity === 'super' ? ['#ffd84d', '#fff3b0', '#ffb13b'] : rarity === 'rare' ? ['#cdb8ff', '#ffffff', '#f9a8d4'] : ['#ffe39a', '#ffffff', '#9bd44a', '#62c4f5'];
    for (let i = 0; i < (rarity === 'common' ? 18 : 30); i++) {
      const s = new THREE.Mesh(new THREE.OctahedronGeometry(0.012 + Math.random() * 0.012), new THREE.MeshBasicMaterial({ color: colors[i % colors.length], transparent: true }));
      const a = Math.random() * Math.PI * 2;
      const up = 0.6 + Math.random() * 0.9;
      s.position.set(REST.x, this.r, REST.z);
      s.userData.v = new THREE.Vector3(Math.cos(a) * 0.5, up, Math.sin(a) * 0.35 - 0.15);
      this.scene.add(s);
      this.sparks.push(s);
    }
  }

  // The capsule's middle on the canvas, in its CSS pixels, and how far
  // round it a tap still counts: { x, y, r }, or null with none.
  capsuleOnScreen() {
    if (!this.capsule || this.state === 'open') return null;
    const p = this.capsule.position.clone();
    p.project(this.camera);
    const w = this.canvas.clientWidth;
    const h = this.canvas.clientHeight;
    return { x: (p.x * 0.5 + 0.5) * w, y: (-p.y * 0.5 + 0.5) * h, r: Math.max(26, (this.r / 0.42) * h * 0.9) };
  }

  clear() {
    if (this.capsule) this.capsule.removeFromParent();
    if (this.toy) this.toy.removeFromParent();
    for (const s of this.sparks) {
      s.removeFromParent();
      s.geometry.dispose();
      s.material.dispose();
    }
    this.sparks = [];
    this.capsule = null;
    this.toy = null;
    this.rays.visible = false;
    this.capShadow.visible = false;
    this.state = 'idle';
  }

  resize() {
    const w = this.canvas.clientWidth;
    const h = this.canvas.clientHeight;
    if (!w || !h || (w === this.size[0] && h === this.size[1])) return;
    this.size = [w, h];
    this.gl.setSize(w, h, false);
    this.camera.aspect = w / h;
    // Narrow (a phone): step back so the machine and the capsule both fit.
    const back = w / h < 1.2 ? 1.25 : 1;
    this.camera.position.set(-0.05 * back, 0.95 * back, -2.45 * back);
    this.camera.lookAt(this.look);
    this.camera.updateProjectionMatrix();
  }

  frame() {
    this.raf = requestAnimationFrame(this.frame);
    const dt = Math.min(0.05, this.clock.getDelta());
    this.resize();
    const t = this.clock.elapsedTime;
    // The machine breathing a little, so it is plainly real and 3D.
    this.machine.rotation.y = Math.sin(t * 0.5) * 0.06;
    this.step(dt, t);
    this.gl.render(this.scene, this.camera);
  }

  step(dt, t) {
    const handle = this.machine.userData.handle;
    if (this.turning) {
      this.turning.t += dt;
      const k = clamp01(this.turning.t / 0.85);
      // Round once in clicks: a little hold at each quarter.
      const q = k * 4;
      const step = Math.floor(q) + ease(clamp01((q % 1) * 1.6));
      handle.rotation.z = -(Math.min(4, step) / 4) * Math.PI * 2;
      this.machine.position.x = Math.sin(this.turning.t * 60) * 0.004 * (1 - k);
      if (k >= 1) {
        this.turning = null;
        handle.rotation.z = 0;
        this.machine.position.x = 0;
      }
    }
    const c = this.capsule;
    if (c && this.state === 'drop') {
      this.at += dt;
      const a = this.at;
      // Out through the flap, then a fall in an arc and two bounces, rolling
      // to a stop where it rests.
      const out = clamp01(a / 0.25);
      const fly = clamp01((a - 0.25) / 0.35);
      const from = new THREE.Vector3(CHUTE.x, CHUTE.y, CHUTE.z - 0.04 - out * 0.08);
      const x = THREE.MathUtils.lerp(from.x, REST.x, ease(fly));
      const z = THREE.MathUtils.lerp(from.z, REST.z, ease(fly));
      let y;
      if (a < 0.25) y = from.y;
      else if (a < 0.6) y = THREE.MathUtils.lerp(from.y, this.r, fly * fly) + Math.sin(fly * Math.PI) * 0.08;
      else {
        const b = a - 0.6;
        y = this.r + Math.max(0, Math.abs(Math.sin(b * 9)) * 0.07 * Math.exp(-b * 6));
      }
      c.position.set(x, y, z);
      const roll = Math.min(a, 1.4);
      c.rotation.set(-roll * 5 * (1 - roll / 1.4) - 0.3, 0.6, roll * 2.2 * (1 - roll / 1.4));
      this.capShadow.visible = a > 0.3;
      this.capShadow.position.set(x, 0.002, z);
      if (a > 1.4) {
        this.state = 'ready';
        this.at = 0;
      }
    } else if (c && this.state === 'ready') {
      this.at += dt;
      // A wiggle now and then, as if something inside wants out.
      const w = this.at % 1.6;
      const shake = w < 0.5 ? Math.sin(w * 30) * 0.18 * (1 - w / 0.5) : 0;
      c.rotation.set(-0.3, 0.6, shake);
    } else if (c && this.state === 'open') {
      this.at += dt;
      const a = this.at;
      const top = c.userData.top;
      const bottom = c.userData.bottom;
      // The lid flips up on its hinge, then flies off and fades.
      top.rotation.x = ease(clamp01(a / 0.25)) * 2.2;
      top.position.y = this.r * 0 + Math.max(0, a - 0.2) * 0.9;
      top.position.z = this.r + Math.max(0, a - 0.2) * 0.6;
      const fade = clamp01(1 - (a - 0.35) / 0.3);
      top.children[0].material = this.fadeOf(top.children[0].material, fade);
      bottom.position.y = -Math.max(0, a - 0.15) * 0.4;
      bottom.children[0].material = this.fadeOf(bottom.children[0].material, clamp01(1 - (a - 0.2) / 0.3));
      c.userData.seam.visible = a < 0.2;
      c.rotation.set(-0.3 * (1 - clamp01(a / 0.2)), 0.6, 0);
      // The toy springs up, overshoots, and settles, turning slowly round.
      if (this.toy) {
        const s = clamp01((a - 0.08) / 0.55);
        const spring = 1 + Math.sin(s * Math.PI * 1.5) * 0.18 * (1 - s);
        const size = THREE.MathUtils.lerp(this.r * 1.3, TOY_SIZE, ease(s)) * spring;
        this.toy.scale.setScalar(size);
        const hop = Math.sin(clamp01(a / 0.6) * Math.PI) * 0.12;
        this.toy.position.set(REST.x, Math.max(0, (1 - ease(s)) * this.r * 0.4) + hop + (a > 0.7 ? Math.sin((a - 0.7) * 2.2) * 0.012 + 0.012 : 0), REST.z);
        // Facing the camera, swaying a little to show its sides.
        const face = Math.atan2(REST.x - this.camera.position.x, REST.z - this.camera.position.z);
        this.toy.rotation.y = face + Math.sin(a * 0.9) * 0.45 + (a < 0.6 ? (1 - a / 0.6) * Math.PI * 2 : 0);
      }
      // The burst behind it, facing the camera and turning.
      this.rays.visible = true;
      const rs = ease(clamp01(a / 0.5)) * 0.85;
      this.rays.scale.setScalar(Math.max(0.001, rs));
      this.rays.position.set(REST.x, TOY_SIZE * 0.55, REST.z + 0.05);
      this.rays.quaternion.copy(this.camera.quaternion);
      this.rays.rotateZ(t * 0.4);
      this.rays.material.opacity = a < 0.5 ? 1 : 0.75 + Math.sin(t * 2) * 0.1;
      this.capShadow.scale.setScalar(1 + ease(clamp01(a / 0.5)) * 0.8);
      for (const s of this.sparks) {
        const v = s.userData.v;
        v.y -= dt * 2.4;
        s.position.addScaledVector(v, dt * 0.55);
        s.rotation.x += dt * 6;
        s.rotation.y += dt * 4;
        s.material.opacity = clamp01(1.6 - a);
      }
    }
  }

  // A see-through copy of a material, as faded as asked (made once each).
  fadeOf(m, o) {
    const base = m.userData.base ?? m;
    if (o >= 0.999) return base;
    let f = base.userData.faded;
    if (!f) {
      f = base.clone();
      f.transparent = true;
      f.depthWrite = false;
      f.userData.base = base;
      base.userData.faded = f;
    }
    f.opacity = (base.opacity ?? 1) * o;
    return f;
  }

  dispose() {
    cancelAnimationFrame(this.raf);
    this.clear();
    this.scene.traverse((o) => {
      if (o.isMesh && !o.userData.shared) o.geometry?.dispose();
    });
    for (const m of [...Object.values(this.materials), ...this.toyMats.values()]) {
      m.userData.faded?.dispose();
      m.dispose();
    }
    this.envMap.dispose();
    this.gl.dispose();
    this.gl.forceContextLoss();
  }
}

// Pictures of the toy figures for the collection, each rendered once in 3D
// in the window's light, three-quarters on, and kept for as long as the
// page is open: { [toy key]: data URL }, with MYSTERY for one still to
// find (a closed capsule). Without WebGL, an empty list.
export const MYSTERY = 'mystery';
const portraits = new Map();
export function toyPortraits(keys, size = 160) {
  const want = [...keys, MYSTERY].filter((k) => !portraits.has(k));
  if (want.length) {
    let gl;
    try {
      const canvas = document.createElement('canvas');
      gl = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
    } catch {
      return Object.fromEntries(portraits);
    }
    const ratio = Math.min(2, window.devicePixelRatio || 1);
    gl.setPixelRatio(ratio);
    gl.setSize(size, size, false);
    gl.outputColorSpace = THREE.SRGBColorSpace;
    gl.toneMapping = THREE.ACESFilmicToneMapping;
    gl.toneMappingExposure = 1.05;
    const scene = new THREE.Scene();
    const pmrem = new THREE.PMREMGenerator(gl);
    const room = new RoomEnvironment();
    const env = pmrem.fromScene(room, 0.04).texture;
    room.dispose();
    pmrem.dispose();
    scene.environment = env;
    scene.add(new THREE.HemisphereLight(0xfff6ea, 0xd8c8b0, 1.1));
    const key = new THREE.DirectionalLight(0xffffff, 1.6);
    key.position.set(-1.2, 2.2, -1.6);
    scene.add(key);
    const camera = new THREE.PerspectiveCamera(26, 1, 0.05, 50);
    const mats = new Map();
    const mat = (color, extra = {}) => {
      const k = `${color}|${JSON.stringify(extra, (_, v) => (v?.isColor ? `#${v.getHexString()}` : v))}`;
      if (!mats.has(k)) mats.set(k, new THREE.MeshPhysicalMaterial({ color, roughness: 0.3, clearcoat: 0.8, clearcoatRoughness: 0.12, envMapIntensity: 0.9, ...extra }));
      return mats.get(k);
    };
    const capsuleMats = gashaponMaterials();
    for (const k of want) {
      let model;
      if (k === MYSTERY) {
        // A closed capsule, grey-lidded, lying a little tipped over.
        model = capsuleModel({ ...capsuleMats, shell0: mat('#a9b1bc', { roughness: 0.18, clearcoat: 1 }), clear: mat('#e9edf2', { roughness: 0.15, clearcoat: 1 }) }, 0, 0.3);
        model.rotation.set(-0.35, 0.6, 0.25);
      } else {
        model = toyFigure(k, mat);
        if (!model) continue;
        model.rotation.y = -0.45;
      }
      scene.add(model);
      // Framed to fit, whatever its shape, seen a little from above.
      const box = new THREE.Box3().setFromObject(model);
      const mid = box.getCenter(new THREE.Vector3());
      const r = box.getSize(new THREE.Vector3()).length() / 2;
      const d = (r / Math.sin(THREE.MathUtils.degToRad(13))) * (k === MYSTERY ? 0.8 : 0.92);
      camera.position.set(mid.x, mid.y + d * 0.28, mid.z - d * 0.96);
      camera.lookAt(mid);
      camera.updateProjectionMatrix();
      gl.render(scene, camera);
      portraits.set(k, gl.domElement.toDataURL('image/png'));
      scene.remove(model);
    }
    for (const m of [...mats.values(), ...Object.values(capsuleMats)]) m.dispose();
    env.dispose();
    gl.dispose();
    gl.forceContextLoss();
  }
  return Object.fromEntries(portraits);
}
