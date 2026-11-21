// Sparkles drifting in the air over Toon Isle (render/cartoon.js), as in a
// storybook's sunny meadow: little twinkling motes of light all round the
// camera, floating slowly up and along, each fading in and out on its own
// time; warm white by day, firefly green-gold by night. Brighter than white,
// so they glow (renderer.js buildFinish).
import * as THREE from '../../vendor/three.module.js';

const COUNT = 260;
const DAY = new THREE.Color(2.6, 2.45, 1.9);
const FIREFLY = new THREE.Color(2.0, 2.8, 0.9);
// The box round the camera they float in (they come round again from its
// other side as the camera moves).
const BOX = new THREE.Vector3(44, 14, 44);

const VERT = /* glsl */ `
  uniform vec3 uCam;
  uniform vec3 uBox;
  uniform float uTime;
  uniform float uSize;
  attribute float seed;
  varying float vGlow;
  void main() {
    vec3 drift = vec3(0.013, 0.02, 0.009) * uTime * (0.6 + seed);
    vec3 p = fract(position + drift - uCam / uBox) - 0.5;
    vec3 world = uCam + p * uBox;
    world.x += 0.4 * sin(uTime * 0.7 + seed * 40.0);
    world.z += 0.4 * cos(uTime * 0.6 + seed * 30.0);
    vec4 mv = viewMatrix * vec4(world, 1.0);
    gl_Position = projectionMatrix * mv;
    // Fading in and out on its own time, and out towards the box's sides.
    float twinkle = pow(max(0.0, sin(uTime * (0.8 + seed) + seed * 50.0)), 3.0);
    float edge = 1.0 - smoothstep(0.32, 0.5, max(abs(p.x), max(abs(p.y), abs(p.z))));
    vGlow = twinkle * edge;
    gl_PointSize = uSize * (0.6 + 0.6 * seed) / max(1.0, -mv.z);
  }
`;

const FRAG = /* glsl */ `
  uniform vec3 uColor;
  varying float vGlow;
  void main() {
    vec2 d = gl_PointCoord - 0.5;
    float r = length(d);
    // A soft round glow with a little four-pointed star in it.
    float glow = exp(-r * r * 40.0);
    float star = max(0.0, 1.0 - abs(d.x) * 14.0) * max(0.0, 1.0 - abs(d.y) * 2.4) + max(0.0, 1.0 - abs(d.y) * 14.0) * max(0.0, 1.0 - abs(d.x) * 2.4);
    float a = (glow + star * 0.6) * vGlow;
    if (a < 0.01) discard;
    gl_FragColor = vec4(uColor * a, 1.0);
  }
`;

export class CartoonSparkles {
  constructor(seed = 1) {
    const pos = new Float32Array(COUNT * 3);
    const seeds = new Float32Array(COUNT);
    let s = (seed ^ 0x9e3779b9) >>> 0;
    const rand = () => {
      s = (Math.imul(s ^ (s >>> 15), 0x2c1b3c6d) + 0x6d2b79f5) >>> 0;
      return s / 4294967296;
    };
    for (let i = 0; i < COUNT; i++) {
      pos[i * 3] = rand();
      pos[i * 3 + 1] = rand();
      pos[i * 3 + 2] = rand();
      seeds[i] = rand();
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('seed', new THREE.BufferAttribute(seeds, 1));
    this.uniforms = {
      uCam: { value: new THREE.Vector3() },
      uBox: { value: BOX.clone() },
      uTime: { value: 0 },
      uSize: { value: 60 },
      uColor: { value: new THREE.Color(1.6, 1.5, 1.2) },
    };
    this.points = new THREE.Points(
      g,
      new THREE.ShaderMaterial({ uniforms: this.uniforms, vertexShader: VERT, fragmentShader: FRAG, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }),
    );
    this.points.frustumCulled = false;
    this.points.renderOrder = 5;
    this.points.name = 'cartoon sparkles';
  }

  // Each frame: round the camera, in the light of the time of day (by day a
  // few warm white glints, by night more of them, firefly green-gold).
  update(time, camera, env, height) {
    const u = this.uniforms;
    u.uTime.value = time;
    u.uCam.value.copy(camera.position);
    // (Sized by the picture's height, so they are as big on any screen.)
    u.uSize.value = height * 0.075;
    const night = Math.max(0, 1 - env.day * 1.4);
    u.uColor.value.copy(DAY).lerp(FIREFLY, night).multiplyScalar(0.7 + 0.5 * night);
  }

  dispose() {
    this.points.geometry.dispose();
    this.points.material.dispose();
  }
}
