// What shows of the blows of the Land of Nod (shared/nod/attacks.js), on ground of
// any shape: the lane one will come along, lying on the ground as it curves;
// things thrown, keeping low over it; beams; the burst of someone's courage; and
// the winks, hanging over the ground till they are found.
import * as THREE from '../../../vendor/three.module.js';
import { painted, where } from './kit.js';

const LANE_VERT = /* glsl */ `
  attribute vec2 st;
  varying vec2 vSt;
  void main() {
    vSt = st;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;
const LANE_FRAG = /* glsl */ `
  uniform vec3 uColor;
  uniform float uK;
  uniform float uLen;
  uniform float uTime;
  uniform float uBonk;
  varying vec2 vSt;
  void main() {
    float across = abs(vSt.x);
    float along = vSt.y * uLen;
    float edge = (1.0 - smoothstep(0.86, 1.0, across)) * smoothstep(0.0, 0.25, along) * (1.0 - smoothstep(uLen - 0.25, uLen, along));
    float rim = smoothstep(0.72, 0.9, across);
    // Arrows running along it, quicker as it comes.
    float a = fract((along + across * 0.8) * 0.55 - uTime * (1.2 + uK * 2.2));
    float arrow = smoothstep(0.5, 0.62, a) * (1.0 - smoothstep(0.86, 1.0, a)) * (1.0 - rim);
    float fill = step(vSt.y, uK) * 0.4;
    float end = uBonk * (1.0 - smoothstep(0.0, 1.2, uLen - along));
    vec3 col = mix(uColor, vec3(1.0, 0.95, 0.5), end);
    float alpha = clamp(edge * (0.2 + rim * 0.6 + arrow * 0.4 + fill + end * 0.4), 0.0, 0.94);
    gl_FragColor = vec4(col * (1.0 + rim * 0.5 + end * 0.5), alpha);
  }
`;

// A lane about to be come along: path (shape.js walk), w wide either way. bonk:
// it ends at something solid.
export class LaneMark {
  constructor(scene, path, w, length, { color = '#ff4f6d', bonk = false } = {}) {
    const n = path.length;
    const pos = new Float32Array(n * 6);
    const st = new Float32Array(n * 4);
    const index = [];
    for (let i = 0; i < n; i++) {
      const q = path[i];
      const rx = q.up.y * q.dir.z - q.up.z * q.dir.y;
      const ry = q.up.z * q.dir.x - q.up.x * q.dir.z;
      const rz = q.up.x * q.dir.y - q.up.y * q.dir.x;
      const l = 0.09;
      pos.set([q.x + q.up.x * l + rx * w, q.y + q.up.y * l + ry * w, q.z + q.up.z * l + rz * w, q.x + q.up.x * l - rx * w, q.y + q.up.y * l - ry * w, q.z + q.up.z * l - rz * w], i * 6);
      st.set([1, i / (n - 1), -1, i / (n - 1)], i * 4);
      if (i) index.push(i * 2 - 2, i * 2 - 1, i * 2, i * 2 - 1, i * 2 + 1, i * 2);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('st', new THREE.BufferAttribute(st, 2));
    g.setIndex(index);
    this.mat = new THREE.ShaderMaterial({
      uniforms: { uColor: { value: new THREE.Color(color) }, uK: { value: 0 }, uLen: { value: length }, uTime: { value: 0 }, uBonk: { value: bonk ? 1 : 0 } },
      vertexShader: LANE_VERT,
      fragmentShader: LANE_FRAG,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    });
    this.mesh = new THREE.Mesh(g, this.mat);
    this.mesh.renderOrder = 2;
    scene.add(this.mesh);
  }

  update(k, time) {
    this.mat.uniforms.uK.value = Math.max(0, Math.min(1, k));
    this.mat.uniforms.uTime.value = time;
  }

  dispose() {
    this.mesh.removeFromParent();
    this.mesh.geometry.dispose();
    this.mat.dispose();
  }
}

// Something thrown: a ball of dust, a seed, a note, a cog, a drop of the dark.
const THROWN = {
  dust: () => painted([[new THREE.IcosahedronGeometry(0.34, 2), '#cdbff0', where()], ...[0, 1, 2, 3, 4, 5].map((i) => [new THREE.IcosahedronGeometry(0.17, 1), i % 2 ? '#e6dcff' : '#b3a3e0', where(Math.cos(i * 1.9) * 0.26, Math.sin(i * 2.7) * 0.26, Math.sin(i * 1.3) * 0.26)])]),
  seed: () => painted([[new THREE.IcosahedronGeometry(0.3, 2), '#a5d65a', where(0, 0, 0, [0.8, 0.8, 1.25])], [new THREE.ConeGeometry(0.1, 0.3, 8), '#5f8f2f', where(0, 0, -0.42, 1, -Math.PI / 2)]]),
  note: () => painted([[new THREE.IcosahedronGeometry(0.26, 2), '#ffd75e', where(0, -0.16, 0, [1.2, 0.9, 0.9], 0, 0, 0.4)], [new THREE.CylinderGeometry(0.045, 0.045, 0.8, 8), '#ffd75e', where(0.24, 0.24, 0)], [new THREE.SphereGeometry(0.16, 10, 8), '#ffb52e', where(0.36, 0.5, 0, [1.2, 0.6, 0.5], 0, 0, -0.5)]]),
  cog: () => painted([[new THREE.CylinderGeometry(0.3, 0.3, 0.16, 20), '#e0b060', where()], ...[0, 1, 2, 3, 4, 5, 6, 7].map((i) => [new THREE.BoxGeometry(0.14, 0.15, 0.16), '#c9923e', where(Math.cos(i * 0.785) * 0.34, 0, Math.sin(i * 0.785) * 0.34, 1, 0, -i * 0.785, 0)])]),
  dark: () => painted([[new THREE.IcosahedronGeometry(0.36, 2), '#3a1f66', where()], [new THREE.IcosahedronGeometry(0.2, 1), '#c05cff', where(0.1, 0.1, 0.2)]]),
};
const shotMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.5, emissive: '#ffffff', emissiveIntensity: 0.35 });
shotMat.onBeforeCompile = (s) => {
  // (Its own colours glow.)
  s.fragmentShader = s.fragmentShader.replace('#include <emissivemap_fragment>', 'totalEmissiveRadiance *= diffuseColor.rgb * 2.2;');
};

export class Shot {
  constructor(scene, look = 'dust', r = 0.42) {
    this.mesh = new THREE.Mesh((THROWN[look] ?? THROWN.dust)(), shotMat);
    this.mesh.scale.setScalar(r / 0.36);
    this.mesh.castShadow = true;
    scene.add(this.mesh);
    this.spin = 4 + Math.random() * 4;
  }

  put(p, dt) {
    this.mesh.position.set(p.x, p.y, p.z);
    this.mesh.rotation.x += dt * this.spin;
    this.mesh.rotation.y += dt * this.spin * 0.7;
  }

  dispose() {
    this.mesh.removeFromParent();
    this.mesh.geometry.dispose();
  }
}

// A beam lying over the ground, along a path that moves.
const BEAM_FRAG = /* glsl */ `
  uniform vec3 uColor;
  uniform float uTime;
  uniform float uOn;
  varying vec2 vSt;
  void main() {
    float d = abs(vSt.x);
    float core = exp(-d * d * 14.0);
    float glow = exp(-d * 3.0) * (1.0 - d);
    float run = 0.8 + 0.2 * sin(vSt.y * 40.0 - uTime * 24.0);
    vec3 col = mix(uColor, vec3(1.0), core * 0.7) * (core * 2.0 + glow * 0.9) * run;
    gl_FragColor = vec4(col * uOn, 1.0);
  }
`;

export class Beam {
  constructor(scene, w, { color = '#ff5c8a', points = 16 } = {}) {
    this.n = points;
    this.w = w;
    const g = new THREE.BufferGeometry();
    this.pos = new THREE.BufferAttribute(new Float32Array(points * 12), 3);
    this.pos.setUsage(THREE.DynamicDrawUsage);
    const st = new Float32Array(points * 8);
    const index = [];
    for (let k = 0; k < 2; k++) {
      for (let i = 0; i < points; i++) {
        const v = (k * points + i) * 2;
        st.set([1, i / (points - 1), -1, i / (points - 1)], v * 2);
        if (i) index.push(v - 2, v - 1, v, v - 1, v + 1, v);
      }
    }
    g.setAttribute('position', this.pos);
    g.setAttribute('st', new THREE.BufferAttribute(st, 2));
    g.setIndex(index);
    this.mat = new THREE.ShaderMaterial({ uniforms: { uColor: { value: new THREE.Color(color) }, uTime: { value: 0 }, uOn: { value: 1 } }, vertexShader: LANE_VERT, fragmentShader: BEAM_FRAG, transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending });
    this.mesh = new THREE.Mesh(g, this.mat);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 4;
    scene.add(this.mesh);
  }

  // Along a path, high over the ground it lies; on: how bright.
  lay(path, high, time, on = 1) {
    const a = this.pos.array;
    const { n, w } = this;
    for (let i = 0; i < n; i++) {
      const q = path[Math.min(path.length - 1, Math.round((i / (n - 1)) * (path.length - 1)))];
      const x = q.x + q.up.x * high;
      const y = q.y + q.up.y * high;
      const z = q.z + q.up.z * high;
      const rx = (q.up.y * q.dir.z - q.up.z * q.dir.y) * w;
      const ry = (q.up.z * q.dir.x - q.up.x * q.dir.z) * w;
      const rz = (q.up.x * q.dir.y - q.up.y * q.dir.x) * w;
      a.set([x + rx, y + ry, z + rz, x - rx, y - ry, z - rz], i * 6);
      a.set([x + q.up.x * w, y + q.up.y * w, z + q.up.z * w, x - q.up.x * w, y - q.up.y * w, z - q.up.z * w], (n + i) * 6);
    }
    this.pos.needsUpdate = true;
    this.mat.uniforms.uTime.value = time;
    this.mat.uniforms.uOn.value = on;
  }

  dispose() {
    this.mesh.removeFromParent();
    this.mesh.geometry.dispose();
    this.mat.dispose();
  }
}

// A burst of courage: a bubble of light blown out from someone.
export class BurstDome {
  constructor(scene, p, r, color = '#ffe27a', ms = 620) {
    this.mat = new THREE.ShaderMaterial({
      uniforms: { uColor: { value: new THREE.Color(color) }, uA: { value: 1 } },
      vertexShader: 'varying vec3 vN; varying vec3 vV; void main() { vec4 mv = modelViewMatrix * vec4(position, 1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }',
      fragmentShader: 'uniform vec3 uColor; uniform float uA; varying vec3 vN; varying vec3 vV; void main() { float f = 1.0 - min(1.0, abs(dot(vN, vV))); f *= f; gl_FragColor = vec4(uColor * (0.5 + f * 2.2), (0.08 + f * 0.8) * uA); }',
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
    });
    this.mesh = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 4), this.mat);
    this.mesh.position.set(p.x, p.y, p.z);
    scene.add(this.mesh);
    this.r = r;
    this.ms = ms;
    this.t = 0;
  }

  update(dt) {
    this.t += (dt * 1000) / this.ms;
    const k = 1 - (1 - Math.min(1, this.t)) ** 3;
    this.mesh.scale.setScalar(0.2 + this.r * k);
    this.mat.uniforms.uA.value = 1 - Math.min(1, this.t) ** 2;
    if (this.t < 1) return true;
    this.dispose();
    return false;
  }

  dispose() {
    this.mesh.removeFromParent();
    this.mesh.geometry.dispose();
    this.mat.dispose();
  }
}

// The winks of a dream: little stars that wink, till they are found.
export class Winks {
  constructor(list, taken) {
    this.list = list;
    const s = new THREE.Shape();
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + Math.PI / 2;
      const r = i % 2 ? 0.13 : 0.34;
      if (i) s.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      else s.moveTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    const g = new THREE.ExtrudeGeometry(s, { depth: 0.07, bevelEnabled: true, bevelSize: 0.03, bevelThickness: 0.03, bevelSegments: 2 });
    g.translate(0, 0, -0.035);
    this.mesh = new THREE.InstancedMesh(g, new THREE.MeshStandardMaterial({ color: '#ffe27a', emissive: '#ffc23d', emissiveIntensity: 1.5, roughness: 0.3 }), list.length);
    this.mesh.frustumCulled = false;
    this.gone = new Set(taken);
    this.m = new THREE.Matrix4();
    this.q = new THREE.Quaternion();
    this.r = new THREE.Quaternion();
    this.up = new THREE.Vector3();
    this.p = new THREE.Vector3();
    this.s = new THREE.Vector3();
  }

  update(time) {
    this.list.forEach((w, i) => {
      const on = !this.gone.has(i);
      this.up.set(w.up.x, w.up.y, w.up.z);
      this.q.setFromUnitVectors(Y, this.up).multiply(this.r.setFromAxisAngle(Y, time * 1.6 + i));
      const bob = Math.sin(time * 2 + i * 1.7) * 0.12;
      this.p.set(w.x + w.up.x * bob, w.y + w.up.y * bob, w.z + w.up.z * bob);
      // Now and then it winks: shut, and open again.
      const wink = Math.max(0, 1 - Math.abs(((time * 0.6 + i * 0.37) % 3) - 1.5) * 9);
      this.s.set(on ? 1 : 0, on ? 1 - wink * 0.85 : 0, on ? 1 : 0);
      this.mesh.setMatrixAt(i, this.m.compose(this.p, this.q, this.s));
    });
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  dispose() {
    this.mesh.removeFromParent();
    this.mesh.geometry.dispose();
    this.mesh.material.dispose();
    this.mesh.dispose();
  }
}
const Y = new THREE.Vector3(0, 1, 0);
