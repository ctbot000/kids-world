// The skies of the Land of Nod (render/nod/view.js): all the way round, above
// and below, as there is no ground down there but that of the bodies hanging in
// it. Each dream's own colours, with soft clouds of light folded through them,
// stars that twinkle, and something big and round shining a long way off.
import * as THREE from '../../../vendor/three.module.js';
import { NOISE } from './skins.js';

const VERT = /* glsl */ `
  varying vec3 vDir;
  void main() {
    vDir = position;
    vec4 p = projectionMatrix * vec4(mat3(viewMatrix) * position, 1.0);
    gl_Position = p.xyww;
  }
`;

const FRAG = /* glsl */ `
  ${NOISE}
  uniform vec3 uTop;
  uniform vec3 uMid;
  uniform vec3 uLow;
  uniform vec3 uFoldA;
  uniform vec3 uFoldB;
  uniform float uFold;
  uniform float uStars;
  uniform float uPuffs;
  uniform vec3 uPuffLit;
  uniform vec3 uPuffShade;
  uniform vec3 uOrbDir;
  uniform vec3 uOrbColor;
  uniform float uOrbSize;
  uniform float uOrbKind;
  uniform float uTime;
  uniform float uDim;
  varying vec3 vDir;
  // Stars: one in some of the cells of a grid over the sky, each its own size
  // and time to twinkle.
  vec3 stars(vec3 dir, float scale, float share) {
    vec3 a = abs(dir);
    vec3 q = dir / max(a.x, max(a.y, a.z));
    vec3 g = q * scale;
    vec3 id = floor(g + 0.5);
    float h = nHash(id);
    if (h > share) return vec3(0.0);
    vec3 off = (vec3(nHash(id + 1.7), nHash(id + 5.1), nHash(id + 9.3)) - 0.5) * 0.6;
    float d = length(g - id - off);
    float size = 0.05 + 0.12 * nHash(id + 3.3);
    float tw = 0.65 + 0.35 * sin(uTime * (0.6 + 2.0 * nHash(id + 8.8)) + h * 900.0);
    float core = smoothstep(size, 0.0, d);
    vec3 tint = mix(vec3(1.0, 0.9, 0.75), vec3(0.75, 0.88, 1.0), nHash(id + 2.2));
    return tint * core * core * tw * (0.6 + 2.2 * nHash(id + 4.4));
  }
  void main() {
    vec3 dir = normalize(vDir);
    float t = dir.y;
    vec3 col = mix(uMid, uTop, smoothstep(0.0, 0.9, t));
    col = mix(col, uLow, smoothstep(0.0, -0.9, t));
    // Folds of light, like cloth hung in the dark.
    vec3 q = dir * 1.7 + vec3(0.0, uTime * 0.004, 0.0);
    vec3 warp = vec3(nFbm(q + 3.1), nFbm(q + 7.7), nFbm(q + 11.9));
    float f = nFbm(q * 1.1 + warp * 1.6);
    float g = nFbm(q * 2.3 - warp * 1.2 + 21.0);
    col += uFoldA * smoothstep(0.42, 0.85, f) * uFold;
    col += uFoldB * smoothstep(0.45, 0.8, g) * smoothstep(0.3, 0.7, f) * uFold;
    if (uStars > 0.0) {
      vec3 s = stars(dir, 46.0, 0.22) + stars(dir + 0.13, 90.0, 0.2) * 0.7 + stars(dir + 0.37, 22.0, 0.1) * 1.6;
      col += s * uStars * (0.35 + 0.65 * smoothstep(0.25, 0.75, nFbm(q * 1.3 + 5.0)));
    }
    // What shines a long way off: a moon (its face shaded), or a sun (its glow).
    float c = dot(dir, uOrbDir);
    float ang = acos(clamp(c, -1.0, 1.0));
    float k = ang / uOrbSize;
    if (uOrbKind > 0.5) {
      col += uOrbColor * (exp(-k * 0.9) * 0.5 + exp(-k * 0.22) * 0.14);
      if (uOrbKind < 1.5 && k < 1.0) {
        vec3 e1 = normalize(cross(uOrbDir, vec3(0.0, 1.0, 0.01)));
        vec3 e2 = cross(uOrbDir, e1);
        vec2 m = vec2(dot(dir, e1), dot(dir, e2)) / sin(uOrbSize);
        float h = sqrt(max(0.0, 1.0 - dot(m, m)));
        vec3 n = vec3(m, h);
        float lit = clamp(dot(n, normalize(vec3(-0.5, 0.35, 0.75))) * 1.25, 0.0, 1.0);
        float sea = smoothstep(0.45, 0.6, nFbm(n * 2.4 + 4.0));
        vec3 face = uOrbColor * (0.92 - 0.2 * sea) * (0.35 + 0.85 * lit);
        col = mix(col, face, smoothstep(1.0, 0.965, k));
      } else if (uOrbKind > 1.5) {
        col = mix(col, uOrbColor * 1.5, smoothstep(1.0, 0.55, k) * 0.9);
      }
    }
    // Puffy clouds, lit from the side it shines on.
    if (uPuffs > 0.0) {
      vec3 p = dir * vec3(2.2, 4.2, 2.2) + vec3(uTime * 0.006, 0.0, uTime * 0.004);
      float n = nFbm(p + nFbm(p * 1.7) * 0.9);
      float cover = mix(0.66, 0.42, uPuffs);
      float a = smoothstep(cover, cover + 0.1, n);
      float toward = nFbm(p + uOrbDir * 0.16 + nFbm(p * 1.7 + uOrbDir * 0.2) * 0.9);
      float lit = clamp(0.5 + (n - toward) * 4.5, 0.0, 1.0);
      vec3 cloud = mix(uPuffShade, uPuffLit, lit);
      col = mix(col, cloud, a * 0.92);
    }
    gl_FragColor = vec4(col * uDim, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

const C = (v) => new THREE.Color(v);

export class NodSky {
  constructor(mood) {
    const m = { top: '#1b1746', mid: '#4a3f8f', low: '#8a5f9f', foldA: '#3a2f7a', foldB: '#7a4f9a', fold: 1, stars: 1, puffs: 0, puffLit: '#ffffff', puffShade: '#b9c9e8', orb: { dir: [0.4, 0.35, -0.8], color: '#fff3d6', size: 0.16, kind: 1 }, ...mood };
    this.uniforms = {
      uTop: { value: C(m.top) },
      uMid: { value: C(m.mid) },
      uLow: { value: C(m.low) },
      uFoldA: { value: C(m.foldA) },
      uFoldB: { value: C(m.foldB) },
      uFold: { value: m.fold },
      uStars: { value: m.stars },
      uPuffs: { value: m.puffs },
      uPuffLit: { value: C(m.puffLit) },
      uPuffShade: { value: C(m.puffShade) },
      uOrbDir: { value: new THREE.Vector3(...m.orb.dir).normalize() },
      uOrbColor: { value: C(m.orb.color) },
      uOrbSize: { value: m.orb.size },
      uOrbKind: { value: m.orb.kind },
      uTime: { value: 0 },
      uDim: { value: 1 },
    };
    this.mesh = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 4), new THREE.ShaderMaterial({ uniforms: this.uniforms, vertexShader: VERT, fragmentShader: FRAG, side: THREE.BackSide, depthWrite: false, depthTest: true }));
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = -20;
  }

  update(time) {
    this.uniforms.uTime.value = time;
  }

  dispose() {
    this.mesh.removeFromParent();
    this.mesh.geometry.dispose();
    this.mesh.material.dispose();
  }
}
