// The games of Go and Gomoku on the island's Go boards (shared/go.js): each a little
// canvas of the game's lines and stones laid over its board's wood, lit like
// the blocks round it, as drawings.js lays pictures over drawing boards, so
// everyone sees the game going.
import * as THREE from '../../vendor/three.module.js';
import { BLACK, SURFACE } from '../shared/go.js';
import { LIGHT_GLSL } from './terrain.js';

const SIZE = 256;

const VERT = /* glsl */ `
  varying vec2 vUv;
  varying float vDepth;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
    vUv = uv;
    vDepth = -mv.z;
  }
`;

const FRAG = /* glsl */ `
  uniform sampler2D uMap;
  uniform float uSky;
  uniform float uLamp;
  varying vec2 vUv;
  varying float vDepth;
  ${LIGHT_GLSL}
  void main() {
    nearFade(vDepth);
    vec3 col = decode(texture2D(uMap, vUv).rgb) * lightOf(uSky, uLamp) * 0.92;
    gl_FragColor = vec4(fogged(col, vDepth), 1.0);
    #include <colorspace_fragment>
  }
`;

export class GoBoards {
  constructor(scene, terrain) {
    this.terrain = terrain;
    this.group = new THREE.Group();
    this.group.name = 'go-boards';
    scene.add(this.group);
    // By cell key: { mesh, canvas, texture, x, y, z, drawn }.
    this.shown = new Map();
  }

  // The game `g` (as GoSim packs it) on its board, new or moved on.
  show(key, g) {
    let d = this.shown.get(key);
    if (!d) {
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = SIZE;
      const texture = new THREE.CanvasTexture(canvas);
      const material = new THREE.ShaderMaterial({
        uniforms: { ...this.terrain.uniforms, uMap: { value: texture }, uSky: { value: 1 }, uLamp: { value: 0 } },
        vertexShader: VERT,
        fragmentShader: FRAG,
      });
      // Flat on the board's top, row 0 of the game to the north (low z).
      const { x0, x1, z0, z1, y } = SURFACE;
      const geometry = new THREE.BufferGeometry();
      const bl = [x0, y, z1];
      const br = [x1, y, z1];
      const tr = [x1, y, z0];
      const tl = [x0, y, z0];
      geometry.setAttribute('position', new THREE.Float32BufferAttribute([...bl, ...br, ...tr, ...bl, ...tr, ...tl], 3));
      geometry.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1], 2));
      geometry.computeBoundingSphere();
      const mesh = new THREE.Mesh(geometry, material);
      mesh.name = `go ${key}`;
      d = { mesh, canvas, texture, drawn: '' };
      this.shown.set(key, d);
      this.group.add(mesh);
    }
    Object.assign(d, { x: g.x, y: g.y, z: g.z });
    d.mesh.position.set(g.x, g.y, g.z);
    const k = `${g.n}|${g.b}|${g.last}`;
    if (d.drawn === k) return;
    d.drawn = k;
    paintGo(d.canvas, g);
    d.texture.needsUpdate = true;
  }

  remove(key) {
    const d = this.shown.get(key);
    if (!d) return;
    this.group.remove(d.mesh);
    d.mesh.geometry.dispose();
    d.mesh.material.dispose();
    d.texture.dispose();
    this.shown.delete(key);
  }

  clear() {
    for (const key of [...this.shown.keys()]) this.remove(key);
  }

  // Each frame: the light where each board stands.
  update() {
    const light = this.terrain.light;
    if (!light) return;
    for (const d of this.shown.values()) {
      const u = d.mesh.material.uniforms;
      u.uSky.value = light.skyAt(d.x, d.y, d.z) / 15;
      u.uLamp.value = light.lampAt(d.x, d.y, d.z) / 15;
    }
  }
}

// A game's board onto a canvas: the wood, its n lines each way, the star
// points, and the stones, the last one ringed.
export function paintGo(canvas, g) {
  const ctx = canvas.getContext('2d');
  const s = canvas.width;
  const n = g.n;
  const step = s / n;
  const at = (k) => (k + 0.5) * step;
  ctx.fillStyle = '#e2b866';
  ctx.fillRect(0, 0, s, s);
  ctx.strokeStyle = '#3a2a1c';
  ctx.lineWidth = Math.max(2, s / 120);
  ctx.beginPath();
  for (let k = 0; k < n; k++) {
    ctx.moveTo(at(0), at(k));
    ctx.lineTo(at(n - 1), at(k));
    ctx.moveTo(at(k), at(0));
    ctx.lineTo(at(k), at(n - 1));
  }
  ctx.stroke();
  const mid = (n - 1) / 2;
  const e = n >= 13 ? 3 : 2;
  const stars = n >= 9 ? [[e, e], [e, n - 1 - e], [n - 1 - e, e], [n - 1 - e, n - 1 - e], [mid, mid]] : [[mid, mid]];
  ctx.fillStyle = '#3a2a1c';
  for (const [r, c] of stars) {
    ctx.beginPath();
    ctx.arc(at(c), at(r), s / 70, 0, Math.PI * 2);
    ctx.fill();
  }
  const rad = step * 0.45;
  for (let i = 0; i < n * n; i++) {
    const v = g.b[i];
    if (v !== 'b' && v !== 'w') continue;
    const x = at(i % n);
    const y = at(Math.floor(i / n));
    const shine = ctx.createRadialGradient(x - rad * 0.35, y - rad * 0.35, rad * 0.1, x, y, rad);
    if (v === BLACK) shine.addColorStop(0, '#5d616b'), shine.addColorStop(1, '#141519');
    else shine.addColorStop(0, '#ffffff'), shine.addColorStop(1, '#cfcabd');
    ctx.fillStyle = shine;
    ctx.beginPath();
    ctx.arc(x, y, rad, 0, Math.PI * 2);
    ctx.fill();
    if (i === g.last) {
      ctx.strokeStyle = '#ff7fb2';
      ctx.lineWidth = s / 60;
      ctx.beginPath();
      ctx.arc(x, y, rad * 0.45, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
}
