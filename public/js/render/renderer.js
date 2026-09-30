// Puts the island on screen: the terrain, the sky, players and animals, the
// preview of what a tool is about to do, and a camera that follows you
// around (and never ends up inside a hill).
import * as THREE from '../../vendor/three.module.js';
import { OPAQUE, SOLID, TREE_PART } from '../shared/blocks.js';
import { raycast } from '../shared/raycast.js';
import { Avatar } from './avatar.js';
import { CritterModel } from './critter-models.js';
import { Effects } from './effects.js';
import { environment, Sky } from './sky.js';
import { Terrain } from './terrain.js';

const MAX_PREVIEW = 2500;
const tmpV = new THREE.Vector3();
const tmpM = new THREE.Matrix4();
const tmpC = new THREE.Color();

export class Renderer {
  constructor(canvas, atlas) {
    this.canvas = canvas;
    this.atlas = atlas;
    const gl = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer: false });
    gl.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    gl.outputColorSpace = THREE.SRGBColorSpace;
    gl.toneMapping = THREE.NoToneMapping;
    this.gl = gl;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(58, 1, 0.08, 1500);
    this.camera.position.set(0, 40, 40);
    this.terrain = new Terrain(this.scene, atlas);
    this.sky = new Sky(this.scene);
    this.effects = new Effects(this.scene);
    this.env = {};

    this.hemi = new THREE.HemisphereLight(0xdff2ff, 0x9fcf7f, 1.6);
    this.sun = new THREE.DirectionalLight(0xffffff, 2.2);
    this.scene.add(this.hemi, this.sun, this.sun.target);

    this.entities = new THREE.Group();
    this.entities.name = 'entities';
    this.scene.add(this.entities);
    this.avatars = new Map();
    this.critters = new Map();

    // What a tool is about to do: see-through blocks, or outlines for removal.
    const box = new THREE.BoxGeometry(1.02, 1.02, 1.02);
    box.translate(0.5, 0.5, 0.5);
    this.previewMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.45, depthWrite: false });
    this.preview = new THREE.InstancedMesh(box, this.previewMat, MAX_PREVIEW);
    this.preview.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.preview.count = 0;
    this.preview.frustumCulled = false;
    this.preview.renderOrder = 4;
    this.scene.add(this.preview);
    const edges = new THREE.EdgesGeometry(new THREE.BoxGeometry(1.03, 1.03, 1.03));
    edges.translate(0.5, 0.5, 0.5);
    this.outline = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9, depthTest: true }));
    this.outline.visible = false;
    this.outline.renderOrder = 6;
    this.scene.add(this.outline);

    this.view = { yaw: Math.PI * 0.85, pitch: 0.45, dist: 8, target: new THREE.Vector3(), smooth: new THREE.Vector3(), ready: false };
    this.focus = { x: 0, y: 0, z: 0, cloudY: 90 };
    this.time = 0;
    this.world = null;
    this.selfHidden = false;
    this.resize();
  }

  setWorld(world) {
    this.world = world;
    this.terrain.setWorld(world);
    this.focus.cloudY = world.H + 22;
    this.view.ready = false;
  }

  resize() {
    const w = this.canvas.clientWidth || window.innerWidth;
    const h = this.canvas.clientHeight || window.innerHeight;
    if (w < 2 || h < 2) return;
    this.gl.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  setQuality({ studs = true, pixelRatio = null, far = null } = {}) {
    this.terrain.studsOn = studs;
    if (pixelRatio) this.gl.setPixelRatio(pixelRatio);
    if (far) this.fogFar = far;
    this.resize();
  }

  // ------------------------------------------------ players and animals

  addAvatar(pid, look, name) {
    this.removeAvatar(pid);
    const a = new Avatar(look, { name });
    a.pos = new THREE.Vector3();
    a.yaw = 0;
    this.entities.add(a.root, a.shadow);
    this.avatars.set(pid, a);
    return a;
  }

  removeAvatar(pid) {
    const a = this.avatars.get(pid);
    if (!a) return;
    a.dispose();
    this.avatars.delete(pid);
  }

  addCritter(id, type) {
    this.removeCritter(id);
    const m = new CritterModel(type, id);
    this.entities.add(m.group, m.shadow);
    this.critters.set(id, m);
    return m;
  }

  removeCritter(id) {
    const m = this.critters.get(id);
    if (!m) return;
    m.dispose();
    this.critters.delete(id);
  }

  // Where the ground is under something, for its round shadow.
  groundUnder(x, y, z) {
    const w = this.world;
    if (!w) return y;
    const gx = Math.floor(x);
    const gz = Math.floor(z);
    for (let yy = Math.floor(y + 0.1); yy >= Math.max(0, Math.floor(y) - 6); yy--) if (SOLID[w.get(gx, yy - 1, gz)]) return yy;
    return null;
  }

  placeShadow(shadow, x, y, z, scale = 1) {
    const g = this.groundUnder(x, y, z);
    if (g === null) {
      shadow.visible = false;
      return;
    }
    shadow.visible = true;
    const h = Math.max(0, y - g);
    shadow.position.set(x, g + 0.03, z);
    shadow.scale.setScalar(scale * Math.max(0.4, 1 - h * 0.18));
    shadow.material.opacity = 0.22 * Math.max(0.2, 1 - h * 0.25);
  }

  // ------------------------------------------------ camera

  orbit(dyaw, dpitch) {
    const v = this.view;
    v.yaw += dyaw;
    v.pitch = Math.min(1.35, Math.max(-0.35, v.pitch + dpitch));
  }

  zoom(factor) {
    const v = this.view;
    v.dist = Math.min(18, Math.max(2.2, v.dist * factor));
  }

  // Follows the target, pulling in if a hill or a wall is in the way. Leaves
  // do not count: the camera slips inside a tree crown and sees through it.
  updateCamera(dt, target, collide = true) {
    const v = this.view;
    v.target.set(target.x, target.y + 1.25, target.z);
    if (!v.ready) {
      v.smooth.copy(v.target);
      v.ready = true;
      this.camDist = v.dist;
    }
    v.smooth.lerp(v.target, 1 - Math.exp(-dt * 12));
    const dir = tmpV.set(Math.sin(v.yaw) * Math.cos(v.pitch), Math.sin(v.pitch), Math.cos(v.yaw) * Math.cos(v.pitch));
    let dist = v.dist;
    if (this.world && collide) {
      const hit = raycast(this.world, v.smooth.x, v.smooth.y, v.smooth.z, dir.x, dir.y, dir.z, dist + 0.3, (id) => OPAQUE[id] === 1 && !TREE_PART[id]);
      if (hit) dist = Math.max(0.6, hit.dist - 0.3);
    }
    // Snap in at once (never show the inside of a wall), ease back out.
    this.camDist = dist < (this.camDist ?? dist) ? dist : this.camDist + (dist - this.camDist) * Math.min(1, dt * 3);
    this.camera.position.copy(v.smooth).addScaledVector(dir, this.camDist);
    this.camera.lookAt(v.smooth);
    return this.camDist;
  }

  // The ray from the camera through a point on the screen (-1..1 each way).
  ray(ndcX, ndcY) {
    const origin = this.camera.position.clone();
    const dir = new THREE.Vector3(ndcX, ndcY, 0.5).unproject(this.camera).sub(origin).normalize();
    return { origin, dir };
  }

  // The nearest animal the ray passes through, if any, and how far along.
  pickCritter(ray, maxDist) {
    let best = null;
    for (const [id, m] of this.critters) {
      const c = m.group.position;
      const cy = c.y + m.height * 0.5;
      const r = m.type === 'sheep' ? 0.5 : 0.38;
      const ox = c.x - ray.origin.x;
      const oy = cy - ray.origin.y;
      const oz = c.z - ray.origin.z;
      const t = ox * ray.dir.x + oy * ray.dir.y + oz * ray.dir.z;
      if (t < 0 || t > maxDist) continue;
      const d2 = ox * ox + oy * oy + oz * oz - t * t;
      if (d2 > r * r) continue;
      if (!best || t < best.dist) best = { id, dist: t };
    }
    return best;
  }

  project(x, y, z) {
    const p = tmpV.set(x, y, z).project(this.camera);
    const w = this.canvas.clientWidth;
    const h = this.canvas.clientHeight;
    return { x: ((p.x + 1) / 2) * w, y: ((1 - p.y) / 2) * h, visible: p.z < 1 && p.z > -1 && Math.abs(p.x) < 1.2 && Math.abs(p.y) < 1.2 };
  }

  // ------------------------------------------------ previews

  // cells: flat [x, y, z, id...]; mode 'add' shows see-through blocks, 'remove' outlines them.
  showPreview(cells, mode) {
    const n = Math.min(MAX_PREVIEW, cells ? cells.length / 4 : 0);
    const tint = this.atlas.studTint;
    for (let i = 0; i < n; i++) {
      const x = cells[i * 4];
      const y = cells[i * 4 + 1];
      const z = cells[i * 4 + 2];
      const id = cells[i * 4 + 3];
      tmpM.makeTranslation(x - 0.01, y - 0.01, z - 0.01);
      this.preview.setMatrixAt(i, tmpM);
      if (mode === 'remove') tmpC.setRGB(1, 0.35, 0.35);
      else if (mode === 'paint' || mode === 'add') tmpC.setRGB(tint[id * 3] / 255, tint[id * 3 + 1] / 255, tint[id * 3 + 2] / 255, THREE.SRGBColorSpace);
      else tmpC.setRGB(1, 1, 1);
      this.preview.setColorAt(i, tmpC);
    }
    this.preview.count = n;
    this.preview.instanceMatrix.needsUpdate = true;
    if (this.preview.instanceColor) this.preview.instanceColor.needsUpdate = true;
    this.previewMat.opacity = mode === 'remove' ? 0.3 : 0.5;
  }

  showOutline(cell) {
    if (!cell) {
      this.outline.visible = false;
      return;
    }
    this.outline.visible = true;
    this.outline.position.set(cell[0] - 0.015, cell[1] - 0.015, cell[2] - 0.015);
  }

  // ------------------------------------------------ each frame

  frame(dt, state) {
    this.time += dt;
    const env = environment(state.time, state.weather, this.world?.theme, this.env);
    const fogFar = this.fogFar ?? 150;
    this.terrain.setLighting({
      daylight: env.daylight,
      sun: env.sun,
      ambient: env.ambient,
      fog: env.fog,
      fogNear: fogFar * 0.45,
      fogFar,
      time: this.time,
    });
    this.sky.setWeather(state.weather);
    this.focus.x = state.focus.x;
    this.focus.y = state.focus.y;
    this.focus.z = state.focus.z;
    this.sky.update(dt, this.time, env, this.camera, this.focus);
    this.scene.fog = null;

    // Lights for the players and animals follow the sun.
    this.sun.color.copy(env.sun);
    this.sun.intensity = 0.8 + 1.6 * env.day;
    this.sun.position.copy(state.focus).addScaledVector(env.day > 0.15 ? env.sunDir : env.moonDir, 50);
    this.sun.target.position.copy(state.focus);
    this.hemi.color.copy(env.top).lerp(tmpC.setRGB(1, 1, 1), 0.55);
    this.hemi.groundColor.setRGB(0.55, 0.62, 0.45).multiplyScalar(0.5 + 0.5 * env.day);
    this.hemi.intensity = 1.1 + 0.6 * env.day;

    this.terrain.update(state.focus, 6);
    this.terrain.updateStuds(this.camera.position);
    this.effects.update(dt);
    const pulse = 0.55 + 0.35 * Math.sin(this.time * 6);
    this.outline.material.opacity = pulse;
    this.gl.render(this.scene, this.camera);
  }

  dispose() {
    this.terrain.dispose();
    this.gl.dispose();
  }
}
