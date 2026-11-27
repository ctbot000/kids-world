// Everyone on a page of the Storybook as paper cut-outs too (view.js): each
// avatar drawn on its own into a little picture (from straight in front, the
// way the page is seen, flat), and that picture stuck on the page instead of
// the avatar itself, with a white paper edge and a line of ink round it and
// its shadow on the page behind — so whoever plays looks just as they do
// anywhere, only cut out of a book. Drawn afresh a few times a second, as a
// flip-book is (book-game.js moves their poses on as often).
import * as THREE from '../../../vendor/three.module.js';

// The layer avatars are drawn on, alone; how much of the page round each one
// its picture takes in (metres: across, below its feet, over them), and how
// many pixels a metre.
export const CARD_LAYER = 6;
const SPAN = { w: 2.8, below: 0.45, above: 2.75 };
const PX = 110;

const VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

// The picture, with a white edge and an ink line round whatever is in it, and
// a soft shadow down and to the right; blink: how see-through it is.
const FRAG = /* glsl */ `
uniform sampler2D map;
uniform vec2 texel;
uniform float fade;
varying vec2 vUv;
float alphaAt(vec2 at) { return texture2D(map, at).a; }
void main() {
  vec4 c = texture2D(map, vUv);
  float inner = 0.0;
  float outer = 0.0;
  for (int i = 0; i < 16; i++) {
    float a = float(i) * 0.3926991;
    vec2 d = vec2(cos(a), sin(a)) * texel;
    inner = max(inner, alphaAt(vUv + d * 3.2));
    outer = max(outer, alphaAt(vUv + d * 8.5));
  }
  float shadow = alphaAt(vUv + vec2(-texel.x, texel.y) * 11.0);
  vec3 paper = vec3(1.0, 0.97, 0.9);
  vec3 ink = vec3(0.12, 0.09, 0.2);
  vec3 body = c.a > 0.001 ? c.rgb / c.a : vec3(0.0);
  vec4 col = vec4(0.0);
  // From the outside in: the shadow, the paper edge, the ink, the avatar.
  col = mix(col, vec4(0.1, 0.05, 0.2, 0.22), shadow * (1.0 - outer));
  col = mix(col, vec4(paper, 1.0), outer);
  col = mix(col, vec4(ink, 1.0), inner);
  col = mix(col, vec4(body, 1.0), smoothstep(0.35, 0.85, c.a));
  col.a *= fade;
  if (col.a < 0.01) discard;
  gl_FragColor = col;
}`;

export class AvatarCards {
  constructor(renderer) {
    this.r = renderer;
    this.cards = new Map();
    this.cam = new THREE.OrthographicCamera(-SPAN.w / 2, SPAN.w / 2, SPAN.above, -SPAN.below, 0.1, 40);
    this.cam.layers.set(CARD_LAYER);
    this.group = new THREE.Group();
    this.group.name = 'book-cards';
    renderer.scene.add(this.group);
    // The lights the avatars are drawn by, on their layer too.
    renderer.sun.layers.enable(CARD_LAYER);
    renderer.hemi.layers.enable(CARD_LAYER);
    this.clear = new THREE.Color();
  }

  // One avatar's card: its picture, and the cut-out it is stuck on.
  card(pid) {
    let c = this.cards.get(pid);
    if (c) return c;
    const w = Math.round(SPAN.w * PX);
    const h = Math.round((SPAN.above + SPAN.below) * PX);
    const rt = new THREE.WebGLRenderTarget(w, h, { samples: 4 });
    rt.texture.colorSpace = THREE.SRGBColorSpace;
    const mat = new THREE.ShaderMaterial({
      uniforms: { map: { value: rt.texture }, texel: { value: new THREE.Vector2(1 / w, 1 / h) }, fade: { value: 1 } },
      vertexShader: VERT,
      fragmentShader: FRAG,
      transparent: true,
      depthWrite: false,
    });
    const geo = new THREE.PlaneGeometry(SPAN.w, SPAN.above + SPAN.below);
    geo.translate(0, (SPAN.above - SPAN.below) / 2, 0);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.renderOrder = 15;
    this.group.add(mesh);
    c = { rt, mat, mesh, due: 0 };
    this.cards.set(pid, c);
    return c;
  }

  // Each frame: every avatar's card where it is, its picture drawn again when
  // it is due (every frame for none, so a pose shows at once: fresh).
  update(dt, { every = 1 / 15 } = {}) {
    const r = this.r;
    const gl = r.gl;
    const avatars = r.avatars;
    const now = performance.now() / 1000;
    for (const [pid, c] of this.cards) {
      if (avatars.has(pid)) continue;
      this.drop(pid, c);
    }
    const shown = [];
    for (const [pid, a] of avatars) {
      // Drawn only on its own layer, never by the camera on the page.
      a.root.traverse((o) => o.layers.set(CARD_LAYER));
      if (a.shadow) a.shadow.visible = false;
      const c = this.card(pid);
      const visible = a.root.visible;
      c.mesh.visible = visible;
      if (!visible) continue;
      const p = a.root.position;
      c.mesh.position.set(p.x, p.y, 0.02);
      // (A little bigger than the box they take up, as a picture book draws
      // its heroes, from their feet.)
      c.mesh.scale.setScalar(1.18);
      shown.push([pid, a, c]);
    }
    const due = shown.filter(([, , c]) => now >= c.due);
    if (!due.length) return;
    const target = gl.getRenderTarget();
    const alpha = gl.getClearAlpha();
    gl.getClearColor(this.clear);
    const autoClear = gl.autoClear;
    const shadows = gl.shadowMap.enabled;
    gl.shadowMap.enabled = false;
    gl.autoClear = true;
    gl.setClearColor(0x000000, 0);
    for (const [pid, a, c] of due) {
      c.due = now + every;
      // Alone in the picture: everyone else out of it a moment.
      for (const [other, b] of avatars) if (other !== pid) b.root.userData.wasVisible = b.root.visible;
      for (const [other, b] of avatars) if (other !== pid) b.root.visible = false;
      const p = a.root.position;
      this.cam.position.set(p.x, p.y, 20);
      this.cam.lookAt(p.x, p.y, 0);
      this.cam.updateMatrixWorld();
      gl.setRenderTarget(c.rt);
      gl.clear();
      gl.render(r.scene, this.cam);
      for (const [other, b] of avatars) if (other !== pid) b.root.visible = b.root.userData.wasVisible;
    }
    gl.setRenderTarget(target);
    gl.setClearColor(this.clear, alpha);
    gl.autoClear = autoClear;
    gl.shadowMap.enabled = shadows;
  }

  drop(pid, c) {
    this.group.remove(c.mesh);
    c.mesh.geometry.dispose();
    c.mat.dispose();
    c.rt.dispose();
    this.cards.delete(pid);
  }

  // Back to avatars drawn as anywhere else.
  dispose() {
    for (const [pid, c] of this.cards) this.drop(pid, c);
    for (const a of this.r.avatars.values()) a.root.traverse((o) => o.layers.set(0));
    this.r.sun.layers.disable(CARD_LAYER);
    this.r.hemi.layers.disable(CARD_LAYER);
    this.group.parent?.remove(this.group);
  }
}
