// Little bursts that make things feel alive: puffs when blocks pop in or
// out, hearts for happy animals, sparkles, music notes, sleepy Zzz's and
// splashes. All drawn as camera-facing pictures from one small sheet.
import * as THREE from '../../vendor/three.module.js';

const KINDS = ['puff', 'heart', 'sparkle', 'note', 'zzz', 'square', 'drop', 'star', 'bang'];
const CELL = 64;
const MAX = 900;

function sheet() {
  const c = document.createElement('canvas');
  c.width = CELL * KINDS.length;
  c.height = CELL;
  const ctx = c.getContext('2d');
  const at = (i) => ({ x: i * CELL, c: CELL / 2 });
  KINDS.forEach((kind, i) => {
    const { x, c: m } = at(i);
    ctx.save();
    ctx.translate(x, 0);
    switch (kind) {
      case 'puff': {
        const g = ctx.createRadialGradient(m, m, 2, m, m, 28);
        g.addColorStop(0, 'rgba(255,255,255,1)');
        g.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, CELL, CELL);
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
  attribute vec2 info; // size, kind
  varying vec2 vUv;
  varying vec4 vColor;
  uniform float uKinds;
  void main() {
    vec3 right = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
    vec3 up = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);
    vec3 p = center + (right * position.x + up * position.y) * info.x;
    gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
    vUv = vec2((uv.x + info.y) / uKinds, uv.y);
    vColor = color;
  }
`;

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

export class Effects {
  constructor(scene) {
    this.list = [];
    const quad = new THREE.PlaneGeometry(1, 1);
    const g = new THREE.InstancedBufferGeometry();
    g.index = quad.index;
    g.setAttribute('position', quad.getAttribute('position'));
    g.setAttribute('uv', quad.getAttribute('uv'));
    this.center = new THREE.InstancedBufferAttribute(new Float32Array(MAX * 3), 3);
    this.color = new THREE.InstancedBufferAttribute(new Float32Array(MAX * 4), 4);
    this.info = new THREE.InstancedBufferAttribute(new Float32Array(MAX * 2), 2);
    for (const a of [this.center, this.color, this.info]) a.setUsage(THREE.DynamicDrawUsage);
    g.setAttribute('center', this.center);
    g.setAttribute('color', this.color);
    g.setAttribute('info', this.info);
    g.instanceCount = 0;
    this.geometry = g;
    const mat = new THREE.ShaderMaterial({
      uniforms: { map: { value: sheet() }, uKinds: { value: KINDS.length } },
      vertexShader: VERT,
      fragmentShader: FRAG,
      transparent: true,
      depthWrite: false,
    });
    this.mesh = new THREE.Mesh(g, mat);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 5;
    scene.add(this.mesh);
    this.tmp = new THREE.Color();
  }

  // delay: seconds before it shows (and starts to move).
  add(kind, x, y, z, { vx = 0, vy = 0, vz = 0, color = '#ffffff', size = 0.3, life = 1, gravity = 0, grow = 0, drag = 0, spin = 0, delay = 0 } = {}) {
    if (this.list.length >= MAX) this.list.shift();
    const c = this.tmp.set(color);
    this.list.push({ k: KINDS.indexOf(kind), x, y, z, vx, vy, vz, r: c.r, g: c.g, b: c.b, size, life, age: -delay, gravity, grow, drag, spin });
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

  // A tower's bubble, flying from (x, y, z) to (tx, ty, tz), and bursting there.
  bubbleShot(x, y, z, tx, ty, tz) {
    const t = 0.28;
    const vx = (tx - x) / t;
    const vy = (ty - y) / t;
    const vz = (tz - z) / t;
    this.add('puff', x, y, z, { vx, vy, vz, size: 0.42, life: t, color: '#bfefff' });
    this.add('sparkle', x, y, z, { vx, vy, vz, size: 0.2, life: t, color: '#ffffff' });
    for (let i = 0; i < 5; i++) {
      const a = Math.random() * Math.PI * 2;
      this.add('drop', tx, ty, tz, { vx: Math.cos(a) * 1.6 + vx * 0.05, vy: 1.5 + Math.random(), vz: Math.sin(a) * 1.6 + vz * 0.05, size: 0.12, life: 0.4, gravity: 10, color: '#9fe8ff', delay: t });
    }
  }

  dust(x, y, z) {
    for (let i = 0; i < 3; i++) {
      this.add('puff', x + (Math.random() - 0.5) * 0.4, y + 0.05, z + (Math.random() - 0.5) * 0.4, { vy: 0.4, size: 0.25, life: 0.4, grow: 0.8, color: '#ffffff' });
    }
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
        info[n * 2] = 0;
        info[n * 2 + 1] = p.k;
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
      const fade = Math.min(1, (p.life - p.age) / Math.min(0.35, p.life * 0.5));
      c[n * 3] = p.x;
      c[n * 3 + 1] = p.y;
      c[n * 3 + 2] = p.z;
      col[n * 4] = p.r;
      col[n * 4 + 1] = p.g;
      col[n * 4 + 2] = p.b;
      col[n * 4 + 3] = fade;
      info[n * 2] = p.size;
      info[n * 2 + 1] = p.k;
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
