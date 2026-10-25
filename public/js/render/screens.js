// What the computers on an island show, where its keeper says (shared/
// screens.js): each a little canvas laid over its computer's screen, a code
// editor's dark page with whose screen it is, their task, what they are
// doing and their last few steps, glowing as the screen does.
import * as THREE from '../../vendor/three.module.js';
import { furniturePoint } from '../shared/furniture.js';
import { LIGHT_GLSL } from './terrain.js';

const W = 512;
const H = 332;
// The screen's glass in the computer's own layout (shared/furniture.js
// computer), facing -z, just in front of the lines drawn on it.
const GLASS = { x0: 0.1, x1: 0.9, y0: 0.26, y1: 0.78, z: 0.6 };

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

// It glows: no light or shade on it, only the fog.
const FRAG = /* glsl */ `
  uniform sampler2D uMap;
  varying vec2 vUv;
  varying float vDepth;
  ${LIGHT_GLSL}
  void main() {
    nearFade(vDepth);
    vec3 col = decode(texture2D(uMap, vUv).rgb);
    gl_FragColor = vec4(fogged(col, vDepth), 1.0);
    #include <colorspace_fragment>
  }
`;

export class Screens {
  constructor(scene, terrain) {
    this.terrain = terrain;
    this.group = new THREE.Group();
    this.group.name = 'screens';
    scene.add(this.group);
    // By cell key: { mesh, canvas, texture, drawn }.
    this.shown = new Map();
  }

  // Screen `s` (as cleanScreens makes them) on the computer `id` in its cell.
  show(key, s, id) {
    let d = this.shown.get(key);
    if (!d || d.id !== id) {
      if (d) this.remove(key);
      const canvas = document.createElement('canvas');
      canvas.width = W;
      canvas.height = H;
      const texture = new THREE.CanvasTexture(canvas);
      texture.anisotropy = 4;
      const material = new THREE.ShaderMaterial({
        uniforms: { ...this.terrain.uniforms, uMap: { value: texture } },
        vertexShader: VERT,
        fragmentShader: FRAG,
      });
      // Seen from in front (-z in the layout), its left is the layout's +x.
      const { x0, x1, y0, y1, z } = GLASS;
      const at = (px, py) => furniturePoint(id, s.x, s.y, s.z, px, py, z);
      const [bl, br, tr, tl] = [at(x1, y0), at(x0, y0), at(x0, y1), at(x1, y1)];
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.Float32BufferAttribute([...bl, ...br, ...tr, ...bl, ...tr, ...tl], 3));
      geometry.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1], 2));
      geometry.computeBoundingSphere();
      const mesh = new THREE.Mesh(geometry, material);
      mesh.name = `screen ${key}`;
      d = { id, mesh, canvas, texture, drawn: '' };
      this.shown.set(key, d);
      this.group.add(mesh);
    }
    const k = JSON.stringify(s);
    if (d.drawn === k) return;
    d.drawn = k;
    paintScreen(d.canvas, s);
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
}

// The colour of a step's line, by the tool it took.
export const TOOL_COLORS = { list: '#7cc4ff', read: '#7cc4ff', search: '#c3a6ff', write: '#9be38a', edit: '#9be38a', test: '#ffd166', diff: '#f78fb3', done: '#5fe08a', give_up: '#ff8a7a' };

// Text cut to fit `width` on the canvas, with an ellipsis.
function fit(ctx, text, width) {
  if (ctx.measureText(text).width <= width) return text;
  const chars = [...text];
  while (chars.length && ctx.measureText(`${chars.join('')}…`).width > width) chars.pop();
  return `${chars.join('')}…`;
}

// A screen onto a canvas: a title bar with whose it is, the task, what they
// are doing now, and their last steps, newest at the bottom.
export function paintScreen(canvas, s) {
  const ctx = canvas.getContext('2d');
  const [w, h] = [canvas.width, canvas.height];
  const pad = 16;
  ctx.fillStyle = '#1f2a3d';
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#2f3d56';
  ctx.fillRect(0, 0, w, 40);
  for (const [i, c] of ['#ff6b6b', '#ffd166', '#5fe08a'].entries()) {
    ctx.fillStyle = c;
    ctx.beginPath();
    ctx.arc(pad + 6 + i * 20, 20, 6, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#e9eef6';
  ctx.font = 'bold 20px system-ui, sans-serif';
  ctx.fillText(fit(ctx, s.name, w - 100 - pad), 84, 21);
  let y = 66;
  if (!s.issue) {
    ctx.fillStyle = '#9fb0c8';
    ctx.font = '22px system-ui, sans-serif';
    ctx.fillText(fit(ctx, s.doing || 'At their desk', w - pad * 2), pad, y);
    ctx.fillStyle = '#7cc4ff';
    ctx.font = '18px ui-monospace, Menlo, monospace';
    ctx.fillText('Waiting for the next task…', pad, y + 36);
    return;
  }
  ctx.fillStyle = '#ffd166';
  ctx.font = 'bold 22px system-ui, sans-serif';
  ctx.fillText(fit(ctx, `#${s.issue.n} ${s.issue.title}`, w - pad * 2), pad, y);
  y += 34;
  ctx.fillStyle = '#e9eef6';
  ctx.font = '19px system-ui, sans-serif';
  ctx.fillText(fit(ctx, `▶ ${s.doing.replace(/^#\d+: /, '')}`, w - pad * 2), pad, y);
  y += 22;
  ctx.fillStyle = '#3a4a66';
  ctx.fillRect(pad, y, w - pad * 2, 2);
  y += 22;
  ctx.font = '17px ui-monospace, Menlo, monospace';
  const lines = s.steps.slice(-7);
  for (const t of lines) {
    ctx.fillStyle = '#6b7c96';
    ctx.fillText(String(t.n).padStart(3, ' '), pad, y);
    ctx.fillStyle = TOOL_COLORS[t.tool] ?? '#e9eef6';
    ctx.fillText(fit(ctx, t.what, w - pad * 2 - 48), pad + 44, y);
    y += 27;
  }
}
