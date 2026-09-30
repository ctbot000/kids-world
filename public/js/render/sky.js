// The sky: a colour gradient that follows the time of day, a smiling sun,
// a sleepy moon, twinkling stars, blocky clouds drifting by, rain, snow or
// candy sprinkles, rainbows after the rain, and the odd shooting star.
import * as THREE from '../../vendor/three.module.js';
import { daylight } from '../shared/env.js';

// Sky colours through the day: [time, zenith, horizon].
const KEYS = [
  [0.0, '#0a1034', '#1d2b5e'],
  [0.19, '#141a4a', '#2a3268'],
  [0.235, '#3b3f86', '#e59aac'],
  [0.28, '#6cb8ee', '#ffcfa0'],
  [0.36, '#56b4f0', '#c3e8ff'],
  [0.5, '#48a8f0', '#cdeeff'],
  [0.66, '#55abee', '#d8eeff'],
  [0.73, '#5e82d3', '#ffb183'],
  [0.775, '#303a7c', '#d97f95'],
  [0.82, '#141a4a', '#2a3268'],
  [1.0, '#0a1034', '#1d2b5e'],
];
const KEY_COLORS = KEYS.map(([t, a, b]) => [t, new THREE.Color(a), new THREE.Color(b)]);

const tmpA = new THREE.Color();
const tmpB = new THREE.Color();

function skyAt(time, top, horizon) {
  for (let i = 0; i < KEY_COLORS.length - 1; i++) {
    const [t0, a0, b0] = KEY_COLORS[i];
    const [t1, a1, b1] = KEY_COLORS[i + 1];
    if (time >= t0 && time <= t1) {
      const k = (time - t0) / (t1 - t0);
      top.copy(a0).lerp(a1, k);
      horizon.copy(b0).lerp(b1, k);
      return;
    }
  }
  top.copy(KEY_COLORS[0][1]);
  horizon.copy(KEY_COLORS[0][2]);
}

const GRAY_DAY = new THREE.Color('#9fb0c4');
const GRAY_NIGHT = new THREE.Color('#1c2236');
const CANDY_TINT = new THREE.Color('#ffb3d9');

// Everything the scene's lighting needs for a moment of the day.
export function environment(time, weather, theme, out = {}) {
  const top = (out.top ??= new THREE.Color());
  const horizon = (out.horizon ??= new THREE.Color());
  skyAt(time, top, horizon);
  const day = daylight(time);
  const gloom = weather === 'rain' ? 0.5 : weather === 'cloudy' ? 0.28 : weather === 'snow' ? 0.3 : weather === 'sprinkles' ? 0.15 : 0;
  if (gloom) {
    tmpA.copy(GRAY_NIGHT).lerp(GRAY_DAY, day);
    top.lerp(tmpA, gloom);
    horizon.lerp(tmpA, gloom * 0.8);
  }
  if (theme === 'candy') horizon.lerp(CANDY_TINT, 0.25 * day);
  const sunAngle = (time - 0.25) * Math.PI * 2;
  out.sunDir = (out.sunDir ?? new THREE.Vector3()).set(Math.cos(sunAngle), Math.sin(sunAngle), 0.32).normalize();
  out.moonDir = (out.moonDir ?? new THREE.Vector3()).copy(out.sunDir).multiplyScalar(-1);
  out.day = day;
  // Night is blue moonlight, never pitch dark; mornings and evenings are golden.
  const sun = (out.sun ??= new THREE.Color());
  const warm = Math.max(0, 1 - Math.abs(Math.sin(sunAngle)) * 3.2);
  sun.setRGB(1, 0.97, 0.92).lerp(tmpB.setRGB(1, 0.72, 0.5), warm * day);
  sun.lerp(tmpB.setRGB(0.42, 0.52, 0.9), 1 - day);
  if (gloom) sun.multiplyScalar(1 - gloom * 0.35);
  out.daylight = 0.34 + 0.66 * day;
  out.ambient = (out.ambient ?? new THREE.Color()).setRGB(0.1, 0.11, 0.17);
  out.fog = (out.fog ??= new THREE.Color()).copy(horizon);
  out.stars = Math.max(0, 1 - day * 1.6) * (1 - gloom);
  return out;
}

// ---------------------------------------------------------------- textures

function canvasTexture(size, draw) {
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  draw(c.getContext('2d'), size);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function sunTexture() {
  return canvasTexture(256, (ctx, s) => {
    const c = s / 2;
    const glow = ctx.createRadialGradient(c, c, s * 0.18, c, c, s * 0.5);
    glow.addColorStop(0, 'rgba(255,236,150,0.9)');
    glow.addColorStop(1, 'rgba(255,220,120,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, s, s);
    ctx.fillStyle = '#ffd84d';
    ctx.beginPath();
    ctx.arc(c, c, s * 0.22, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#ffb627';
    ctx.lineWidth = 6;
    ctx.stroke();
    // A happy face.
    ctx.fillStyle = '#7a4a12';
    ctx.beginPath();
    ctx.arc(c - 18, c - 8, 6, 0, Math.PI * 2);
    ctx.arc(c + 18, c - 8, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#7a4a12';
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(c, c + 4, 16, 0.2 * Math.PI, 0.8 * Math.PI);
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,140,120,0.6)';
    ctx.beginPath();
    ctx.arc(c - 30, c + 8, 7, 0, Math.PI * 2);
    ctx.arc(c + 30, c + 8, 7, 0, Math.PI * 2);
    ctx.fill();
  });
}

function moonTexture() {
  return canvasTexture(256, (ctx, s) => {
    const c = s / 2;
    const glow = ctx.createRadialGradient(c, c, s * 0.16, c, c, s * 0.5);
    glow.addColorStop(0, 'rgba(220,230,255,0.55)');
    glow.addColorStop(1, 'rgba(200,215,255,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, s, s);
    ctx.fillStyle = '#fbf6dc';
    ctx.beginPath();
    ctx.arc(c, c, s * 0.19, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(210,200,160,0.6)';
    for (const [x, y, r] of [
      [-16, -14, 9],
      [14, 12, 7],
      [-6, 22, 5],
    ]) {
      ctx.beginPath();
      ctx.arc(c + x, c + y, r, 0, Math.PI * 2);
      ctx.fill();
    }
    // Sleepy closed eyes.
    ctx.strokeStyle = '#7d7358';
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(c - 14, c - 2, 7, 0.1 * Math.PI, 0.9 * Math.PI);
    ctx.moveTo(c + 21, c - 2);
    ctx.arc(c + 14, c - 2, 7, 0.1 * Math.PI, 0.9 * Math.PI);
    ctx.stroke();
  });
}

function dropTexture(kind) {
  return canvasTexture(32, (ctx, s) => {
    if (kind === 'snow') {
      const g = ctx.createRadialGradient(16, 16, 1, 16, 16, 14);
      g.addColorStop(0, 'rgba(255,255,255,1)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, s, s);
    } else if (kind === 'sprinkles') {
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.roundRect(12, 4, 8, 24, 4);
      ctx.fill();
    } else {
      ctx.fillStyle = 'rgba(210,235,255,0.9)';
      ctx.beginPath();
      ctx.roundRect(14, 2, 4, 28, 2);
      ctx.fill();
    }
  });
}

// ---------------------------------------------------------------- the sky

const SKY_VERT = /* glsl */ `
  varying vec3 vDir;
  void main() {
    vDir = normalize(position);
    vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    gl_Position = p.xyww;
  }
`;

const SKY_FRAG = /* glsl */ `
  uniform vec3 uTop;
  uniform vec3 uHorizon;
  uniform vec3 uSunDir;
  uniform float uStars;
  uniform float uTime;
  varying vec3 vDir;
  float hash(vec3 p) {
    p = fract(p * 0.3183099 + 0.1);
    p *= 17.0;
    return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
  }
  void main() {
    vec3 d = normalize(vDir);
    float h = clamp(d.y, -1.0, 1.0);
    vec3 col = mix(uHorizon, uTop, smoothstep(-0.02, 0.55, h));
    col = mix(col, uHorizon * 0.85, smoothstep(0.0, -0.3, h));
    float sun = max(dot(d, uSunDir), 0.0);
    col += vec3(1.0, 0.85, 0.6) * pow(sun, 24.0) * 0.25;
    if (uStars > 0.01 && h > 0.0) {
      vec3 cell = floor(d * 160.0);
      float r = hash(cell);
      if (r > 0.9935) {
        vec3 centre = (cell + 0.5) / 160.0;
        float twinkle = 0.6 + 0.4 * sin(uTime * 2.0 + r * 60.0);
        float dot0 = smoothstep(0.004, 0.0, length(d - normalize(centre)));
        col += vec3(1.0, 0.97, 0.85) * dot0 * uStars * twinkle * smoothstep(0.0, 0.15, h);
      }
    }
    gl_FragColor = vec4(col, 1.0);
    #include <colorspace_fragment>
  }
`;

export class Sky {
  constructor(scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    this.group.name = 'sky';
    scene.add(this.group);
    this.uniforms = {
      uTop: { value: new THREE.Color() },
      uHorizon: { value: new THREE.Color() },
      uSunDir: { value: new THREE.Vector3(0, 1, 0) },
      uStars: { value: 0 },
      uTime: { value: 0 },
    };
    const dome = new THREE.Mesh(
      new THREE.SphereGeometry(900, 32, 16),
      new THREE.ShaderMaterial({ uniforms: this.uniforms, vertexShader: SKY_VERT, fragmentShader: SKY_FRAG, side: THREE.BackSide, depthWrite: false }),
    );
    dome.frustumCulled = false;
    dome.renderOrder = -10;
    this.dome = dome;
    this.group.add(dome);

    const sprite = (map, scale) => {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map, transparent: true, depthWrite: false, fog: false }));
      s.scale.setScalar(scale);
      s.renderOrder = -9;
      return s;
    };
    this.sun = sprite(sunTexture(), 150);
    this.moon = sprite(moonTexture(), 120);
    this.group.add(this.sun, this.moon);

    this.clouds = this.makeClouds();
    this.group.add(this.clouds);
    this.rainbow = this.makeRainbow();
    this.group.add(this.rainbow);
    this.weather = null;
    this.weatherKind = 'clear';
    this.shooting = [];
    this.rainbowAlpha = 0;
  }

  makeClouds() {
    const group = new THREE.Group();
    const box = new THREE.BoxGeometry(1, 1, 1);
    this.cloudMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.92, depthWrite: false });
    const r = mulberry(7);
    const puffs = [];
    for (let i = 0; i < 26; i++) {
      const cx = (r() - 0.5) * 520;
      const cz = (r() - 0.5) * 520;
      const n = 3 + Math.floor(r() * 4);
      for (let k = 0; k < n; k++) {
        puffs.push([cx + (r() - 0.5) * 30, (r() - 0.5) * 3, cz + (r() - 0.5) * 16, 12 + r() * 16, 4 + r() * 3, 9 + r() * 10]);
      }
    }
    const mesh = new THREE.InstancedMesh(box, this.cloudMaterial, puffs.length);
    const m = new THREE.Matrix4();
    puffs.forEach(([x, y, z, sx, sy, sz], i) => {
      m.makeScale(sx, sy, sz).setPosition(x, y, z);
      mesh.setMatrixAt(i, m);
    });
    mesh.frustumCulled = false;
    mesh.renderOrder = -5;
    group.add(mesh);
    group.userData.drift = 0;
    return group;
  }

  makeRainbow() {
    const geom = new THREE.TorusGeometry(260, 22, 8, 64, Math.PI);
    const mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      uniforms: { uAlpha: { value: 0 } },
      vertexShader: /* glsl */ `
        varying vec3 vLocal;
        void main() {
          vLocal = position;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform float uAlpha;
        varying vec3 vLocal;
        vec3 band(float t) {
          vec3 c[7];
          c[0] = vec3(0.56, 0.36, 0.84); c[1] = vec3(0.23, 0.45, 0.85); c[2] = vec3(0.38, 0.77, 0.96);
          c[3] = vec3(0.21, 0.66, 0.32); c[4] = vec3(0.99, 0.84, 0.21); c[5] = vec3(0.96, 0.58, 0.19); c[6] = vec3(0.91, 0.27, 0.24);
          float f = clamp(t, 0.0, 0.999) * 7.0;
          return c[int(f)];
        }
        void main() {
          float r = length(vLocal.xy);
          float t = (r - 238.0) / 44.0;
          float edge = smoothstep(0.0, 0.08, t) * smoothstep(1.0, 0.92, t);
          gl_FragColor = vec4(band(t), uAlpha * edge * 0.55);
          #include <colorspace_fragment>
        }
      `,
    });
    const mesh = new THREE.Mesh(geom, mat);
    mesh.frustumCulled = false;
    mesh.renderOrder = -6;
    mesh.visible = false;
    return mesh;
  }

  setWeather(kind) {
    if (kind === this.weatherKind) return;
    this.weatherKind = kind;
    if (this.weather) {
      this.group.remove(this.weather);
      this.weather.geometry.dispose();
      this.weather.material.dispose();
      this.weather = null;
    }
    if (kind !== 'rain' && kind !== 'snow' && kind !== 'sprinkles') return;
    const n = kind === 'snow' ? 900 : 1200;
    const pos = new Float32Array(n * 3);
    const col = new Float32Array(n * 3);
    const r = mulberry(3);
    const sprinkle = [new THREE.Color('#ff6b8a'), new THREE.Color('#7fe08c'), new THREE.Color('#ffd24a'), new THREE.Color('#7cc4ff'), new THREE.Color('#c79bff')];
    for (let i = 0; i < n; i++) {
      pos[i * 3] = (r() - 0.5) * 60;
      pos[i * 3 + 1] = r() * 40;
      pos[i * 3 + 2] = (r() - 0.5) * 60;
      const c = kind === 'sprinkles' ? sprinkle[i % sprinkle.length] : new THREE.Color(1, 1, 1);
      col.set([c.r, c.g, c.b], i * 3);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const mat = new THREE.PointsMaterial({
      size: kind === 'snow' ? 0.35 : kind === 'sprinkles' ? 0.3 : 0.28,
      map: dropTexture(kind),
      transparent: true,
      depthWrite: false,
      vertexColors: true,
      opacity: kind === 'rain' ? 0.7 : 0.95,
    });
    this.weather = new THREE.Points(g, mat);
    this.weather.frustumCulled = false;
    this.weather.userData = { kind, speed: kind === 'snow' ? 2.2 : kind === 'sprinkles' ? 6 : 16 };
    this.group.add(this.weather);
  }

  shootingStar(from) {
    const mat = new THREE.SpriteMaterial({ map: this.starTexture ??= dropTexture('snow'), color: 0xfff3b0, transparent: true, depthWrite: false });
    const s = new THREE.Sprite(mat);
    s.scale.setScalar(10);
    const start = new THREE.Vector3(from.x - 160, 180, from.z - 120);
    s.position.copy(start);
    this.group.add(s);
    this.shooting.push({ sprite: s, start, t: 0, target: new THREE.Vector3(from.x, from.y, from.z) });
  }

  update(dt, time, env, camera, focus) {
    const u = this.uniforms;
    u.uTop.value.copy(env.top);
    u.uHorizon.value.copy(env.horizon);
    u.uSunDir.value.copy(env.sunDir);
    u.uStars.value = env.stars;
    u.uTime.value = time;
    this.dome.position.copy(camera.position);
    this.sun.position.copy(camera.position).addScaledVector(env.sunDir, 700);
    this.moon.position.copy(camera.position).addScaledVector(env.moonDir, 700);
    this.sun.visible = env.sunDir.y > -0.15;
    this.moon.visible = env.moonDir.y > -0.15;
    // Clouds drift slowly and wrap around the island.
    const drift = (this.clouds.userData.drift = (this.clouds.userData.drift + dt * 1.2) % 520);
    this.clouds.position.set(focus.x + ((drift + 260) % 520) - 260, focus.cloudY, focus.z);
    const night = 1 - env.day;
    this.cloudMaterial.color.setRGB(1, 1, 1).lerp(new THREE.Color(0.28, 0.32, 0.5), night * 0.85);
    const dark = this.weatherKind === 'rain' ? 0.35 : this.weatherKind === 'cloudy' ? 0.15 : 0;
    this.cloudMaterial.color.multiplyScalar(1 - dark);
    this.cloudMaterial.opacity = this.weatherKind === 'clear' || this.weatherKind === 'rainbow' ? 0.82 : 0.96;

    const wantRainbow = this.weatherKind === 'rainbow' && env.day > 0.3 ? 1 : 0;
    this.rainbowAlpha += (wantRainbow - this.rainbowAlpha) * Math.min(1, dt * 0.6);
    this.rainbow.visible = this.rainbowAlpha > 0.01;
    this.rainbow.material.uniforms.uAlpha.value = this.rainbowAlpha;
    this.rainbow.position.set(focus.x + 60, -40, focus.z - 380);

    if (this.weather) {
      const p = this.weather.geometry.attributes.position;
      const { speed, kind } = this.weather.userData;
      for (let i = 0; i < p.count; i++) {
        let y = p.getY(i) - speed * dt * (0.8 + (i % 7) * 0.05);
        let x = p.getX(i);
        if (kind === 'snow') x += Math.sin(time * 0.8 + i) * dt * 0.4;
        if (y < 0) y += 40;
        p.setXY(i, x, y);
      }
      p.needsUpdate = true;
      this.weather.position.set(focus.x, focus.y - 12, focus.z);
    }

    for (const s of [...this.shooting]) {
      s.t += dt / 1.6;
      s.sprite.position.lerpVectors(s.start, s.target, Math.min(1, s.t));
      s.sprite.material.opacity = 1 - Math.max(0, s.t - 0.8) * 5;
      if (s.t >= 1) {
        this.group.remove(s.sprite);
        s.sprite.material.dispose();
        this.shooting.splice(this.shooting.indexOf(s), 1);
      }
    }
  }
}

function mulberry(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), s | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
