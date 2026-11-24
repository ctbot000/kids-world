// What the bodies of the Land of Nod are made of, as they look (light.js
// nodMaterial has what each may read and change): patchwork quilt, pumpkin
// rind, moss, piano keys, brass, the black rock of the Dark Side. Nothing here
// is a picture: every pattern is worked out at each point, so it lies on a body
// of any shape with no seam and no stretch, however near you get.

export const NOISE = /* glsl */ `
  float nHash(vec3 p) {
    p = fract(p * vec3(0.1031, 0.1030, 0.0973));
    p += dot(p, p.yxz + 33.33);
    return fract((p.x + p.y) * p.z);
  }
  float nNoise(vec3 x) {
    vec3 i = floor(x);
    vec3 f = fract(x);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(mix(nHash(i), nHash(i + vec3(1, 0, 0)), f.x), mix(nHash(i + vec3(0, 1, 0)), nHash(i + vec3(1, 1, 0)), f.x), f.y),
      mix(mix(nHash(i + vec3(0, 0, 1)), nHash(i + vec3(1, 0, 1)), f.x), mix(nHash(i + vec3(0, 1, 1)), nHash(i + vec3(1, 1, 1)), f.x), f.y),
      f.z);
  }
  float nFbm(vec3 p) {
    float s = 0.0;
    float a = 0.5;
    for (int i = 0; i < 4; i++) {
      s += a * nNoise(p);
      p = p * 2.03 + 17.1;
      a *= 0.5;
    }
    return s;
  }
  // The way noise rises at a point, to bend a normal by.
  vec3 nSlope(vec3 p, float e) {
    float a = nNoise(p);
    return vec3(nNoise(p + vec3(e, 0, 0)) - a, nNoise(p + vec3(0, e, 0)) - a, nNoise(p + vec3(0, 0, e)) - a) / e;
  }
`;

// Patches of cloth sewn together, each its own colour and print, puffed up
// between the seams, with stitches along them.
const quilt = {
  head: `${NOISE}
    uniform vec3 uCloth[6];
    uniform float uPatch;
    uniform vec3 uThread;`,
  uniforms: {
    uCloth: ['#f4a8bd', '#8fbdf0', '#f9d98a', '#a5dbb0', '#b99cec', '#fff1e0'],
    uPatch: 2.7,
    uThread: '#ffffff',
  },
  params: { roughness: 0.95 },
  glsl: /* glsl */ `
    vec3 an = abs(n);
    float m1 = max(an.x, max(an.y, an.z));
    float m3 = min(an.x, min(an.y, an.z));
    float m2 = an.x + an.y + an.z - m1 - m3;
    vec2 q;
    float axis;
    vec3 tu;
    vec3 tv;
    if (an.y >= an.x && an.y >= an.z) { q = p.xz; axis = n.y > 0.0 ? 1.0 : 2.0; tu = vec3(1, 0, 0); tv = vec3(0, 0, 1); }
    else if (an.x >= an.z) { q = p.yz; axis = n.x > 0.0 ? 3.0 : 4.0; tu = vec3(0, 1, 0); tv = vec3(0, 0, 1); }
    else { q = p.xy; axis = n.z > 0.0 ? 5.0 : 6.0; tu = vec3(1, 0, 0); tv = vec3(0, 1, 0); }
    vec2 g = q / uPatch + 0.5;
    vec2 id = floor(g);
    vec2 f = fract(g) - 0.5;
    float h = nHash(vec3(id, axis));
    float h2 = nHash(vec3(id + 7.0, axis + 3.0));
    vec3 cloth = uCloth[int(mod(h * 37.0, 6.0))];
    vec3 other = uCloth[int(mod(h2 * 41.0 + 2.0, 6.0))];
    // Its print.
    vec2 fine = q * 1.0;
    float ink = 0.0;
    if (h2 < 0.22) ink = 1.0 - smoothstep(0.15, 0.19, length(fract(fine * 1.5) - 0.5));
    else if (h2 < 0.42) ink = smoothstep(0.44, 0.5, abs(fract(fine.x * 1.35 + fine.y * 0.0) - 0.5) * 2.0);
    else if (h2 < 0.58) { vec2 c = abs(fract(fine * 1.1) - 0.5) * 2.0; ink = max(smoothstep(0.55, 0.62, c.x), smoothstep(0.55, 0.62, c.y)) * 0.55; }
    else if (h2 < 0.72) { vec2 s = fract(fine * 0.9) - 0.5; float a = atan(s.y, s.x); float r = length(s); ink = 1.0 - smoothstep(0.0, 0.03, r - (0.17 + 0.07 * cos(a * 5.0))); }
    else if (h2 < 0.84) ink = smoothstep(0.1, 0.0, abs(fract(fine.y * 1.2 + sin(fine.x * 2.6) * 0.16) - 0.5) - 0.12) * 0.8;
    albedo = mix(cloth, mix(other, cloth, 0.25), ink * 0.75);
    // How far off the nearest seam: the sides of the patch, or where the cloth
    // turns over on to another side of the body.
    float side = 0.5 - max(abs(f.x), abs(f.y));
    float over = (m1 - m2) * 1.6;
    float seam = min(side * uPatch, over);
    vec2 along = abs(f.x) > abs(f.y) ? vec2(f.y, f.x) : vec2(f.x, f.y);
    // Puffed up in between.
    float puff = 1.0 - smoothstep(0.0, 0.75, seam);
    bend += (tu * sign(f.x) * step(abs(f.y), abs(f.x)) + tv * sign(f.y) * step(abs(f.x), abs(f.y))) * puff * puff * 0.75;
    ao *= mix(0.62, 1.0, smoothstep(0.0, 0.5, seam));
    // Stitches either side of the seam.
    float run = fract(along.x * uPatch * 2.6);
    float stitch = smoothstep(0.035, 0.015, abs(seam - 0.15)) * step(0.22, run) * step(run, 0.8) * step(side * uPatch, over);
    albedo = mix(albedo, uThread, stitch * 0.9);
    // The weave of it.
    vec2 weave = sin(q * 46.0);
    albedo *= 0.965 + 0.035 * weave.x * weave.y;
    bend += nSlope(p * 1.3, 0.2) * 0.12 + (tu * weave.x + tv * weave.y) * 0.03;
    rough = 0.95;
    fuzz = 0.55;
  `,
};

// Wide-wale corduroy: soft ridges running round the body's own axis.
const cord = {
  head: `${NOISE}\nuniform vec3 uColor;\nuniform vec3 uColor2;\nuniform float uWale;`,
  uniforms: { uColor: '#8fa8e8', uColor2: '#c3b4f2', uWale: 5.2 },
  params: { roughness: 0.95 },
  glsl: /* glsl */ `
    float a = atan(p.z, p.x);
    float r = length(p.xz);
    float wale = abs(n.y) > 0.8 ? r * uWale : p.y * uWale;
    float ridge = sin(wale * 3.14159);
    float band = smoothstep(0.35, 0.65, nNoise(vec3(floor(wale / 9.0) * 7.3, 1.0, 2.0)));
    albedo = mix(uColor, uColor2, band);
    albedo *= 0.86 + 0.14 * ridge + 0.05 * (nNoise(p * 14.0) - 0.5);
    vec3 dirn = abs(n.y) > 0.8 ? vec3(p.x, 0.0, p.z) / max(r, 0.01) : vec3(0.0, 1.0, 0.0);
    bend += dirn * cos(wale * 3.14159) * 0.4;
    ao *= 0.8 + 0.2 * smoothstep(-1.0, 0.4, ridge);
    rough = 0.95;
    fuzz = 0.7;
  `,
};

// Knitted wool: rows of stitches, each a little v, in stripes of colours.
const knit = {
  head: `${NOISE}\nuniform vec3 uWool[4];\nuniform float uRow;`,
  uniforms: { uWool: ['#f58fa8', '#fff3e2', '#7fb7e8', '#fff3e2'], uRow: 3.2 },
  params: { roughness: 1 },
  glsl: /* glsl */ `
    float lon = atan(p.z, p.x);
    float r = length(p.xz);
    vec2 q;
    vec3 tu;
    vec3 tv;
    vec3 an = abs(n);
    if (an.y >= an.x && an.y >= an.z) { q = p.xz; tu = vec3(1, 0, 0); tv = vec3(0, 0, 1); }
    else if (an.x >= an.z) { q = p.zy; tu = vec3(0, 0, 1); tv = vec3(0, 1, 0); }
    else { q = p.xy; tu = vec3(1, 0, 0); tv = vec3(0, 1, 0); }
    vec2 s = q * uRow;
    float col = floor(s.x);
    float fx = fract(s.x) - 0.5;
    float vee = s.y + abs(fx) * 0.9;
    float row = floor(vee);
    float fy = fract(vee) - 0.5;
    float strand = 1.0 - smoothstep(0.18, 0.5, length(vec2(abs(fx) - 0.25, fy * 0.55)));
    albedo = uWool[int(mod(floor(row / 5.0), 4.0))];
    albedo *= 0.72 + 0.28 * strand + 0.08 * (nNoise(vec3(q * 9.0, 2.0)) - 0.5);
    ao *= 0.7 + 0.3 * strand;
    bend += (tu * sign(fx) * (abs(fx) - 0.25) * 2.2 + tv * fy * 0.9) * 0.45 + nSlope(p * 6.0, 0.1) * 0.05;
    rough = 1.0;
    fuzz = 0.9;
  `,
};

// Smooth stuff of one colour, or two run together: plush, plastic, enamel.
const plain = {
  head: `${NOISE}\nuniform vec3 uColor;\nuniform vec3 uColor2;\nuniform float uRough;\nuniform float uFuzz;`,
  uniforms: { uColor: '#d8c6f5', uColor2: '#bfb0ec', uRough: 0.8, uFuzz: 0.4 },
  glsl: /* glsl */ `
    float k = smoothstep(0.3, 0.7, nFbm(p * 0.22));
    albedo = mix(uColor, uColor2, k);
    bend += nSlope(p * 2.2, 0.15) * 0.06;
    rough = uRough;
    fuzz = uFuzz;
  `,
};

// ---------------------------------------------------------------- Pumpkin Skies

// Rind: ridged and waxy, darker down in the grooves (where its shade gathers),
// flecked, paler where it lay.
const rind = {
  head: `${NOISE}\nuniform vec3 uColor;\nuniform vec3 uColor2;\nuniform vec3 uTip;\nuniform float uRibs;`,
  uniforms: { uColor: '#f58a1f', uColor2: '#d95f0e', uTip: '#7c9a3a', uRibs: 10 },
  params: { roughness: 0.42, envMapIntensity: 0.55 },
  glsl: /* glsl */ `
    float a = atan(p.z, p.x);
    float rib = abs(sin(a * uRibs * 0.5));
    float flecks = smoothstep(0.62, 0.8, nNoise(vec3(a * 26.0, p.y * 3.2, 1.0)));
    float streak = nFbm(vec3(a * uRibs * 1.2, p.y * 0.35, 4.0));
    albedo = mix(uColor2, uColor, smoothstep(0.0, 0.5, rib) * 0.75 + streak * 0.4);
    albedo = mix(albedo, albedo * 1.18 + 0.02, flecks * 0.5);
    float pole = smoothstep(0.72, 0.98, abs(normalize(p).y));
    albedo = mix(albedo, uTip, pole * 0.75);
    ao *= mix(0.6, 1.0, smoothstep(0.0, 0.3, rib));
    bend += nSlope(p * 1.6, 0.2) * 0.1;
    rough = 0.38 + 0.2 * streak;
  `,
};

// A plant's skin: stalks, pods and leaves, veined, with paler undersides.
const plant = {
  head: `${NOISE}\nuniform vec3 uColor;\nuniform vec3 uColor2;\nuniform vec3 uVein;\nuniform float uVeins;`,
  uniforms: { uColor: '#6fbf3a', uColor2: '#4d9a2f', uVein: '#b9e07a', uVeins: 1 },
  params: { roughness: 0.55 },
  glsl: /* glsl */ `
    float n1 = nFbm(p * 0.5);
    albedo = mix(uColor2, uColor, smoothstep(0.25, 0.75, n1));
    float a = atan(p.z, p.x);
    float r = length(p.xz);
    float ribs = abs(fract(a * 1.91 + nNoise(p * 0.8) * 0.15) - 0.5);
    float main = uVeins * (1.0 - smoothstep(0.0, 0.05 + 0.02 / max(r, 0.4), ribs)) * step(0.55, abs(n.y));
    float fine = uVeins * (1.0 - smoothstep(0.0, 0.1, abs(fract(r * 1.1 + ribs * 3.0) - 0.5))) * 0.4 * step(0.55, abs(n.y));
    albedo = mix(albedo, uVein, max(main, fine) * 0.6);
    float long_ = sin((p.x + p.z) * 5.0 + nNoise(p * 2.0) * 3.0);
    albedo *= 0.95 + 0.05 * long_ * (1.0 - uVeins);
    bend += nSlope(p * 3.0, 0.1) * 0.1;
    rough = 0.5;
    fuzz = 0.25;
  `,
};

// An apple: red all round but where it hung and where it sat, streaked.
const apple = {
  head: `${NOISE}\nuniform vec3 uColor;\nuniform vec3 uColor2;\nuniform float uR;`,
  uniforms: { uColor: '#d8283a', uColor2: '#f2c84a', uR: 10 },
  params: { roughness: 0.28, envMapIntensity: 0.8 },
  glsl: /* glsl */ `
    float a = atan(p.z, p.x);
    vec3 d = normalize(p);
    float streak = nFbm(vec3(cos(a) * 9.0, sin(a) * 9.0, d.y * 1.2)) ;
    float red = smoothstep(0.1, 0.55, streak + 0.35 * (1.0 - abs(d.y)) + 0.15 * d.x);
    albedo = mix(uColor2, uColor, red);
    float pole = smoothstep(0.82, 0.97, d.y);
    albedo = mix(albedo, vec3(0.45, 0.55, 0.18), pole);
    vec3 g = p * 1.5;
    float dots = smoothstep(0.16, 0.1, length(fract(g) - 0.5)) * step(0.6, nHash(floor(g)));
    albedo = mix(albedo, vec3(1.0, 0.9, 0.7), dots * 0.5);
    rough = 0.26 + 0.1 * streak;
  `,
};

// Baked earth below, with a band round it, and soft soil on top, mossy here
// and there.
const pot = {
  head: `${NOISE}\nuniform vec3 uColor;\nuniform vec3 uColor2;\nuniform vec3 uMoss;`,
  uniforms: { uColor: '#c9673f', uColor2: '#e6a678', uMoss: '#7fb548' },
  params: { roughness: 0.85 },
  glsl: /* glsl */ `
    float soil = smoothstep(7.3, 7.7, p.y + nNoise(p * 1.4) * 0.5);
    float grain = nFbm(p * 2.2);
    vec3 clay = mix(uColor, uColor2, smoothstep(0.35, 0.7, nFbm(p * vec3(0.3, 1.6, 0.3))) * 0.5);
    clay *= 0.92 + 0.12 * grain;
    float zig = abs(fract(atan(p.z, p.x) * 3.8197) - 0.5) * 2.0;
    float band = smoothstep(0.12, 0.06, abs(p.y + 0.4 - zig * 0.9));
    clay = mix(clay, vec3(1.0, 0.94, 0.84), band * 0.85);
    vec3 earth = mix(vec3(0.24, 0.13, 0.08), vec3(0.4, 0.25, 0.15), grain);
    float moss = smoothstep(0.42, 0.6, nFbm(p * 0.45 + 9.0));
    vec3 green = mix(uMoss * 0.7, uMoss * 1.1, nNoise(p * 6.0));
    earth = mix(earth, green, moss);
    albedo = mix(clay, earth, soil);
    bend += nSlope(p * mix(3.0, 5.0, soil), 0.08) * mix(0.1, 0.35, soil);
    rough = 0.9;
    fuzz = 0.3 * soil;
  `,
};

// A snail's shell: bands winding round it.
const shell = {
  head: `${NOISE}\nuniform vec3 uColor;\nuniform vec3 uColor2;\nuniform vec3 uColor3;`,
  uniforms: { uColor: '#f3cf9a', uColor2: '#b8693f', uColor3: '#fff1dc' },
  params: { roughness: 0.32, envMapIntensity: 0.7 },
  glsl: /* glsl */ `
    float ang = atan(p.y, p.x);
    float rr = length(p.xy);
    float growth = sin(ang * 26.0 + rr * 2.0 + nNoise(p) * 2.0);
    float bands = smoothstep(-0.1, 0.25, sin(p.z * 1.9 + nNoise(p * 0.6) * 1.4 + rr * 0.35));
    albedo = mix(uColor, uColor2, bands * 0.8);
    albedo = mix(albedo, uColor3, smoothstep(0.5, 0.9, sin(p.z * 1.9 + 1.6 + rr * 0.35)) * 0.5);
    albedo *= 0.94 + 0.06 * growth;
    bend += vec3(-p.y, p.x, 0.0) / max(rr, 0.5) * growth * 0.12;
    rough = 0.3 + 0.1 * bands;
  `,
};

// A toadstool's cap: red above with white spots, gills below.
const cap = {
  head: `${NOISE}\nuniform vec3 uColor;\nuniform vec3 uSpot;\nuniform vec3 uGill;`,
  uniforms: { uColor: '#e8473f', uSpot: '#fff6e6', uGill: '#f3dcc0' },
  params: { roughness: 0.45, envMapIntensity: 0.5 },
  glsl: /* glsl */ `
    vec3 g = p * 0.42 + 0.3;
    vec3 id = floor(g);
    vec3 off = (vec3(nHash(id), nHash(id + 3.0), nHash(id + 7.0)) - 0.5) * 0.4;
    float spot = smoothstep(0.36, 0.3, length(fract(g) - 0.5 - off)) * step(0.35, nHash(id + 5.0));
    albedo = mix(uColor * (0.9 + 0.15 * nNoise(p * 1.2)), uSpot, spot);
    bend += nSlope(p * 1.1, 0.2) * 0.08;
    float under = smoothstep(0.1, -0.25, n.y);
    float a = atan(p.z, p.x);
    float gill = sin(a * 90.0);
    vec3 pale = uGill * (0.82 + 0.18 * gill);
    albedo = mix(albedo, pale, under);
    bend += vec3(-p.z, 0.0, p.x) / max(length(p.xz), 0.5) * gill * 0.3 * under;
    rough = mix(0.42, 0.95, max(spot, under));
    fuzz = 0.2;
  `,
};

// ---------------------------------------------------------------- the Music Box

// A drum: its heads pale hide with a star, its side lacquered, with gold cords.
const drum = {
  head: `${NOISE}\nuniform vec3 uColor;\nuniform vec3 uSkin;\nuniform vec3 uGold;\nuniform float uR;`,
  uniforms: { uColor: '#b3263f', uSkin: '#f6e7cf', uGold: '#f0c04a', uR: 8 },
  params: { roughness: 0.5, envMapIntensity: 0.6 },
  glsl: /* glsl */ `
    float flat_ = smoothstep(0.72, 0.85, abs(n.y));
    float r = length(p.xz);
    float a = atan(p.z, p.x);
    vec3 hide = uSkin * (0.92 + 0.1 * nFbm(p * 0.8));
    float star = r - uR * (0.42 + 0.1 * cos(a * 5.0));
    hide = mix(hide, uColor, smoothstep(0.1, -0.05, star) * 0.85);
    hide = mix(hide, uGold, smoothstep(0.14, 0.06, abs(star)) );
    float rim = smoothstep(0.5, 0.3, abs(r - uR * 1.12));
    hide = mix(hide, uGold, rim);
    float zig = abs(fract(a * 2.546) - 0.5) * 2.0;
    float cord = smoothstep(0.2, 0.1, abs(p.y - (zig - 0.5) * 3.0));
    vec3 side = mix(uColor * (0.85 + 0.25 * nNoise(vec3(a * 8.0, p.y * 0.6, 2.0))), uGold, cord);
    albedo = mix(side, hide, flat_);
    rough = mix(0.28, 0.8, flat_);
    ao *= 1.0 - 0.25 * rim * flat_;
    bend += nSlope(p * 2.0, 0.1) * 0.05;
  `,
};

// A gramophone record: fine grooves, light running round them, and a label.
const vinyl = {
  head: `${NOISE}\nuniform vec3 uColor;\nuniform vec3 uLabel;\nuniform vec3 uLabel2;\nuniform float uR;`,
  uniforms: { uColor: '#15131c', uLabel: '#e2543f', uLabel2: '#ffd98a', uR: 15 },
  params: { roughness: 0.3, envMapIntensity: 0.35 },
  glsl: /* glsl */ `
    float r = length(p.xz);
    float a = atan(p.z, p.x);
    float k = r / uR;
    float groove = sin(r * 26.0);
    float track = smoothstep(0.02, 0.0, abs(fract(k * 5.0) - 0.06) - 0.02);
    vec3 disc = uColor * (1.0 + 0.25 * groove * (1.0 - track));
    // The light runs round it in two fans.
    float fan = pow(abs(cos(a - uTime * 0.25)), 14.0) + pow(abs(cos(a - uTime * 0.25 + 0.7)), 30.0) * 0.6;
    disc += vec3(0.5, 0.42, 0.75) * fan * 0.16 * (0.6 + 0.4 * groove);
    float lab = smoothstep(0.31, 0.3, k);
    vec3 label = mix(uLabel, uLabel2, smoothstep(0.02, 0.0, abs(k - 0.26) - 0.008));
    label = mix(label, uLabel2, smoothstep(0.05, 0.02, abs(abs(p.x) - 1.4)) * step(abs(p.z), 2.2));
    label = mix(label, vec3(0.1), smoothstep(0.035, 0.03, k));
    albedo = mix(disc, label, lab);
    vec3 out_ = vec3(p.x, 0.0, p.z) / max(r, 0.1);
    bend += out_ * cos(r * 26.0) * 0.22 * (1.0 - lab) * step(0.6, abs(n.y));
    rough = mix(0.34, 0.6, lab);
    glow = vec3(0.3, 0.2, 0.55) * fan * 0.05 * (1.0 - lab);
  `,
};

// Polished brass, engraved with a running pattern, dark in its folds.
const brass = {
  head: `${NOISE}\nuniform vec3 uColor;\nuniform vec3 uDark;\nuniform float uEngrave;`,
  uniforms: { uColor: '#e2b04e', uDark: '#7a5220', uEngrave: 1 },
  params: { roughness: 0.34, metalness: 0.35, envMapIntensity: 0.7 },
  glsl: /* glsl */ `
    float a = atan(p.z, p.x);
    vec3 an = abs(n);
    vec2 q = an.y > 0.7 ? vec2(length(p.xz), a * 6.0) : vec2(p.y, a * length(p.xz));
    float wave = sin(q.y * 1.1 + sin(q.x * 1.3) * 1.5);
    float cut = smoothstep(0.1, 0.0, abs(wave) - 0.05) * uEngrave;
    float scroll = smoothstep(0.12, 0.0, abs(length(fract(q * 0.35) - 0.5) - 0.28) - 0.02) * uEngrave;
    float lines = max(cut, scroll) * smoothstep(0.35, 0.6, nNoise(p * 0.25 + 3.0));
    float worn = nFbm(p * 0.9);
    albedo = mix(uColor, uColor * 1.15, worn);
    albedo = mix(albedo, uDark, lines * 0.65 + (1.0 - ao) * 0.5);
    rough = 0.3 + 0.22 * worn + lines * 0.3;
    bend += nSlope(p * 2.4, 0.1) * 0.04;
  `,
};

// Piano keys, all round a ring: white and black, each lit as it is trodden on.
const keys = {
  head: `${NOISE}\nuniform vec3 uColor;\nuniform vec3 uBlack;\nuniform float uR;\nuniform float uPressed[12];`,
  uniforms: { uColor: '#efe6d4', uBlack: '#1d1826', uR: 13, uPressed: Array.from({ length: 12 }, () => 0) },
  params: { roughness: 0.22, envMapIntensity: 0.9 },
  glsl: /* glsl */ `
    float a = atan(p.z, p.x) / 6.2831853 + 0.5;
    float wk = a * 42.0;
    float id = floor(wk);
    float f = fract(wk);
    float oct = mod(id, 7.0);
    float gap = smoothstep(0.04, 0.015, min(f, 1.0 - f));
    vec3 c = uColor * (0.97 + 0.03 * nNoise(p * 0.5));
    albedo = mix(c, vec3(0.35, 0.3, 0.4), gap);
    ao *= 1.0 - 0.4 * gap;
    // The black keys, on the upper half, between the whites (but E and F, B and C).
    float side = smoothstep(0.1, 0.16, n.y);
    float near_ = abs(fract(wk + 0.5) - 0.5);
    float left = mod(floor(wk + 0.5), 7.0);
    float has = 1.0 - step(0.5, 1.0 - abs(sign(left - 0.0))) ;
    has *= 1.0 - step(abs(left - 3.0), 0.1);
    float black = side * has * smoothstep(0.31, 0.27, near_);
    albedo = mix(albedo, uBlack, black);
    bend += vec3(-p.z, 0.0, p.x) / max(length(p.xz), 0.5) * (f - 0.5) * 0.22 * (1.0 - black);
    float lit = uPressed[int(mod(id, 12.0))];
    vec3 hue = 0.5 + 0.5 * cos(6.2831853 * (id / 12.0 + vec3(0.0, 0.33, 0.67)));
    albedo = mix(albedo, hue, lit * 0.6 * (1.0 - black));
    glow = hue * lit * 0.7 * (1.0 - black);
    rough = mix(0.22, 0.16, black);
  `,
};

// Red velvet, nap and folds, with a gold border.
const velvet = {
  head: `${NOISE}\nuniform vec3 uColor;\nuniform vec3 uGold;\nuniform float uR;`,
  uniforms: { uColor: '#8a1830', uGold: '#f0c04a', uR: 13 },
  params: { roughness: 1 },
  glsl: /* glsl */ `
    float r = length(p.xz);
    float a = atan(p.z, p.x);
    albedo = uColor * (0.8 + 0.4 * nFbm(p * vec3(1.6, 1.0, 1.6)));
    float edge = abs(r - uR * 0.9);
    float trim = smoothstep(0.3, 0.2, edge) * step(0.6, abs(n.y));
    float ray = smoothstep(0.96, 0.99, abs(cos(a * 8.0))) * smoothstep(uR * 0.3, uR * 0.35, r) * smoothstep(uR * 0.84, uR * 0.8, r) * step(0.6, abs(n.y));
    float ring = smoothstep(0.2, 0.1, abs(r - uR * 0.28)) * step(0.6, abs(n.y));
    float gold = max(trim, max(ray * 0.7, ring));
    albedo = mix(albedo, uGold, gold);
    rough = mix(1.0, 0.35, gold);
    bend += nSlope(p * 2.6, 0.1) * 0.14;
    fuzz = 1.1 * (1.0 - gold);
  `,
};

// ---------------------------------------------------------------- Tick-Tock Skies

// A clock's face: enamel, its hours in gold, its minutes round the rim.
const dial = {
  head: `${NOISE}\nuniform vec3 uColor;\nuniform vec3 uInk;\nuniform vec3 uGold;\nuniform float uR;`,
  uniforms: { uColor: '#eadfc6', uInk: '#2b2440', uGold: '#e0b04a', uR: 15 },
  params: { roughness: 0.3, envMapIntensity: 0.6 },
  glsl: /* glsl */ `
    float r = length(p.xz);
    float a = atan(p.z, p.x);
    float k = r / uR;
    float face = smoothstep(0.7, 0.85, abs(n.y));
    vec3 c = uColor * (0.96 + 0.06 * nFbm(p * 0.4));
    // A sunburst in the middle of it.
    c = mix(c, uColor * 0.93 + vec3(0.06, 0.04, 0.0), smoothstep(-0.2, 0.6, sin(a * 48.0)) * smoothstep(0.5, 0.2, k) * 0.6);
    float m = abs(fract(a * 9.5493) - 0.5);
    float minute = smoothstep(0.4, 0.46, m) * smoothstep(0.02, 0.0, abs(k - 0.9) - 0.025);
    float h5 = abs(fract(a * 1.90986) - 0.5);
    float hour = smoothstep(0.455, 0.47, h5) * smoothstep(0.02, 0.0, abs(k - 0.74) - 0.085);
    float hour2 = smoothstep(0.4, 0.415, h5) * smoothstep(0.43, 0.42, h5) * smoothstep(0.02, 0.0, abs(k - 0.74) - 0.06);
    float rings = smoothstep(0.012, 0.004, abs(k - 0.94)) + smoothstep(0.01, 0.003, abs(k - 0.6)) + smoothstep(0.012, 0.004, abs(k - 0.36));
    c = mix(c, uInk, clamp(minute + hour + hour2, 0.0, 1.0));
    c = mix(c, uGold, clamp(rings, 0.0, 1.0));
    float rim = smoothstep(0.96, 1.0, k);
    c = mix(c, uGold, max(rim, 1.0 - face));
    albedo = c;
    rough = mix(0.28, 0.35, face);
    ao *= 1.0 - 0.2 * clamp(rings, 0.0, 1.0);
  `,
};

// Glass with sand in it.
const sandglass = {
  head: `${NOISE}\nuniform vec3 uColor;\nuniform vec3 uSand;`,
  uniforms: { uColor: '#a9dfe6', uSand: '#f2cd8a' },
  params: { roughness: 0.14, envMapIntensity: 0.8 },
  glsl: /* glsl */ `
    float fall = nNoise(vec3(p.x * 3.0, p.y * 1.5 + uTime * 2.4, p.z * 3.0));
    float low = smoothstep(-6.0 + sin(atan(p.z, p.x) * 3.0) * 0.6, -7.0, p.y);
    float high = smoothstep(12.0, 10.0, p.y) * smoothstep(1.0, 2.0, p.y);
    float run = smoothstep(2.4, 1.6, length(p.xz)) * smoothstep(-7.0, 2.0, p.y) * step(p.y, 3.0);
    float sand = clamp(low + high + run * fall, 0.0, 1.0);
    float grain = nNoise(p * 9.0);
    albedo = mix(uColor * 0.62, uSand * (0.72 + 0.22 * grain), sand * 0.85);
    rough = 0.16;
    glow = uColor * 0.03;
  `,
};

// ---------------------------------------------------------------- the Dark Side

// Black rock, cracked, with something glowing deep in the cracks.
const dusk = {
  head: `${NOISE}\nuniform vec3 uColor;\nuniform vec3 uColor2;\nuniform vec3 uGlow;\nuniform float uCracks;`,
  uniforms: { uColor: '#2b2447', uColor2: '#453a6e', uGlow: '#b45cff', uCracks: 1 },
  params: { roughness: 0.75, envMapIntensity: 0.4 },
  glsl: /* glsl */ `
    float big = nFbm(p * 0.28);
    float small_ = nFbm(p * 1.4);
    albedo = mix(uColor, uColor2, smoothstep(0.3, 0.7, big * 0.6 + small_ * 0.4));
    vec3 q = p * 0.34 + vec3(nNoise(p * 0.7), nNoise(p * 0.7 + 9.0), nNoise(p * 0.7 + 17.0)) * 0.5;
    float v = abs(nNoise(q * 2.0) - 0.5);
    float crack = smoothstep(0.035, 0.0, v) * uCracks;
    float pulse = 0.55 + 0.45 * sin(uTime * 1.4 + p.x * 0.5 + p.y * 0.4);
    glow = uGlow * crack * pulse * 0.9;
    albedo = mix(albedo, uGlow * 0.4, smoothstep(0.1, 0.0, v) * 0.4 * uCracks);
    vec3 g = p * 2.2;
    float star = smoothstep(0.1, 0.0, length(fract(g) - 0.5)) * step(0.93, nHash(floor(g)));
    glow += vec3(0.8, 0.85, 1.0) * star * (0.5 + 0.5 * sin(uTime * 3.0 + nHash(floor(g)) * 60.0));
    bend += nSlope(p * 1.4, 0.15) * 0.45 + nSlope(p * 4.5, 0.06) * 0.12;
    rough = 0.65 + 0.25 * small_;
    ao *= 1.0 - 0.35 * crack;
  `,
};

// A ribbon of night sky: deep satin with stars in it, its edges bright.
const satin = {
  head: `${NOISE}\nuniform vec3 uColor;\nuniform vec3 uColor2;\nuniform vec3 uGlow;`,
  uniforms: { uColor: '#3b2a78', uColor2: '#7a3fa8', uGlow: '#ff9fe0' },
  params: { roughness: 0.35, envMapIntensity: 0.9 },
  glsl: /* glsl */ `
    float a = atan(p.z, p.x);
    float run = sin(a * 14.0 + p.y * 0.8) * 0.5 + 0.5;
    albedo = mix(uColor, uColor2, run * 0.7 + 0.3 * nFbm(p * 0.5));
    vec3 g = p * 1.5;
    float star = smoothstep(0.13, 0.0, length(fract(g) - 0.5)) * step(0.82, nHash(floor(g)));
    glow = uGlow * star * (0.6 + 0.4 * sin(uTime * 2.0 + nHash(floor(g)) * 40.0)) * 0.9;
    float weave = sin(p.x * 30.0) * sin(p.z * 30.0) * sin(p.y * 30.0);
    bend += nSlope(p * 0.9, 0.2) * 0.25 + vec3(weave) * 0.02;
    rough = 0.3 + 0.15 * run;
    fuzz = 0.5;
  `,
};

export const SKINS = { quilt, cord, knit, plain, rind, plant, apple, pot, shell, cap, drum, vinyl, brass, keys, velvet, dial, sandglass, dusk, satin };
