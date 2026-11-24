// Motes of light drifting in the air of the Land of Nod, all round the camera,
// up and down and every way, each twinkling on its own time (brighter than
// white, so they glow: renderer.js buildFinish).
import * as THREE from '../../../vendor/three.module.js';

const COUNT = 300;
const BOX = 46;

const VERT = /* glsl */ `
  uniform vec3 uCam;
  uniform float uTime;
  uniform float uSize;
  attribute float seed;
  varying float vGlow;
  varying float vSeed;
  void main() {
    vec3 drift = vec3(sin(seed * 60.0), cos(seed * 45.0), sin(seed * 80.0)) * 0.008 * uTime;
    vec3 p = fract(position + drift - uCam / ${BOX}.0) - 0.5;
    vec3 w = uCam + p * ${BOX}.0;
    w += 0.4 * vec3(sin(uTime * 0.7 + seed * 40.0), sin(uTime * 0.5 + seed * 70.0), cos(uTime * 0.6 + seed * 30.0));
    vec4 mv = viewMatrix * vec4(w, 1.0);
    gl_Position = projectionMatrix * mv;
    float twinkle = pow(max(0.0, sin(uTime * (0.6 + seed) + seed * 50.0)), 3.0);
    float edge = 1.0 - smoothstep(0.32, 0.5, length(p));
    vGlow = twinkle * edge;
    vSeed = seed;
    gl_PointSize = uSize * (0.5 + 0.7 * seed) / max(1.0, -mv.z);
  }
`;

const FRAG = /* glsl */ `
  uniform vec3 uA;
  uniform vec3 uB;
  varying float vGlow;
  varying float vSeed;
  void main() {
    vec2 d = gl_PointCoord - 0.5;
    float r = length(d);
    float a = (exp(-r * r * 38.0) + exp(-r * r * 260.0)) * vGlow;
    if (a < 0.01) discard;
    gl_FragColor = vec4(mix(uA, uB, step(0.5, vSeed)) * a * 1.7, 1.0);
  }
`;

export class Motes {
  constructor([a, b] = ['#fff3c8', '#ffd6e8']) {
    const pos = new Float32Array(COUNT * 3);
    const seeds = new Float32Array(COUNT);
    let s = 0x9e3779b9;
    const rand = () => {
      s = (Math.imul(s ^ (s >>> 15), 0x2c1b3c6d) + 0x6d2b79f5) >>> 0;
      return s / 4294967296;
    };
    for (let i = 0; i < COUNT; i++) {
      pos.set([rand(), rand(), rand()], i * 3);
      seeds[i] = rand();
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('seed', new THREE.BufferAttribute(seeds, 1));
    this.uniforms = { uCam: { value: new THREE.Vector3() }, uTime: { value: 0 }, uSize: { value: 60 }, uA: { value: new THREE.Color(a) }, uB: { value: new THREE.Color(b) } };
    this.points = new THREE.Points(g, new THREE.ShaderMaterial({ uniforms: this.uniforms, vertexShader: VERT, fragmentShader: FRAG, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    this.points.frustumCulled = false;
  }

  update(time, camera, height) {
    this.uniforms.uTime.value = time;
    if (camera) this.uniforms.uCam.value.copy(camera.position);
    this.uniforms.uSize.value = height * 0.075;
  }

  dispose() {
    this.points.removeFromParent();
    this.points.geometry.dispose();
    this.points.material.dispose();
  }
}
