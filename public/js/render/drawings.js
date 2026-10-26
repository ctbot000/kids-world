// The pictures on the island's drawing boards (shared/drawing.js): each a
// little canvas laid over its board's white, lit like the blocks round it —
// by the sun in the open, by lamps at night — so it sits in the room like
// the rest of the board.
import * as THREE from '../../vendor/three.module.js';
import { COLORS, frameCorners, isFrame, PICTURE_H, PICTURE_W, pictureCorners } from '../shared/drawing.js';
import { LIGHT_GLSL } from './terrain.js';

// Each colour as its bytes, as written (sRGB: the shader decodes them, as it does the blocks').
const RGB = COLORS.map((c) => [1, 3, 5].map((i) => parseInt(c.hex.slice(i, i + 2), 16)));

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

export class Drawings {
  constructor(scene, terrain) {
    this.terrain = terrain;
    this.group = new THREE.Group();
    this.group.name = 'drawings';
    scene.add(this.group);
    // By cell key: { mesh, canvas, texture, x, y, z }.
    this.shown = new Map();
  }

  // The picture `px` on the board with block `id` at (x, y, z), new or drawn again.
  show(key, id, x, y, z, px) {
    let d = this.shown.get(key);
    if (!d) {
      const canvas = document.createElement('canvas');
      canvas.width = PICTURE_W;
      canvas.height = PICTURE_H;
      const texture = new THREE.CanvasTexture(canvas);
      texture.magFilter = THREE.NearestFilter;
      texture.generateMipmaps = false;
      texture.minFilter = THREE.LinearFilter;
      const material = new THREE.ShaderMaterial({
        uniforms: { ...this.terrain.uniforms, uMap: { value: texture }, uSky: { value: 1 }, uLamp: { value: 0 } },
        vertexShader: VERT,
        fragmentShader: FRAG,
      });
      const mesh = new THREE.Mesh(new THREE.BufferGeometry(), material);
      mesh.name = `drawing ${key}`;
      d = { mesh, canvas, texture, id: -1 };
      this.shown.set(key, d);
      this.group.add(mesh);
    }
    if (d.id !== id) {
      // The quad over the board's or the frame's white, facing out the way it does.
      const corners = isFrame(id) ? frameCorners : pictureCorners;
      const [bl, br, tr, tl] = corners(id, x, y, z);
      const g = d.mesh.geometry;
      g.setAttribute('position', new THREE.Float32BufferAttribute([...bl, ...br, ...tr, ...bl, ...tr, ...tl], 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1], 2));
      g.computeBoundingSphere();
      d.id = id;
    }
    Object.assign(d, { x, y, z });
    paint(d.canvas, px);
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

// A picture's dots onto a canvas of its size, top row first.
export function paint(canvas, px) {
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(PICTURE_W, PICTURE_H);
  for (let i = 0; i < px.length; i++) {
    const c = RGB[px[i]] ?? RGB[0];
    img.data[i * 4] = c[0];
    img.data[i * 4 + 1] = c[1];
    img.data[i * 4 + 2] = c[2];
    img.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
}
