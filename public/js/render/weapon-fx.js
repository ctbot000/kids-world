// The shows of the mightiest toy weapons (shared/shop.js): the Thunder Spear's
// bolt leaping from monster to monster, the Rainbow Ray's beam, and the Meteor
// Staff's meteor falling out of the sky. Each is made for its moment and gone
// after it: update returns false once it is over (renderer.js bossFx).
import * as THREE from '../../vendor/three.module.js';
import { meteorRock } from './avatar.js';
import { WarnRing } from './boss-fx.js';

// A stretch of a bolt: a quad pushed out sideways across the way it goes,
// square to the camera, white at its middle and electric blue out to its edges.
const ZAP_VERT = /* glsl */ `
  attribute vec3 dir;
  attribute vec3 info; // side (-1 or 1), width, when it shows (seconds)
  varying float vSide;
  varying float vShown;
  uniform float uAge;
  void main() {
    vec3 across = normalize(cross(dir, cameraPosition - position));
    vec3 p = position + across * info.x * info.y * 0.5;
    vSide = info.x;
    vShown = step(info.z, uAge);
    gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
  }
`;
const ZAP_FRAG = /* glsl */ `
  varying float vSide;
  varying float vShown;
  uniform float uOn;
  void main() {
    if (vShown < 0.5) discard;
    float d = abs(vSide);
    float core = 1.0 - smoothstep(0.14, 0.34, d);
    float glow = pow(1.0 - d, 1.5);
    gl_FragColor = vec4(mix(vec3(0.16, 0.56, 1.0), vec3(1.0), core), max(core, glow * 0.8) * uOn);
    #include <colorspace_fragment>
  }
`;
// How bright a bolt is as it goes on: [seconds, brightness], flickering out.
const ZAP_STROKES = [[0, 1], [0.05, 0.45], [0.085, 1], [0.14, 0.4], [0.18, 0.85], [0.25, 0.3], [0.31, 0]];
// How much later each leap shows than the one before, and how often the bolt
// finds a new way there, which is the crackle of it (seconds).
const ZAP_LEAP = 0.04;
const ZAP_JUMP = 0.045;
const ZAP_WIDTH = 0.42;

// Points from a to b, split depth times, each middle nudged sideways by rough
// of the stretch's length.
function jagged(a, b, depth, rough) {
  let pts = [a, b];
  for (let d = 0; d < depth; d++) {
    const next = [pts[0]];
    for (let i = 1; i < pts.length; i++) {
      const p = pts[i - 1];
      const q = pts[i];
      const len = p.distanceTo(q);
      const mid = p.clone().lerp(q, 0.4 + Math.random() * 0.2);
      mid.x += (Math.random() - 0.5) * len * rough;
      mid.y += (Math.random() - 0.5) * len * rough;
      mid.z += (Math.random() - 0.5) * len * rough;
      next.push(mid, q);
    }
    pts = next;
  }
  return pts;
}

// A bolt of lightning through points ({ x, y, z } each, at least two), one leap
// after another. delay: seconds before its first leap shows.
export class ZapBolt {
  constructor(scene, points, delay = 0) {
    const at = points.map((p) => new THREE.Vector3(p.x, p.y, p.z));
    this.legs = [];
    let quads = 0;
    for (let i = 1; i < at.length; i++) {
      const depth = at[i - 1].distanceTo(at[i]) > 2.5 ? 4 : 3;
      this.legs.push({ a: at[i - 1], b: at[i], depth, start: delay + (i - 1) * ZAP_LEAP });
      quads += 2 ** depth;
    }
    this.age = 0;
    this.moved = 0;
    this.life = this.legs.at(-1).start + ZAP_STROKES.at(-1)[0];
    this.pos = new Float32Array(quads * 4 * 3);
    this.dir = new Float32Array(quads * 4 * 3);
    const info = new Float32Array(quads * 4 * 3);
    const index = new Uint32Array(quads * 6);
    let q = 0;
    for (const leg of this.legs) {
      for (let i = 0; i < 2 ** leg.depth; i++, q++) {
        for (let k = 0; k < 4; k++) info.set([k % 2 ? 1 : -1, ZAP_WIDTH, leg.start], (q * 4 + k) * 3);
        index.set([q * 4, q * 4 + 2, q * 4 + 1, q * 4 + 1, q * 4 + 2, q * 4 + 3], q * 6);
      }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    geometry.setAttribute('dir', new THREE.BufferAttribute(this.dir, 3));
    geometry.setAttribute('info', new THREE.BufferAttribute(info, 3));
    geometry.setIndex(new THREE.BufferAttribute(index, 1));
    this.mat = new THREE.ShaderMaterial({
      uniforms: { uAge: { value: 0 }, uOn: { value: 1 } },
      vertexShader: ZAP_VERT,
      fragmentShader: ZAP_FRAG,
      transparent: true,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    this.mesh = new THREE.Mesh(geometry, this.mat);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 6;
    scene.add(this.mesh);
    this.crackle();
  }

  // A new way there for every leap, the ends staying where they are.
  crackle() {
    let q = 0;
    for (const { a, b, depth } of this.legs) {
      const pts = jagged(a, b, depth, 0.42);
      for (let i = 1; i < pts.length; i++, q++) {
        const p = pts[i - 1];
        const r = pts[i];
        for (let k = 0; k < 4; k++) {
          const end = k < 2 ? p : r;
          this.pos.set([end.x, end.y, end.z], (q * 4 + k) * 3);
          this.dir.set([r.x - p.x, r.y - p.y, r.z - p.z], (q * 4 + k) * 3);
        }
      }
    }
    this.mesh.geometry.attributes.position.needsUpdate = true;
    this.mesh.geometry.attributes.dir.needsUpdate = true;
  }

  update(dt) {
    this.age += dt;
    if (this.age >= this.life) {
      this.mesh.removeFromParent();
      this.mesh.geometry.dispose();
      this.mat.dispose();
      return false;
    }
    this.moved += dt;
    if (this.moved >= ZAP_JUMP) {
      this.moved = 0;
      this.crackle();
    }
    // Each leap flickers by itself, but they all go out together soon enough:
    // the brightness goes by the last to show.
    const t = Math.max(0, this.age - this.legs.at(-1).start);
    let on = ZAP_STROKES[0][1];
    for (const [when, v] of ZAP_STROKES) if (t >= when) on = v;
    this.mat.uniforms.uAge.value = this.age;
    this.mat.uniforms.uOn.value = on;
    return true;
  }
}

// The beam: a flat ribbon from uFrom to uTo, square to the camera, in bands of
// the rainbow across it with a white-hot middle, pulses of light running along
// it the way it goes. position.x: how far along it, 0 to 1; position.y: how
// far across it, -1 to 1.
const BEAM_VERT = /* glsl */ `
  uniform vec3 uFrom;
  uniform vec3 uTo;
  uniform float uWidth;
  varying vec2 vAt;
  void main() {
    vec3 p = mix(uFrom, uTo, position.x);
    vec3 across = normalize(cross(uTo - uFrom, cameraPosition - p));
    p += across * position.y * uWidth * 0.5 * mix(0.5, 1.0, position.x);
    vAt = position.xy;
    gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
  }
`;
const BEAM_FRAG = /* glsl */ `
  uniform float uOn;
  uniform float uAge;
  uniform float uLong;
  varying vec2 vAt;
  vec3 hue(float h) {
    vec3 k = abs(fract(vec3(h, h + 2.0 / 3.0, h + 1.0 / 3.0)) * 6.0 - 3.0) - 1.0;
    return clamp(k, 0.0, 1.0);
  }
  void main() {
    float d = abs(vAt.y);
    if (d >= 1.0) discard;
    // Red along one edge, round through the colours to violet along the other,
    // and rushing along it the way it goes.
    float run = 0.5 + 0.5 * sin(vAt.x * uLong * 5.0 - uAge * 80.0);
    vec3 band = pow(mix(vec3(1.0), hue((vAt.y * 0.5 + 0.5) * 0.78), 0.72 + 0.28 * run), vec3(2.2));
    float core = 1.0 - smoothstep(0.1, 0.42, d);
    float ends = smoothstep(0.0, 0.02, vAt.x) * (1.0 - smoothstep(0.93, 1.0, vAt.x));
    gl_FragColor = vec4(mix(band, vec3(1.0), core), (1.0 - smoothstep(0.7, 1.0, d)) * ends * uOn);
    #include <colorspace_fragment>
  }
`;
const BEAM_SECS = 0.42;
const BEAM_WIDTH = 0.8;

const beamShape = (() => {
  let g = null;
  return () => {
    if (!g) {
      g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute([0, -1, 0, 1, -1, 0, 0, 1, 0, 1, 1, 0], 3));
      g.setIndex([0, 1, 2, 2, 1, 3]);
    }
    return g;
  };
})();

// The Rainbow Ray's beam from `from` to `to` ({ x, y, z }): it bursts out wide
// at once, and thins away to nothing.
export class RainbowBeam {
  constructor(scene, from, to) {
    this.age = 0;
    const a = new THREE.Vector3(from.x, from.y, from.z);
    const b = new THREE.Vector3(to.x, to.y, to.z);
    this.mat = new THREE.ShaderMaterial({
      uniforms: { uFrom: { value: a }, uTo: { value: b }, uWidth: { value: 0 }, uOn: { value: 1 }, uAge: { value: 0 }, uLong: { value: a.distanceTo(b) } },
      vertexShader: BEAM_VERT,
      fragmentShader: BEAM_FRAG,
      transparent: true,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    this.mesh = new THREE.Mesh(beamShape(), this.mat);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 6;
    scene.add(this.mesh);
    this.update(0);
  }

  update(dt) {
    this.age += dt;
    const k = this.age / BEAM_SECS;
    if (k >= 1) {
      this.mesh.removeFromParent();
      this.mat.dispose();
      return false;
    }
    const u = this.mat.uniforms;
    u.uAge.value = this.age;
    u.uWidth.value = BEAM_WIDTH * Math.min(1, 0.35 + k * 9) * (k < 0.45 ? 1 : 1 - ((k - 0.45) / 0.55) ** 2);
    u.uOn.value = k < 0.6 ? 1 : 1 - (k - 0.6) / 0.4;
    return true;
  }
}

const METEOR_COLORS = ['#fff3a0', '#ffd84d', '#ff9a3d', '#ff5a1f', '#ff5a1f', '#6a5a52'];
// How many puffs of fire it leaves behind it a second.
const METEOR_TRAIL = 170;

// A meteor from `from` to `to` ([x, y, z] each), coming down in ms a little
// faster all the way, spinning, with a long tail of fire and a golden ring as wide as r on
// the ground where it will land. Its landing is the island's word (game.js
// blast).
export class Meteor {
  constructor(scene, effects, from, to, ms, r) {
    this.life = ms / 1000;
    this.age = 0;
    this.effects = effects;
    this.from = new THREE.Vector3(...from);
    this.to = new THREE.Vector3(...to);
    this.ring = new WarnRing(scene, to[0], to[1], to[2], r, ms, '#ffb13d');
    this.rock = meteorRock();
    this.rock.scale.setScalar(0.95);
    this.rock.position.copy(this.from);
    scene.add(this.rock);
    this.puffs = 0;
  }

  update(dt) {
    this.age += dt;
    const k = Math.min(1, this.age / this.life);
    const was = this.rock.position.clone();
    this.rock.position.lerpVectors(this.from, this.to, k * (0.8 + 0.2 * k));
    this.rock.rotation.x += dt * 5;
    this.rock.rotation.z += dt * 3;
    this.ring.update(dt);
    // Its tail: fire strewn back along where it just went.
    this.puffs += dt * METEOR_TRAIL;
    const n = Math.floor(this.puffs);
    this.puffs -= n;
    for (let i = 0; i < n; i++) {
      const at = was.clone().lerp(this.rock.position, Math.random());
      const color = METEOR_COLORS[Math.floor(Math.random() * METEOR_COLORS.length)];
      this.effects.add('puff', at.x + (Math.random() - 0.5) * 0.6, at.y + (Math.random() - 0.5) * 0.6, at.z + (Math.random() - 0.5) * 0.6, { vx: (Math.random() - 0.5) * 1.4, vy: 0.4 + Math.random(), vz: (Math.random() - 0.5) * 1.4, size: 0.8 + Math.random() * 0.8, grow: 1.5, life: 0.4 + Math.random() * 0.4, color });
    }
    if (k < 1) return true;
    this.rock.removeFromParent();
    this.ring.dispose();
    return false;
  }
}
