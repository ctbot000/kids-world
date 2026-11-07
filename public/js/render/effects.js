// Little bursts that make things feel alive: puffs when blocks pop in or
// out, hearts for happy animals, sparkles, music notes, sleepy Zzz's and
// splashes. All drawn as camera-facing pictures from one small sheet.
import * as THREE from '../../vendor/three.module.js';
import { arrow } from './avatar.js';

const KINDS = ['puff', 'heart', 'sparkle', 'note', 'zzz', 'square', 'drop', 'star', 'bang', 'burst', 'streak'];
// Each picture is drawn on UNIT by UNIT, on a CELL by CELL part of the sheet:
// a blow's burst shows large for a moment, and should have a clean edge.
const UNIT = 64;
const CELL = 128;
const MAX = 900;
// The ones drawn over everything, a blow's own: your avatar stands between the
// camera and what you hit, and would hide them.
const MAX_OVER = 240;
// How far out the points and dips of a blow's burst go, all the way round.
const BURST = [31, 13, 26, 12, 30, 14, 23, 11, 31, 13, 27, 12, 30, 12, 24, 13, 29, 11, 26, 14];

function sheet() {
  const c = document.createElement('canvas');
  c.width = CELL * KINDS.length;
  c.height = CELL;
  const ctx = c.getContext('2d');
  const m = UNIT / 2;
  KINDS.forEach((kind, i) => {
    ctx.save();
    ctx.translate(i * CELL, 0);
    ctx.scale(CELL / UNIT, CELL / UNIT);
    switch (kind) {
      case 'puff': {
        const g = ctx.createRadialGradient(m, m, 2, m, m, 28);
        g.addColorStop(0, 'rgba(255,255,255,1)');
        g.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, UNIT, UNIT);
        break;
      }
      case 'heart':
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.moveTo(32, 54);
        ctx.bezierCurveTo(2, 34, 8, 8, 32, 20);
        ctx.bezierCurveTo(56, 8, 62, 34, 32, 54);
        ctx.fill();
        break;
      case 'sparkle':
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        for (let k = 0; k < 8; k++) {
          const r = k % 2 === 0 ? 28 : 7;
          const a = (k / 8) * Math.PI * 2 - Math.PI / 2;
          ctx.lineTo(m + Math.cos(a) * r, m + Math.sin(a) * r);
        }
        ctx.fill();
        break;
      case 'note':
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.ellipse(22, 46, 11, 8, -0.4, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillRect(30, 12, 5, 34);
        ctx.beginPath();
        ctx.moveTo(35, 12);
        ctx.quadraticCurveTo(52, 18, 48, 32);
        ctx.quadraticCurveTo(46, 24, 35, 22);
        ctx.fill();
        break;
      case 'zzz':
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 44px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('z', m, m + 2);
        break;
      case 'square':
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.roundRect(12, 12, 40, 40, 8);
        ctx.fill();
        ctx.fillStyle = 'rgba(0,0,0,0.18)';
        ctx.fillRect(12, 40, 40, 12);
        break;
      case 'drop':
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.moveTo(32, 8);
        ctx.quadraticCurveTo(52, 38, 32, 54);
        ctx.quadraticCurveTo(12, 38, 32, 8);
        ctx.fill();
        break;
      case 'star':
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        for (let k = 0; k < 10; k++) {
          const r = k % 2 === 0 ? 28 : 12;
          const a = (k / 10) * Math.PI * 2 - Math.PI / 2;
          ctx.lineTo(m + Math.cos(a) * r, m + Math.sin(a) * r);
        }
        ctx.fill();
        break;
      case 'bang':
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 50px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('!', m, m + 2);
        break;
      // The spiky star a comic draws round a blow.
      case 'burst':
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        BURST.forEach((r, k) => {
          const a = (k / BURST.length) * Math.PI * 2 - Math.PI / 2;
          ctx.lineTo(m + Math.cos(a) * r, m + Math.sin(a) * r);
        });
        ctx.fill();
        break;
      // A thin splinter, long from side to side (see turn, in add).
      case 'streak':
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.moveTo(1, m);
        ctx.lineTo(m + 12, m - 5);
        ctx.lineTo(63, m);
        ctx.lineTo(m + 12, m + 5);
        ctx.fill();
        break;
      default:
        break;
    }
    ctx.restore();
  });
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

const VERT = /* glsl */ `
  attribute vec3 center;
  attribute vec4 color;
  attribute vec3 info; // size, kind, how far it is turned
  varying vec2 vUv;
  varying vec4 vColor;
  uniform float uKinds;
  void main() {
    vec3 right = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
    vec3 up = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);
    float c = cos(info.z);
    float s = sin(info.z);
    vec3 p = center + (right * (position.x * c - position.y * s) + up * (position.x * s + position.y * c)) * info.x;
    gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
    vUv = vec2((uv.x + info.y) / uKinds, uv.y);
    vColor = color;
  }
`;

// A slash: a crescent of light along an arc, its head running from one end to
// the other: pointed and white-hot there, widest a little behind it and
// narrowing away to nothing along the outer edge, where the blade's tip goes.
const SLASH_VERT = /* glsl */ `
  attribute vec2 ts; // how far along the arc, and how far out (0 to 1)
  varying vec2 vTs;
  void main() {
    vTs = ts;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;
const SLASH_FRAG = /* glsl */ `
  uniform vec3 uColor;
  uniform float uHead;
  uniform float uTrail;
  varying vec2 vTs;
  void main() {
    float d = uHead - vTs.x;
    if (d < 0.0 || d > uTrail) discard;
    float t = d / uTrail;
    float wide = smoothstep(0.0, 0.12, t) * pow(1.0 - t, 1.3);
    float inner = 1.0 - wide;
    if (vTs.y < inner) discard;
    float across = (vTs.y - inner) / max(wide, 0.001);
    float hot = max(1.0 - smoothstep(0.0, 0.3, t), smoothstep(0.62, 0.95, across));
    gl_FragColor = vec4(mix(uColor, vec3(1.0), hot), smoothstep(0.0, 0.3, across) * (1.0 - t * t));
    #include <colorspace_fragment>
  }
`;
const SLASH_SECS = 0.26;
const SLASH_TRAIL = 0.55;
const SLASH_POOL = 8;
// Where a slash's arc goes (round from straight ahead, the way the swing goes).
const SLASH_FROM = -1.75;
const SLASH_TO = 1.75;
const SLASH_TO_UPRIGHT = 0.6;
// How long a slash takes to come round to straight ahead: it starts that long
// before the swing lands, so the blade is on the monster as the blow is.
export const slashLead = ({ upright = false, from = SLASH_FROM, to = upright ? SLASH_TO_UPRIGHT : SLASH_TO, secs = SLASH_SECS } = {}) => (((0 - from) / (to - from)) * secs) / (1 + SLASH_TRAIL);

const FRAG = /* glsl */ `
  uniform sampler2D map;
  varying vec2 vUv;
  varying vec4 vColor;
  void main() {
    vec4 t = texture2D(map, vUv);
    if (t.a * vColor.a < 0.02) discard;
    gl_FragColor = vec4(t.rgb * vColor.rgb, t.a * vColor.a);
    #include <colorspace_fragment>
  }
`;

// A batch of particles, drawn together: in the world (hidden by what stands in
// front of them), or over everything.
class Layer {
  constructor(scene, map, max, over) {
    this.list = [];
    this.max = max;
    const quad = new THREE.PlaneGeometry(1, 1);
    const g = new THREE.InstancedBufferGeometry();
    g.index = quad.index;
    g.setAttribute('position', quad.getAttribute('position'));
    g.setAttribute('uv', quad.getAttribute('uv'));
    this.center = new THREE.InstancedBufferAttribute(new Float32Array(max * 3), 3);
    this.color = new THREE.InstancedBufferAttribute(new Float32Array(max * 4), 4);
    this.info = new THREE.InstancedBufferAttribute(new Float32Array(max * 3), 3);
    for (const a of [this.center, this.color, this.info]) a.setUsage(THREE.DynamicDrawUsage);
    g.setAttribute('center', this.center);
    g.setAttribute('color', this.color);
    g.setAttribute('info', this.info);
    g.instanceCount = 0;
    this.geometry = g;
    const mat = new THREE.ShaderMaterial({
      uniforms: { map: { value: map }, uKinds: { value: KINDS.length } },
      vertexShader: VERT,
      fragmentShader: FRAG,
      transparent: true,
      depthWrite: false,
      depthTest: !over,
    });
    this.mesh = new THREE.Mesh(g, mat);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = over ? 6 : 5;
    scene.add(this.mesh);
  }

  update(dt) {
    let n = 0;
    const c = this.center.array;
    const col = this.color.array;
    const info = this.info.array;
    for (let i = 0; i < this.list.length; i++) {
      const p = this.list[i];
      p.age += dt;
      if (p.age >= p.life) continue;
      if (p.age < 0) {
        // Not showing yet: kept, and drawn nowhere.
        this.list[n] = p;
        c[n * 3] = p.x;
        c[n * 3 + 1] = p.y;
        c[n * 3 + 2] = p.z;
        col[n * 4 + 3] = 0;
        info[n * 3] = 0;
        info[n * 3 + 1] = p.k;
        info[n * 3 + 2] = 0;
        n++;
        continue;
      }
      p.vy -= p.gravity * dt;
      if (p.drag) {
        const k = Math.max(0, 1 - p.drag * dt);
        p.vx *= k;
        p.vy *= k;
        p.vz *= k;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
      p.size += p.grow * dt;
      p.turn += p.spin * dt;
      const fade = Math.min(1, (p.life - p.age) / Math.min(0.35, p.life * 0.5));
      c[n * 3] = p.x;
      c[n * 3 + 1] = p.y;
      c[n * 3 + 2] = p.z;
      col[n * 4] = p.r;
      col[n * 4 + 1] = p.g;
      col[n * 4 + 2] = p.b;
      col[n * 4 + 3] = fade;
      info[n * 3] = Math.max(0, p.size);
      info[n * 3 + 1] = p.k;
      info[n * 3 + 2] = p.turn;
      this.list[n] = p;
      n++;
    }
    this.list.length = n;
    this.geometry.instanceCount = n;
    this.center.needsUpdate = true;
    this.color.needsUpdate = true;
    this.info.needsUpdate = true;
  }
}

export class Effects {
  constructor(scene, camera) {
    this.camera = camera;
    const map = sheet();
    this.world = new Layer(scene, map, MAX, false);
    this.over = new Layer(scene, map, MAX_OVER, true);
    this.tmp = new THREE.Color();
    this.scene = scene;
    this.slashes = [];
    this.slashGeos = new Map();
  }

  // An arc of geometry from angle `from` to `to` (round from straight ahead,
  // the way the swing goes) between radius inner and outer, flat on the
  // ground's plane; made once for each shape.
  slashGeo(from, to, inner, outer) {
    const key = `${from}|${to}|${inner}|${outer}`;
    let g = this.slashGeos.get(key);
    if (g) return g;
    // (A whole circle needs more stretches than a sweep in front.)
    const n = Math.max(24, Math.ceil(Math.abs(to - from) * 6));
    const pos = [];
    const ts = [];
    const index = [];
    for (let i = 0; i <= n; i++) {
      const a = from + ((to - from) * i) / n;
      for (const [r, out] of [[inner, 0], [outer, 1]]) {
        pos.push(Math.sin(a) * r, 0, Math.cos(a) * r);
        ts.push(i / n, out);
      }
      if (i) index.push(i * 2 - 2, i * 2 - 1, i * 2, i * 2 - 1, i * 2 + 1, i * 2);
    }
    g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('ts', new THREE.Float32BufferAttribute(ts, 2));
    g.setIndex(index);
    this.slashGeos.set(key, g);
    return g;
  }

  // A swing's slash at (x, y, z), facing yaw: a sweep from the swinger's
  // right round to their left (or, upright, from over their head down in
  // front of them), as far out as reach, in color, over secs.
  slash(x, y, z, yaw, { reach = 1.5, color = '#ffffff', upright = false, tilt = -0.2, from, to, secs = SLASH_SECS } = {}) {
    let s = this.slashes.find((one) => !one.group.visible);
    if (!s) {
      if (this.slashes.length >= SLASH_POOL) s = this.slashes.reduce((a, b) => (a.age > b.age ? a : b));
      else {
        const mat = new THREE.ShaderMaterial({
          uniforms: { uColor: { value: new THREE.Color() }, uHead: { value: 0 }, uTrail: { value: SLASH_TRAIL } },
          vertexShader: SLASH_VERT,
          fragmentShader: SLASH_FRAG,
          transparent: true,
          depthWrite: false,
          side: THREE.DoubleSide,
        });
        const group = new THREE.Group();
        const mesh = new THREE.Mesh(this.slashGeo(0, 1, 0, 1), mat);
        mesh.frustumCulled = false;
        mesh.renderOrder = 4;
        group.add(mesh);
        this.scene.add(group);
        s = { group, mesh, mat, age: 0 };
        this.slashes.push(s);
      }
    }
    const lo = from ?? SLASH_FROM;
    const hi = to ?? (upright ? SLASH_TO_UPRIGHT : SLASH_TO);
    s.mesh.geometry = this.slashGeo(lo, hi, Math.max(0.3, reach * 0.45), reach);
    s.group.position.set(x, y, z);
    s.group.rotation.set(0, yaw, 0);
    // Upright: the arc stood on its side, up over the head and down in
    // front; otherwise tipped a little, the blade ending lower than it began.
    s.mesh.rotation.set(0, 0, upright ? -Math.PI / 2 : tilt);
    s.mat.uniforms.uColor.value.set(color);
    s.mat.uniforms.uHead.value = 0;
    s.age = 0;
    s.secs = secs;
    s.group.visible = true;
  }

  // What is showing in the world (not what is drawn over everything).
  get list() {
    return this.world.list;
  }

  // delay: seconds before it shows (and starts to move). turn: how far it is
  // turned in the picture's plane, and spin how fast that goes round. over:
  // drawn over everything, whatever stands in front of it.
  add(kind, x, y, z, { vx = 0, vy = 0, vz = 0, color = '#ffffff', size = 0.3, life = 1, gravity = 0, grow = 0, drag = 0, spin = 0, delay = 0, turn = 0, over = false } = {}) {
    const layer = over ? this.over : this.world;
    if (layer.list.length >= layer.max) layer.list.shift();
    const c = this.tmp.set(color);
    layer.list.push({ k: KINDS.indexOf(kind), x, y, z, vx, vy, vz, r: c.r, g: c.g, b: c.b, size, life, age: -delay, gravity, grow, drag, spin, turn });
  }

  // ------------------------------------------------ recipes

  pop(x, y, z, color, count = 10) {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = 1.5 + Math.random() * 2.5;
      this.add('square', x + 0.5 + (Math.random() - 0.5) * 0.6, y + 0.5 + (Math.random() - 0.5) * 0.6, z + 0.5 + (Math.random() - 0.5) * 0.6, {
        vx: Math.cos(a) * s,
        vy: 2 + Math.random() * 3,
        vz: Math.sin(a) * s,
        color,
        size: 0.14 + Math.random() * 0.1,
        life: 0.6 + Math.random() * 0.4,
        gravity: 14,
      });
    }
    this.add('puff', x + 0.5, y + 0.5, z + 0.5, { size: 0.9, life: 0.35, grow: 2.2, color: '#ffffff' });
  }

  place(x, y, z, color) {
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      this.add('puff', x + 0.5 + Math.cos(a) * 0.55, y + 0.05, z + 0.5 + Math.sin(a) * 0.55, {
        vx: Math.cos(a) * 1.2,
        vz: Math.sin(a) * 1.2,
        vy: 0.4,
        size: 0.35,
        life: 0.45,
        grow: 0.6,
        color: '#ffffff',
      });
    }
    this.add('sparkle', x + 0.5, y + 1.1, z + 0.5, { vy: 1, size: 0.35, life: 0.5, color });
  }

  hearts(x, y, z, count = 3) {
    for (let i = 0; i < count; i++) {
      this.add('heart', x + (Math.random() - 0.5) * 0.6, y + Math.random() * 0.3, z + (Math.random() - 0.5) * 0.6, {
        vy: 1 + Math.random() * 0.6,
        vx: (Math.random() - 0.5) * 0.4,
        size: 0.25 + Math.random() * 0.12,
        life: 1.3,
        color: ['#ff5f8f', '#ff8fb8', '#ff4f6f'][i % 3],
      });
    }
  }

  // Experience earned (levels.js), as stars that drift up out of what you
  // did for it: a popped monster most of all (game.js popped).
  stars(x, y, z, count = 4) {
    for (let i = 0; i < count; i++) {
      this.add('star', x + (Math.random() - 0.5) * 0.7, y + Math.random() * 0.3, z + (Math.random() - 0.5) * 0.7, {
        vy: 1.3 + Math.random() * 0.8,
        vx: (Math.random() - 0.5) * 0.5,
        vz: (Math.random() - 0.5) * 0.5,
        size: 0.2 + Math.random() * 0.16,
        life: 1 + Math.random() * 0.4,
        drag: 0.6,
        color: ['#ffd84d', '#fff3a0', '#ffffff'][i % 3],
      });
    }
  }

  sparkles(x, y, z, count = 12, colors = ['#fff3a0', '#ffffff', '#ffd84d', '#9fe8ff']) {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = 0.8 + Math.random() * 1.8;
      this.add('sparkle', x, y, z, {
        vx: Math.cos(a) * s,
        vy: 0.8 + Math.random() * 2,
        vz: Math.sin(a) * s,
        size: 0.18 + Math.random() * 0.2,
        life: 0.7 + Math.random() * 0.5,
        drag: 2,
        color: colors[i % colors.length],
      });
    }
  }

  // Confetti: bits of coloured paper bursting up out of (x, y, z) and
  // fluttering slowly down, wide across (spread) as far as it should go.
  confetti(x, y, z, count = 110, spread = 1) {
    const colors = ['#ff5f8f', '#ffd84d', '#7cc4ff', '#7fe08c', '#c78cff', '#ff9a3d', '#ffffff'];
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = (0.6 + Math.random() * 3.4) * spread;
      this.add('square', x, y, z, {
        vx: Math.cos(a) * s,
        vy: 3 + Math.random() * 4.5,
        vz: Math.sin(a) * s,
        size: 0.06 + Math.random() * 0.07,
        life: 2.2 + Math.random() * 1.6,
        gravity: 3.4,
        drag: 1.3,
        delay: Math.random() * 0.12,
        color: colors[i % colors.length],
      });
    }
  }

  notes(x, y, z) {
    this.add('note', x + (Math.random() - 0.5) * 0.5, y, z + (Math.random() - 0.5) * 0.5, {
      vy: 0.9,
      vx: (Math.random() - 0.5) * 0.8,
      size: 0.3,
      life: 1.4,
      color: ['#7cc4ff', '#ff8fc4', '#ffd24a', '#7fe08c'][Math.floor(Math.random() * 4)],
    });
  }

  zzz(x, y, z) {
    this.add('zzz', x + 0.2, y, z, { vy: 0.5, vx: 0.25, size: 0.28, life: 1.8, grow: 0.2, color: '#c9d6ff' });
  }

  // A wisp of steam off a hot tub (game.js updateHotTubs sends one up every
  // few moments over whoever is soaking in it): a soft puff, rising slowly and
  // spreading out as it fades.
  steam(x, y, z) {
    this.add('puff', x + (Math.random() - 0.5) * 0.5, y, z + (Math.random() - 0.5) * 0.5, {
      vy: 0.45 + Math.random() * 0.25,
      vx: (Math.random() - 0.5) * 0.12,
      vz: (Math.random() - 0.5) * 0.12,
      size: 0.16 + Math.random() * 0.1,
      life: 1.7,
      grow: 0.4,
      color: '#eef8ff',
    });
  }

  // A blow landing at (x, y, z), going the way (dx, dz) along the ground, sized
  // by power: a spiky star there in color with a white-hot one inside it, gone
  // in a few frames; splinters of light shooting straight out from it across
  // the picture; a ring of sparkles bursting out; and quick bits flying on the
  // way the blow went, falling as they go. Your own (over) is drawn over
  // everything, as you stand between the camera and what you hit.
  impact(x, y, z, dx, dz, color = '#ffffff', power = 1, over = true) {
    const turn = Math.random() * Math.PI * 2;
    this.add('burst', x, y, z, { size: 1.9 * power, grow: -7 * power, life: 0.11, color, turn, over });
    this.add('burst', x, y, z, { size: 1.2 * power, grow: -6 * power, life: 0.09, turn: turn + 0.5, over });
    const e = this.camera.matrixWorld.elements;
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + Math.random() * 0.5;
      const s = (11 + Math.random() * 5) * power;
      const sx = Math.cos(a) * s;
      const sy = Math.sin(a) * s;
      this.add('streak', x, y, z, {
        vx: e[0] * sx + e[4] * sy,
        vy: e[1] * sx + e[5] * sy,
        vz: e[2] * sx + e[6] * sy,
        size: (1 + Math.random() * 0.5) * power,
        grow: -4 * power,
        life: 0.17,
        drag: 7,
        turn: a,
        color: i % 2 ? color : '#ffffff',
        over,
      });
    }
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + Math.random() * 0.4;
      const up = Math.random() * 1.6 - 0.5;
      this.add('sparkle', x, y, z, {
        vx: Math.cos(a) * 3.8 * power,
        vy: up * 3.8 * power,
        vz: Math.sin(a) * 3.8 * power,
        size: (0.3 + Math.random() * 0.14) * power,
        life: 0.26 + Math.random() * 0.1,
        drag: 6,
        color: i % 2 ? color : '#ffffff',
        over,
      });
    }
    for (let i = 0; i < 6; i++) {
      const s = (5 + Math.random() * 3) * power;
      const side = (Math.random() - 0.5) * 1.4;
      this.add('square', x, y, z, {
        vx: (dx - dz * side) * s,
        vy: 1.5 + Math.random() * 2.5,
        vz: (dz + dx * side) * s,
        size: (0.1 + Math.random() * 0.07) * power,
        life: 0.35 + Math.random() * 0.2,
        gravity: 16,
        drag: 3,
        color: i % 3 ? color : '#ffffff',
        over,
      });
    }
  }

  // The Star Hammer coming down: dust thrown out low along the ground all round.
  thud(x, y, z) {
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2 + Math.random() * 0.4;
      const s = 3.5 + Math.random() * 2;
      this.add('puff', x, y + 0.12, z, { vx: Math.cos(a) * s, vy: 0.5 + Math.random() * 0.5, vz: Math.sin(a) * s, size: 0.35, grow: 1.6, life: 0.42, drag: 5, color: '#fff6e0' });
    }
  }

  // The Lava Blade's cut: embers floating up out of it, and a lick of flame.
  embers(x, y, z) {
    for (let i = 0; i < 12; i++) {
      this.add('square', x + (Math.random() - 0.5) * 0.5, y + (Math.random() - 0.5) * 0.5, z + (Math.random() - 0.5) * 0.5, {
        vx: (Math.random() - 0.5) * 2.4,
        vy: 1 + Math.random() * 2.2,
        vz: (Math.random() - 0.5) * 2.4,
        size: 0.06 + Math.random() * 0.07,
        life: 0.5 + Math.random() * 0.4,
        drag: 1.2,
        gravity: -1,
        color: i % 3 ? '#ff8a2a' : '#ffd84d',
        over: true,
      });
    }
    for (let i = 0; i < 3; i++) this.add('puff', x, y, z, { vy: 1.4, vx: (Math.random() - 0.5) * 1.2, vz: (Math.random() - 0.5) * 1.2, size: 0.4, grow: 1.5, life: 0.26, color: '#ff6a1f', delay: i * 0.03, over: true });
  }

  // The Galaxy Blade's whirl: stars thrown off the slash all the way round as
  // it comes (from to to, round from straight ahead at yaw, in secs), flying
  // outward. Round (x, y, z), as far out as reach.
  starWhirl(x, y, z, yaw, reach, from, to, secs) {
    const colors = ['#ffffff', '#ffe27a', '#b18cff', '#7fd4ff'];
    for (let i = 0; i < 36; i++) {
      const k = i / 36;
      const a = yaw + from + (to - from) * k;
      const r = reach * (0.55 + Math.random() * 0.45);
      const out = 1.5 + Math.random() * 3.5;
      this.add(i % 3 ? 'sparkle' : 'star', x + Math.sin(a) * r, y + (Math.random() - 0.5) * 0.7, z + Math.cos(a) * r, { vx: Math.sin(a) * out, vy: 0.3 + Math.random() * 1.8, vz: Math.cos(a) * out, size: 0.24 + Math.random() * 0.26, life: 0.45 + Math.random() * 0.35, drag: 2, spin: 6, color: colors[i % 4], delay: k * secs });
    }
  }

  // Sparks flying off wherever a Thunder Spear's bolt ended with nothing to strike.
  zapSparks(x, y, z) {
    for (let i = 0; i < 10; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = 2 + Math.random() * 3;
      this.add(i % 2 ? 'streak' : 'sparkle', x, y, z, { vx: Math.cos(a) * s, vy: (Math.random() - 0.3) * s, vz: Math.sin(a) * s, size: 0.2 + Math.random() * 0.2, life: 0.2 + Math.random() * 0.2, drag: 4, turn: a, color: i % 3 ? '#9fe8ff' : '#ffffff' });
    }
  }

  // Colours of the rainbow glittering all along a Rainbow Ray's beam, from
  // (x, y, z) to (tx, ty, tz), and a burst at its mouth.
  beamSparks(x, y, z, tx, ty, tz) {
    const colors = ['#ff5a5a', '#ff9d3d', '#ffe14d', '#5fd36a', '#4fa8ff', '#a77bff', '#ffffff'];
    const long = Math.hypot(tx - x, ty - y, tz - z);
    for (let i = 0; i < Math.ceil(long * 5); i++) {
      const k = Math.random();
      this.add('sparkle', x + (tx - x) * k, y + (ty - y) * k, z + (tz - z) * k, { vx: (Math.random() - 0.5) * 2.4, vy: (Math.random() - 0.3) * 2.4, vz: (Math.random() - 0.5) * 2.4, size: 0.14 + Math.random() * 0.18, life: 0.3 + Math.random() * 0.3, drag: 2, color: colors[i % colors.length] });
    }
    this.add('burst', x, y, z, { size: 1.1, grow: -6, life: 0.12, color: '#ffffff' });
  }

  // A meteor landing at (x, y, z), on the ground: a white-hot flash, fire
  // rolling out along the ground as far as r and a column of it going up, rocks
  // and embers flying every way.
  fireball(x, y, z, r) {
    const fire = ['#fff3a0', '#ffd84d', '#ff9a3d', '#ff5a1f', '#e8401c'];
    this.add('burst', x, y + 1, z, { size: r * 2.2, grow: -r * 8, life: 0.16, color: '#ffb13d', over: true });
    this.add('puff', x, y + 1, z, { size: r * 1.1, grow: r * 7, life: 0.2, over: true });
    for (let i = 0; i < 44; i++) {
      const a = (i / 44) * Math.PI * 2 + Math.random() * 0.2;
      const s = r * (1.8 + Math.random() * 2.2);
      this.add('puff', x + Math.cos(a) * 0.5, y + 0.3 + Math.random() * 0.5, z + Math.sin(a) * 0.5, { vx: Math.cos(a) * s, vy: 0.4 + Math.random() * 1.4, vz: Math.sin(a) * s, size: 0.7 + Math.random() * 0.7, grow: 2.2, life: 0.4 + Math.random() * 0.35, drag: 3.4, color: fire[i % fire.length] });
    }
    for (let i = 0; i < 18; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = Math.random() * 1.6;
      this.add('puff', x + Math.cos(a) * s * 0.4, y + 0.5, z + Math.sin(a) * s * 0.4, { vx: Math.cos(a) * s, vy: 5 + Math.random() * 7, vz: Math.sin(a) * s, size: 0.7 + Math.random() * 0.6, grow: 1.6, life: 0.45 + Math.random() * 0.4, drag: 2.4, delay: Math.random() * 0.06, color: i % 4 === 3 ? '#6a5a52' : fire[i % fire.length] });
    }
    const rock = ['#3f3638', '#57473f', '#ff7a1a', '#ffd84d'];
    for (let i = 0; i < 28; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = 3 + Math.random() * 6;
      this.add('square', x, y + 0.5, z, { vx: Math.cos(a) * s, vy: 4 + Math.random() * 8, vz: Math.sin(a) * s, size: 0.12 + Math.random() * 0.16, life: 0.7 + Math.random() * 0.5, gravity: 20, drag: 0.6, color: rock[i % 4] });
    }
    for (let i = 0; i < 16; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = 2 + Math.random() * 3;
      this.add('sparkle', x, y + 0.8, z, { vx: Math.cos(a) * s, vy: 1 + Math.random() * 4, vz: Math.sin(a) * s, size: 0.2 + Math.random() * 0.25, life: 0.6 + Math.random() * 0.5, drag: 1.2, color: i % 2 ? '#ffd84d' : '#ffffff' });
    }
    for (const [from, to] of [[0.5, r * 0.8], [0.3, r * 1.5]]) this.ripple(x, y + 0.1, z, from, to);
  }

  // A monster going pop at (x, y, z): a white puff, drops of it in its own
  // color flying every way and falling, and a flat ring round it on the ground
  // (size: how big it was).
  jellyPop(x, y, z, color, size = 1) {
    this.add('puff', x, y, z, { size: 1.5 * size, grow: 7 * size, life: 0.16, over: true });
    for (let i = 0; i < 22; i++) {
      const a = Math.random() * Math.PI * 2;
      const out = (2.5 + Math.random() * 4) * size;
      this.add('drop', x, y, z, {
        vx: Math.cos(a) * out,
        vy: 2.5 + Math.random() * 5,
        vz: Math.sin(a) * out,
        size: (0.2 + Math.random() * 0.24) * size,
        life: 0.45 + Math.random() * 0.25,
        gravity: 17,
        drag: 0.8,
        color: i % 4 ? color : '#ffffff',
        over: true,
      });
    }
  }

  bang(x, y, z) {
    this.add('bang', x, y, z, { vy: 0.6, size: 0.5, life: 1.1, color: '#ffd84d' });
  }

  splash(x, y, z) {
    for (let i = 0; i < 12; i++) {
      const a = Math.random() * Math.PI * 2;
      this.add('drop', x, y, z, { vx: Math.cos(a) * 1.5, vy: 3 + Math.random() * 2, vz: Math.sin(a) * 1.5, size: 0.14, life: 0.8, gravity: 14, color: '#bfe8ff' });
    }
  }

  // Off a trampoline: a ring of puffs round the feet, and stars from a bounce
  // as high as it goes.
  boing(x, y, z, top = false) {
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      this.add('puff', x + Math.cos(a) * 0.3, y + 0.05, z + Math.sin(a) * 0.3, { vx: Math.cos(a) * 2.2, vz: Math.sin(a) * 2.2, vy: 0.3, size: 0.26, life: 0.4, grow: 0.7, drag: 3, color: '#ffffff' });
    }
    if (!top) return;
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      this.add('star', x, y + 0.3, z, { vx: Math.cos(a) * 1.6, vz: Math.sin(a) * 1.6, vy: 2.5, size: 0.24, life: 0.8, gravity: 4, color: ['#ffd84d', '#ff8fc4', '#7cc4ff', '#7fe08c', '#ffffff'][i] });
    }
  }

  // A firework: a burst of stars in every colour, high over a freed island.
  firework(x, y, z) {
    const colors = ['#ff5f8f', '#ffd84d', '#7cc4ff', '#7fe08c', '#c78cff', '#ffffff', '#ff9a3d'];
    const base = Math.floor(Math.random() * colors.length);
    for (let i = 0; i < 36; i++) {
      const a = Math.random() * Math.PI * 2;
      const up = Math.random() * 2 - 1;
      const s = 4 + Math.random() * 3;
      const flat = Math.sqrt(1 - up * up);
      this.add(i % 3 ? 'star' : 'sparkle', x, y, z, { vx: Math.cos(a) * flat * s, vy: up * s, vz: Math.sin(a) * flat * s, size: 0.35 + Math.random() * 0.2, life: 1.3 + Math.random() * 0.5, gravity: 3, drag: 1.2, color: colors[(base + (i % 2) * 2) % colors.length] });
    }
  }

  // Little stars going round and round over the head of someone dizzy (one
  // step of it: called every frame), r round (bigger for King Grumble).
  dizzy(x, y, z, t, r = 0.38) {
    const size = 0.16 * Math.max(1, r / 0.38) ** 0.5;
    for (let k = 0; k < 3; k++) {
      const a = t * 5 + (k / 3) * Math.PI * 2;
      this.add('star', x + Math.cos(a) * r, y + Math.sin(t * 3 + k) * 0.05, z + Math.sin(a) * r, { size, life: 0.07, color: k === 1 ? '#ffffff' : '#ffd84d' });
    }
  }

  // A tower's bubble, flying from (x, y, z) to (tx, ty, tz) in t seconds, and
  // bursting there. Returns t.
  bubbleShot(x, y, z, tx, ty, tz, t = 0.28) {
    const vx = (tx - x) / t;
    const vy = (ty - y) / t;
    const vz = (tz - z) / t;
    this.add('puff', x, y, z, { vx, vy, vz, size: 0.42, life: t, color: '#bfefff' });
    this.add('sparkle', x, y, z, { vx, vy, vz, size: 0.2, life: t, color: '#ffffff' });
    for (let i = 0; i < 5; i++) {
      const a = Math.random() * Math.PI * 2;
      this.add('drop', tx, ty, tz, { vx: Math.cos(a) * 1.6 + vx * 0.05, vy: 1.5 + Math.random(), vz: Math.sin(a) * 1.6 + vz * 0.05, size: 0.12, life: 0.4, gravity: 10, color: '#9fe8ff', delay: t });
    }
    return t;
  }

  // A Toy Bow's arrow (shared/shop.js bow) shot from (x, y, z) at (tx, ty,
  // tz): it flies there point first, quick and nearly straight. On a
  // monster (hit) it sticks a blink with a wobble and a puff of sparkles;
  // missing, it flies on and drops. Returns how long the flight is, in s.
  arrowShot(x, y, z, tx, ty, tz, hit = false) {
    this.arrows ??= [];
    let a = this.arrows.find((k) => !k.busy);
    if (!a) {
      if (this.arrows.length >= ARROW_POOL) return 0;
      a = new Arrow(this.scene);
      this.arrows.push(a);
    }
    const t = Math.max(0.08, Math.hypot(tx - x, ty - y, tz - z) / ARROW_SPEED);
    a.go(x, y, z, tx, ty, tz, t, hit);
    if (hit) {
      const dx = tx - x;
      const dz = tz - z;
      const d = Math.hypot(dx, dz) || 1;
      for (let i = 0; i < 6; i++) {
        const k = Math.random() * Math.PI * 2;
        this.add('sparkle', tx, ty, tz, { vx: Math.cos(k) * 1.8 - (dx / d) * 1.2, vy: 1 + Math.random() * 1.5, vz: Math.sin(k) * 1.8 - (dz / d) * 1.2, size: 0.16, life: 0.4, gravity: 6, color: i % 2 ? '#ffffff' : '#ff8fc4', delay: t });
      }
    }
    return t;
  }

  // A dragon's fire (one frame of it: called every frame while it breathes):
  // flames pouring out of its mouth at (x, y, z) the way yaw faces, spreading
  // as they go, as far as reach, in a cone angle either side.
  flames(x, y, z, yaw, reach = 9, angle = 0.5, colors = ['#fff3a0', '#ffd84d', '#ff9a3d', '#ff5a1f', '#e8401c']) {
    const life = 0.55;
    for (let i = 0; i < 5; i++) {
      const a = yaw + (Math.random() * 2 - 1) * angle * 0.8;
      const s = (reach / life) * (0.75 + Math.random() * 0.3);
      const color = colors[Math.floor(Math.random() * colors.length)];
      this.add('puff', x, y, z, { vx: Math.sin(a) * s, vy: -1.2 + Math.random() * 1.6, vz: Math.cos(a) * s, size: 0.35 + Math.random() * 0.25, life: life * (0.8 + Math.random() * 0.3), grow: 2.4, drag: 0.6, color });
    }
    if (Math.random() < 0.5) this.add('sparkle', x, y, z, { vx: Math.sin(yaw) * reach * 1.4, vy: Math.random() * 2, vz: Math.cos(yaw) * reach * 1.4, size: 0.18, life: 0.5, drag: 1, color: '#ffef9a' });
  }

  dust(x, y, z) {
    for (let i = 0; i < 3; i++) {
      this.add('puff', x + (Math.random() - 0.5) * 0.4, y + 0.05, z + (Math.random() - 0.5) * 0.4, { vy: 0.4, size: 0.25, life: 0.4, grow: 0.8, color: '#ffffff' });
    }
  }

  // A ripple on the water behind a paddling duck: a flat ring that spreads
  // out and fades away in about a second, from a small pool of rings.
  ripple(x, y, z, from = 0.12, to = 0.6) {
    this.ripples ??= [];
    let r = this.ripples.find((k) => !k.busy);
    if (!r) {
      if (this.ripples.length >= RIPPLE_POOL) return;
      r = new Ripple(this.scene);
      this.ripples.push(r);
    }
    r.go(x, y, z, from, to);
  }

  // Mr. Mole coming up out of the ground: a burst of dirt out of the spot
  // his mound rose to, crumbs of earth flying every way and falling back.
  dirt(x, y, z) {
    for (let i = 0; i < 14; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = 1 + Math.random() * 2.2;
      this.add(i % 3 ? 'square' : 'puff', x, y + 0.15, z, {
        vx: Math.cos(a) * s,
        vy: 2 + Math.random() * 2.6,
        vz: Math.sin(a) * s,
        size: i % 3 ? 0.07 + Math.random() * 0.06 : 0.22 + Math.random() * 0.12,
        life: 0.45 + Math.random() * 0.3,
        gravity: 14,
        drag: 1,
        color: ['#6e5236', '#7d5f3f', '#5e442c', '#8a6a48'][i % 4],
      });
    }
  }

  // A Puffshroom's cloud of spores: soft yellow-green puffs rolling out all
  // round it as far as reach, rising a little and fading, with a few motes;
  // gas, Bogmaw's burp of swamp gas instead, murky green.
  spores(x, y, z, reach = 2.8, gas = false) {
    const colors = gas ? ['#8fb35a', '#6f9440', '#b5c97a', '#5d7d36'] : ['#e6f28a', '#c9e46a', '#f4f7c0', '#b8d870'];
    for (let i = 0; i < 22; i++) {
      const a = (i / 22) * Math.PI * 2 + Math.random() * 0.3;
      const s = reach * (1.2 + Math.random() * 0.8);
      this.add('puff', x, y + 0.5 + Math.random() * 0.4, z, {
        vx: Math.cos(a) * s,
        vy: 0.3 + Math.random() * 0.8,
        vz: Math.sin(a) * s,
        size: 0.35 + Math.random() * 0.25,
        life: 0.8 + Math.random() * 0.4,
        grow: 2,
        drag: 2.2,
        color: colors[i % 4],
      });
    }
    for (let i = 0; i < 8; i++) {
      const a = Math.random() * Math.PI * 2;
      this.add('sparkle', x, y + 0.8, z, { vx: Math.cos(a) * reach, vy: 1 + Math.random(), vz: Math.sin(a) * reach, size: 0.1, life: 0.9, drag: 1.4, color: '#fbffd0' });
    }
  }

  // Slashes in the air stop dead with the swing, until (performance.now()).
  holdSlashes(until) {
    this.slashHold = until;
  }

  update(dt) {
    const held = performance.now() < (this.slashHold ?? 0);
    for (const s of this.slashes) {
      if (!s.group.visible) continue;
      if (!held) s.age += dt;
      s.mat.uniforms.uHead.value = (s.age / s.secs) * (1 + SLASH_TRAIL);
      if (s.age >= s.secs) s.group.visible = false;
    }
    for (const r of this.ripples ?? []) r.update(dt);
    for (const a of this.arrows ?? []) a.update(dt);
    this.world.update(dt);
    this.over.update(dt);
  }
}

// A ripple on the water: a thin flat ring that spreads out from a paddling
// duck's tail and fades away in about a second, the way the whale's spout
// does its trick. Kept in a small pool and used again and again.
const RIPPLE_POOL = 12;
const RIPPLE_SECS = 0.9;

export class Ripple {
  constructor(scene) {
    this.busy = false;
    this.mesh = new THREE.Mesh(new THREE.RingGeometry(0.72, 1, 40), new THREE.MeshBasicMaterial({ color: '#eaf7ff', transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide }));
    this.mesh.rotation.x = -Math.PI / 2;
    this.mesh.renderOrder = 4;
    this.mesh.visible = false;
    scene.add(this.mesh);
    this.age = 0;
  }

  // Starts a ring at (x, y, z) that grows from radius `from` to `to`.
  go(x, y, z, from = 0.12, to = 0.6) {
    this.busy = true;
    this.age = 0;
    this.from = from;
    this.to = to;
    this.mesh.position.set(x, y, z);
    this.mesh.scale.setScalar(from);
    this.mesh.visible = true;
  }

  update(dt) {
    if (!this.busy) return;
    this.age += dt;
    const k = Math.min(1, this.age / RIPPLE_SECS);
    this.mesh.scale.setScalar(this.from + (this.to - this.from) * (1 - (1 - k) ** 2));
    this.mesh.material.opacity = 0.5 * (1 - k);
    if (k < 1) return;
    this.busy = false;
    this.mesh.visible = false;
  }
}

// The Toy Bow's arrows in flight (Effects arrowShot): a few, used again and
// again. One flies at ARROW_SPEED blocks a second, sticks STICK_SECS where
// it hit, or flies on and drops a while when it missed.
const ARROW_POOL = 6;
const ARROW_SPEED = 22;
const STICK_SECS = 0.3;
const DROP_SECS = 0.45;

export class Arrow {
  constructor(scene) {
    this.busy = false;
    this.group = new THREE.Group();
    // The arrow points along +y; lookAt turns +z to where it flies.
    const model = arrow();
    model.rotation.x = Math.PI / 2;
    model.position.z = -0.5;
    model.scale.setScalar(1.25);
    this.group.add(model);
    this.group.visible = false;
    scene.add(this.group);
    this.from = new THREE.Vector3();
    this.to = new THREE.Vector3();
    this.v = new THREE.Vector3();
    this.look = new THREE.Vector3();
  }

  go(x, y, z, tx, ty, tz, t, hit) {
    this.busy = true;
    this.age = 0;
    this.t = t;
    this.hit = hit;
    this.from.set(x, y, z);
    this.to.set(tx, ty, tz);
    this.v.subVectors(this.to, this.from).divideScalar(t);
    this.group.position.copy(this.from);
    this.group.lookAt(this.look.copy(this.from).add(this.v));
    this.group.visible = true;
  }

  update(dt) {
    if (!this.busy) return;
    this.age += dt;
    const g = this.group;
    if (this.age < this.t) {
      g.position.copy(this.from).addScaledVector(this.v, this.age);
    } else if (this.hit) {
      // Stuck on by its cup, wobbling.
      const k = this.age - this.t;
      g.position.copy(this.to);
      g.children[0].rotation.y = Math.sin(k * 60) * 0.25 * (1 - k / STICK_SECS);
      if (k >= STICK_SECS) this.done();
    } else {
      const k = this.age - this.t;
      this.v.y -= 14 * dt;
      g.position.addScaledVector(this.v, dt);
      g.lookAt(this.look.copy(g.position).add(this.v));
      if (k >= DROP_SECS) this.done();
    }
  }

  done() {
    this.busy = false;
    this.group.visible = false;
    this.group.children[0].rotation.y = 0;
  }
}
