// The pictures the Wild Isle is drawn with (render/real.js): what real ground,
// rock, sand, snow, stone walls, planks and bark look like close up, each a
// square that tiles seamlessly, painted once on the GPU from noise when the
// first real island is seen, and kept for every one after. Each material is
// a layer of two arrays: its colour (and in alpha, how high each spot of it
// stands, for blending one into the next), and the way its surface faces (a
// normal, from those heights), how rough it is and how far into a crevice.
//
// The leaves, needles, fronds, thorns and flowers of its plants are painted
// on canvases, each a card with its see-through parts (FOLIAGE).
import * as THREE from '../../vendor/three.module.js';

export const MATERIALS = ['grass', 'forest', 'dirt', 'sand', 'rock', 'gravel', 'snow', 'gloom', 'masonry', 'planks', 'bark', 'hay', 'plaster', 'water', 'birch', 'thatch', 'noise'];
export const MAT = Object.fromEntries(MATERIALS.map((k, i) => [k, i]));
const SIZE = 512;

const NOISE = /* glsl */ `
  float hash12(vec2 p) {
    vec3 p3 = fract(vec3(p.xyx) * 0.1031);
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.x + p3.y) * p3.z);
  }
  vec2 hash22(vec2 p) {
    vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973));
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.xx + p3.yz) * p3.zy);
  }
  // Gradient noise that repeats every per cells (so a square of it tiles).
  float gnoise(vec2 p, vec2 per) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
    vec2 a = hash22(mod(i, per)) * 2.0 - 1.0;
    vec2 b = hash22(mod(i + vec2(1.0, 0.0), per)) * 2.0 - 1.0;
    vec2 c = hash22(mod(i + vec2(0.0, 1.0), per)) * 2.0 - 1.0;
    vec2 d = hash22(mod(i + vec2(1.0, 1.0), per)) * 2.0 - 1.0;
    return mix(mix(dot(a, f), dot(b, f - vec2(1.0, 0.0)), u.x), mix(dot(c, f - vec2(0.0, 1.0)), dot(d, f - vec2(1.0, 1.0)), u.x), u.y) * 1.4;
  }
  // Fractal sums of it over the square (uv 0 to 1), from base cells across.
  float fbm(vec2 uv, float base, int oct) {
    float s = 0.0;
    float a = 0.5;
    float n = 0.0;
    float f = base;
    for (int i = 0; i < 8; i++) {
      if (i >= oct) break;
      s += a * gnoise(uv * f + float(i) * 17.31, vec2(f));
      n += a;
      a *= 0.5;
      f *= 2.0;
    }
    return s / n;
  }
  float ridged(vec2 uv, float base, int oct) {
    float s = 0.0;
    float a = 0.5;
    float n = 0.0;
    float f = base;
    for (int i = 0; i < 8; i++) {
      if (i >= oct) break;
      s += a * (1.0 - abs(gnoise(uv * f + float(i) * 7.7, vec2(f))));
      n += a;
      a *= 0.5;
      f *= 2.0;
    }
    return s / n;
  }
  // Cells (Worley), n across: the nearest and next-nearest distances, and
  // a number for the nearest cell.
  vec3 worley(vec2 uv, float n, float jitter) {
    vec2 p = uv * n;
    vec2 i = floor(p);
    vec2 f = fract(p);
    float d1 = 8.0;
    float d2 = 8.0;
    vec2 id = vec2(0.0);
    for (int y = -1; y <= 1; y++) {
      for (int x = -1; x <= 1; x++) {
        vec2 g = vec2(float(x), float(y));
        vec2 c = mod(i + g, n);
        vec2 o = 0.5 + (hash22(c) - 0.5) * jitter;
        vec2 r = g + o - f;
        float d = dot(r, r);
        if (d < d1) {
          d2 = d1;
          d1 = d;
          id = c;
        } else if (d < d2) d2 = d;
      }
    }
    return vec3(sqrt(d1), sqrt(d2), hash12(id + 0.37));
  }
  vec3 rgb(float r, float g, float b) { return vec3(r, g, b) / 255.0; }
  vec3 rgb(int r, int g, int b) { return vec3(float(r), float(g), float(b)) / 255.0; }
`;

// Each material: its colour (in sRGB), height (0 to 1) and roughness at uv.
const RECIPES = /* glsl */ `
  struct M { vec3 c; float h; float r; };

  // Grass seen from above: blades every way, greens and straw, dark between.
  M grass(vec2 uv) {
    float patches = fbm(uv, 3.0, 4);
    float h = 0.0;
    vec3 col = vec3(0.0);
    // Blades as short strokes on cells of several sizes and slants.
    for (int k = 0; k < 4; k++) {
      float n = 34.0 + float(k) * 13.0;
      vec2 p = uv * n;
      vec2 cell = floor(p);
      vec2 f = fract(p) - 0.5;
      float best = 0.0;
      vec3 bc = vec3(0.0);
      for (int y = -1; y <= 1; y++) {
        for (int x = -1; x <= 1; x++) {
          vec2 g = vec2(float(x), float(y));
          vec2 id = mod(cell + g, n);
          vec2 o = hash22(id + float(k) * 3.1) - 0.5;
          float ang = hash12(id * 1.7 + float(k)) * 6.2831;
          vec2 dir = vec2(cos(ang), sin(ang));
          vec2 r = f - g - o;
          float along = dot(r, dir);
          float across = dot(r, vec2(-dir.y, dir.x));
          float len = 0.55 + hash12(id + 9.1) * 0.5;
          float t = clamp(along / len + 0.5, 0.0, 1.0);
          float w = 0.09 * (1.0 - t * 0.85);
          float blade = smoothstep(w, w * 0.3, abs(across)) * step(abs(along), len * 0.5);
          float hh = blade * (0.35 + t * 0.65);
          if (hh > best) {
            best = hh;
            float tone = hash12(id + 4.4);
            vec3 green = mix(rgb(62, 98, 34), rgb(112, 150, 52), tone);
            vec3 dry = mix(rgb(150, 145, 78), rgb(176, 160, 96), tone);
            bc = mix(green, dry, smoothstep(0.82, 0.97, hash12(id + 2.2)) * 0.8 + smoothstep(0.3, 0.6, patches) * 0.2) * (0.75 + t * 0.4);
          }
        }
      }
      if (best > h) {
        h = best;
        col = bc;
      }
    }
    vec3 soil = mix(rgb(44, 40, 26), rgb(60, 70, 32), fbm(uv, 12.0, 3) * 0.5 + 0.5);
    col = mix(soil, col, smoothstep(0.02, 0.25, h));
    col *= 0.88 + patches * 0.25;
    return M(col, h * 0.8 + fbm(uv, 6.0, 3) * 0.1, 0.88);
  }

  // A forest floor: dark earth, fallen needles and leaves, and moss.
  M forest(vec2 uv) {
    float moss = smoothstep(-0.05, 0.25, fbm(uv, 4.0, 5));
    vec3 earth = mix(rgb(52, 38, 26), rgb(78, 58, 38), fbm(uv, 16.0, 3) * 0.5 + 0.5);
    float h = 0.3 + fbm(uv, 8.0, 4) * 0.2;
    vec3 col = earth;
    // Needles: thin strokes, reddish brown.
    for (int k = 0; k < 3; k++) {
      float n = 22.0 + float(k) * 9.0;
      vec2 p = uv * n;
      vec2 cell = floor(p);
      vec2 f = fract(p) - 0.5;
      for (int y = -1; y <= 1; y++) {
        for (int x = -1; x <= 1; x++) {
          vec2 g = vec2(float(x), float(y));
          vec2 id = mod(cell + g, n);
          vec2 o = hash22(id + float(k) * 5.0) - 0.5;
          float ang = hash12(id + float(k)) * 6.2831;
          vec2 dir = vec2(cos(ang), sin(ang));
          vec2 r = f - g - o;
          float along = abs(dot(r, dir));
          float across = abs(dot(r, vec2(-dir.y, dir.x)));
          float needle = smoothstep(0.035, 0.0, across) * step(along, 0.6);
          if (needle > 0.3) {
            float tone = hash12(id + 7.0);
            col = mix(col, mix(rgb(110, 62, 34), rgb(160, 112, 62), tone), needle);
            h = max(h, 0.45 + needle * 0.3);
          }
        }
      }
    }
    // A few leaves: little dark ovals.
    vec3 w = worley(uv, 14.0, 0.9);
    float leaf = smoothstep(0.28, 0.2, w.x) * step(0.72, w.z);
    col = mix(col, mix(rgb(96, 70, 30), rgb(70, 48, 24), w.z), leaf);
    h = max(h, leaf * 0.6);
    vec3 mosscol = mix(rgb(54, 84, 30), rgb(96, 122, 44), fbm(uv, 24.0, 3) * 0.5 + 0.5);
    col = mix(col, mosscol, moss * 0.85);
    h = mix(h, 0.55 + fbm(uv, 40.0, 2) * 0.2, moss);
    return M(col, h, 0.92);
  }

  // Bare earth: brown, lumpy, with small stones and a crack or two.
  M dirt(vec2 uv) {
    float n = fbm(uv, 5.0, 6);
    vec3 col = mix(rgb(84, 62, 42), rgb(128, 98, 68), n * 0.5 + 0.5);
    col *= 0.9 + fbm(uv, 28.0, 3) * 0.14;
    float h = 0.38 + n * 0.18 + fbm(uv, 28.0, 2) * 0.05;
    vec3 w = worley(uv, 26.0, 1.0);
    float stone = smoothstep(0.26, 0.14, w.x) * step(0.72, w.z);
    col = mix(col, mix(rgb(104, 96, 84), rgb(142, 132, 116), fract(w.z * 13.0)), stone);
    h = max(h, 0.4 + stone * (0.35 - w.x));
    float crack = smoothstep(0.93, 0.985, ridged(uv + 0.17, 5.0, 3)) * smoothstep(0.0, 0.3, fbm(uv, 3.0, 2) + 0.15);
    col *= 1.0 - crack * 0.4;
    h -= crack * 0.2;
    return M(col, h, 0.95);
  }

  // Sand: fine grains, pale, with ripples the wind left.
  M sand(vec2 uv) {
    float warp = fbm(uv, 3.0, 3);
    float ripple = sin((uv.y * 22.0 + warp * 2.5 + fbm(uv, 6.0, 2) * 0.6) * 6.2831);
    float grain = hash12(floor(uv * 512.0)) - 0.5;
    vec3 col = mix(rgb(196, 176, 136), rgb(226, 210, 172), fbm(uv, 5.0, 4) * 0.5 + 0.5);
    col *= 1.0 + grain * 0.12 + ripple * 0.03;
    // Darker grains here and there.
    col = mix(col, rgb(120, 104, 84), step(0.985, hash12(floor(uv * 512.0) + 3.3)) * 0.6);
    return M(col, 0.5 + ripple * 0.08 + grain * 0.06 + warp * 0.1, 0.9);
  }

  // Rock: grey, in big weathered forms, layered, fine cracks, lichen.
  M rock(vec2 uv) {
    vec2 p = uv + vec2(fbm(uv, 3.0, 4), fbm(uv + 5.2, 3.0, 4)) * 0.06;
    float big = fbm(p, 2.0, 6);
    float crease = ridged(p, 5.0, 5);
    float strata = sin((p.y * 6.0 + big * 1.8) * 6.2831) * 0.5 + 0.5;
    float cracks = smoothstep(0.9, 0.975, ridged(p * vec2(1.0, 1.4) + 0.3, 4.0, 3));
    float fine = fbm(p, 24.0, 3);
    float h = 0.45 + big * 0.32 + crease * 0.16 + strata * 0.06 - cracks * 0.28 + fine * 0.05;
    vec3 col = mix(rgb(78, 76, 72), rgb(162, 156, 146), clamp(0.5 + big * 0.75 + crease * 0.15 + fine * 0.15, 0.0, 1.0));
    col *= 0.93 + strata * 0.09;
    col = mix(col, col * rgb(255, 228, 196), smoothstep(0.2, 0.6, fbm(p + 2.1, 4.0, 3)) * 0.35);
    col *= 1.0 - cracks * 0.55;
    float lichen = smoothstep(0.42, 0.62, fbm(uv + 3.7, 6.0, 5)) * smoothstep(0.45, 0.6, h);
    col = mix(col, mix(rgb(156, 154, 98), rgb(112, 122, 76), fbm(uv, 20.0, 2) * 0.5 + 0.5), lichen * 0.5);
    return M(col, h, 0.82 - lichen * 0.08);
  }

  // A gravel path: little stones packed in earth.
  M gravel(vec2 uv) {
    vec3 col = rgb(112, 98, 80);
    float h = 0.2;
    for (int k = 0; k < 2; k++) {
      vec3 w = worley(uv + float(k) * 0.37, 26.0 + float(k) * 16.0, 1.0);
      float stone = smoothstep(0.42, 0.25, w.x);
      float dome = sqrt(max(0.0, 1.0 - w.x * w.x / 0.18));
      float hh = stone * (0.45 + dome * 0.45) - float(k) * 0.08;
      if (hh > h) {
        h = hh;
        float tone = w.z;
        col = mix(mix(rgb(120, 114, 104), rgb(176, 168, 152), tone), rgb(140, 116, 90), step(0.75, fract(tone * 7.0)) * 0.6) * (0.7 + dome * 0.4);
      }
    }
    col *= 0.92 + fbm(uv, 5.0, 3) * 0.12;
    return M(col, h, 0.9);
  }

  // Snow: white, blue in its hollows, softly drifted, glinting.
  M snow(vec2 uv) {
    float n = fbm(uv, 3.0, 5);
    float h = 0.5 + n * 0.35;
    vec3 col = mix(rgb(196, 210, 228), rgb(246, 248, 252), smoothstep(-0.3, 0.4, n));
    float glint = step(0.996, hash12(floor(uv * 512.0)));
    col += glint * 0.25;
    return M(col, h, 0.55 - glint * 0.3);
  }

  // The fog's ground round a camp: grass gone grey and dead over dark mud.
  M gloom(vec2 uv) {
    M g = grass(uv);
    float n = fbm(uv, 4.0, 5);
    vec3 dead = vec3(dot(g.c, vec3(0.35, 0.45, 0.2))) * rgb(240, 222, 196) * 1.9;
    vec3 mud = mix(rgb(78, 70, 64), rgb(112, 102, 92), fbm(uv, 14.0, 3) * 0.5 + 0.5);
    float bare = smoothstep(-0.1, 0.35, n);
    vec3 col = mix(dead, mud, bare * 0.7);
    return M(col, mix(g.h, 0.25 + n * 0.15, bare), mix(0.9, 0.55, bare));
  }

  // A wall of stones in courses, mortar between them.
  M masonry(vec2 uv) {
    vec2 p = uv * vec2(4.0, 8.0);
    float row = floor(p.y);
    p.x += hash12(vec2(row, 1.0)) * 0.5 + mod(row, 2.0) * 0.5;
    // Some stones are two lengths long.
    vec2 cell = floor(p);
    vec2 f = fract(p);
    vec2 id = vec2(mod(cell.x, 4.0), mod(row, 8.0));
    float tone = hash12(id + 0.5);
    float edge = min(min(f.x, 1.0 - f.x) * 2.0, min(f.y, 1.0 - f.y));
    float mortar = smoothstep(0.025, 0.07, edge + fbm(uv, 16.0, 3) * 0.03);
    float bulge = sqrt(clamp(edge * 4.0, 0.0, 1.0));
    float rough = fbm(uv + tone, 12.0, 4);
    vec3 stone = mix(rgb(120, 114, 104), rgb(176, 168, 154), tone) * (0.85 + rough * 0.25);
    stone = mix(stone, stone * vec3(0.95, 1.0, 0.85), smoothstep(0.3, 0.7, fbm(uv, 5.0, 3)) * 0.4);
    vec3 col = mix(rgb(96, 92, 84), stone, mortar);
    float h = mortar * (0.55 + bulge * 0.3 + rough * 0.15);
    return M(col, h, 0.9);
  }

  // Planks side by side, grain along them, a gap between each.
  M planks(vec2 uv) {
    float boards = 4.0;
    float b = floor(uv.x * boards);
    float fx = fract(uv.x * boards);
    float shift = hash12(vec2(b, 3.0));
    float v = uv.y + shift;
    float seg = floor(v * 1.0);
    vec2 id = vec2(b, seg);
    float tone = hash12(id);
    float grain = fbm(vec2(fx * 0.25 + b * 0.25, v * 0.25), 4.0, 3) * 0.5 + 0.5;
    float lines = sin((fx * 3.0 + gnoise(vec2(fx * 2.0, v * 18.0), vec2(8.0, 18.0)) * 0.8) * 18.0) * 0.5 + 0.5;
    vec3 col = mix(rgb(118, 82, 52), rgb(164, 120, 78), tone) * (0.8 + lines * 0.15 + grain * 0.15);
    float gap = smoothstep(0.0, 0.04, fx) * smoothstep(1.0, 0.96, fx) * smoothstep(0.0, 0.01, fract(v)) * smoothstep(1.0, 0.99, fract(v));
    col *= 0.3 + gap * 0.7;
    float knot = smoothstep(0.08, 0.0, length((vec2(fx, fract(v * 2.0)) - hash22(id)) * vec2(1.0, 3.0))) * step(0.6, tone);
    col = mix(col, rgb(70, 46, 28), knot);
    return M(col, gap * (0.6 + lines * 0.1), 0.8);
  }

  // Bark: furrows up and down, grey-brown.
  M bark(vec2 uv) {
    float warp = fbm(uv, 4.0, 3);
    vec3 w = worley(vec2(uv.x * 1.0, uv.y * 0.25) + warp * 0.08, 10.0, 1.0);
    float ridge = smoothstep(0.0, 0.35, w.y - w.x);
    float n = fbm(uv * vec2(1.0, 0.5), 8.0, 4);
    vec3 col = mix(rgb(58, 46, 36), rgb(108, 92, 76), ridge * 0.8 + n * 0.2);
    col = mix(col, rgb(88, 98, 72), smoothstep(0.4, 0.7, fbm(uv, 3.0, 3)) * 0.35);
    return M(col, 0.2 + ridge * 0.7 + n * 0.1, 0.9);
  }

  // Straw: yellow strokes every which way, mostly along.
  M hay(vec2 uv) {
    vec3 col = rgb(150, 118, 52);
    float h = 0.2;
    for (int k = 0; k < 3; k++) {
      float n = 18.0 + float(k) * 8.0;
      vec2 p = uv * n;
      vec2 cell = floor(p);
      vec2 f = fract(p) - 0.5;
      for (int y = -1; y <= 1; y++) {
        for (int x = -1; x <= 1; x++) {
          vec2 g = vec2(float(x), float(y));
          vec2 id = mod(cell + g, n);
          vec2 o = hash22(id + float(k)) - 0.5;
          float ang = 1.2 + (hash12(id + 3.0) - 0.5) * 1.0;
          vec2 dir = vec2(cos(ang), sin(ang));
          vec2 r = f - g - o;
          float across = abs(dot(r, vec2(-dir.y, dir.x)));
          float along = abs(dot(r, dir));
          float s = smoothstep(0.06, 0.0, across) * step(along, 1.1);
          if (s > 0.2 && 0.4 + s * 0.4 > h) {
            h = 0.4 + s * 0.4;
            col = mix(rgb(196, 160, 82), rgb(232, 204, 120), hash12(id + 5.0)) * (0.8 + s * 0.3);
          }
        }
      }
    }
    return M(col, h, 0.85);
  }

  // Whitewash over stone: a lighthouse's, a cottage's.
  M plaster(vec2 uv) {
    float n = fbm(uv, 4.0, 5);
    vec3 col = mix(rgb(208, 204, 196), rgb(240, 238, 232), n * 0.5 + 0.5);
    float stain = smoothstep(0.2, 0.6, fbm(uv + 1.3, 3.0, 4)) * smoothstep(0.3, 0.0, fract(uv.y * 2.0));
    col = mix(col, col * rgb(200, 190, 170), stain * 0.4);
    return M(col, 0.5 + n * 0.1, 0.85);
  }

  // Ripples on water (only its heights count: they make the waves' normals).
  M water(vec2 uv) {
    float h = 0.0;
    float a = 0.5;
    for (int i = 0; i < 4; i++) {
      float f = 3.0 * pow(2.0, float(i));
      h += a * (1.0 - abs(gnoise(uv * f + float(i) * 4.1, vec2(f))));
      a *= 0.5;
    }
    return M(vec3(0.5), h * 0.6, 0.0);
  }

  // A birch's bark: white, with black marks across it.
  M birch(vec2 uv) {
    float n = fbm(uv, 4.0, 4);
    vec3 col = mix(rgb(206, 204, 196), rgb(236, 234, 228), n * 0.5 + 0.5);
    vec2 p = vec2(uv.x * 3.0, uv.y * 14.0);
    vec2 cell = floor(p);
    vec2 f = fract(p);
    float mark = step(0.62, hash12(mod(cell, vec2(3.0, 14.0)))) * smoothstep(0.5, 0.2, abs(f.y - 0.5) * (1.0 + abs(f.x - 0.5) * 3.0));
    col = mix(col, rgb(40, 38, 36), mark);
    col = mix(col, rgb(150, 140, 120), smoothstep(0.5, 0.8, fbm(uv, 8.0, 3)) * 0.3);
    return M(col, 0.6 - mark * 0.3 + n * 0.1, 0.8);
  }

  // Reed thatch on a roof.
  M thatch(vec2 uv) {
    M h = hay(vec2(uv.y, uv.x));
    float rows = smoothstep(0.0, 0.2, fract(uv.y * 6.0));
    return M(h.c * mix(rgb(150, 136, 110), vec3(1.0), 0.4) * (0.6 + rows * 0.4), h.h * rows, 0.95);
  }

  // Noise to draw clouds and big patches with (its height).
  M noise(vec2 uv) {
    float a = fbm(uv, 3.0, 7) * 0.5 + 0.5;
    return M(vec3(fbm(uv, 2.0, 5) * 0.5 + 0.5), clamp((a - 0.5) * 1.6 + 0.5, 0.0, 1.0), 1.0);
  }

  M recipe(int layer, vec2 uv) {
    if (layer == 0) return grass(uv);
    if (layer == 1) return forest(uv);
    if (layer == 2) return dirt(uv);
    if (layer == 3) return sand(uv);
    if (layer == 4) return rock(uv);
    if (layer == 5) return gravel(uv);
    if (layer == 6) return snow(uv);
    if (layer == 7) return gloom(uv);
    if (layer == 8) return masonry(uv);
    if (layer == 9) return planks(uv);
    if (layer == 10) return bark(uv);
    if (layer == 11) return hay(uv);
    if (layer == 12) return plaster(uv);
    if (layer == 13) return water(uv);
    if (layer == 14) return birch(uv);
    if (layer == 15) return thatch(uv);
    return noise(uv);
  }
`;

const PAINT_VERT = 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }';
// pass 0: colour and height; pass 1: normal, roughness and crevices.
const PAINT_FRAG = /* glsl */ `
  uniform int uLayer;
  uniform int uPass;
  uniform float uTexel;
  varying vec2 vUv;
  ${NOISE}
  ${RECIPES}
  void main() {
    vec2 uv = vUv;
    M m = recipe(uLayer, uv);
    if (uPass == 0) {
      gl_FragColor = vec4(clamp(m.c, 0.0, 1.0), clamp(m.h, 0.0, 1.0));
      return;
    }
    float e = uTexel;
    float hx = recipe(uLayer, fract(uv + vec2(e, 0.0))).h - recipe(uLayer, fract(uv - vec2(e, 0.0))).h;
    float hy = recipe(uLayer, fract(uv + vec2(0.0, e))).h - recipe(uLayer, fract(uv - vec2(0.0, e))).h;
    float bumpy = uLayer == 13 ? 6.0 : 4.0;
    vec3 n = normalize(vec3(-hx * bumpy, -hy * bumpy, 1.0));
    float cavity = clamp(0.55 + m.h * 0.6, 0.0, 1.0);
    gl_FragColor = vec4(n.xy * 0.5 + 0.5, m.r, cavity);
  }
`;

let made = null;

// The materials' two arrays, made with the renderer the first time they are
// wanted: { albedo, normal } (DataArrayTextures, a layer each, MAT their order).
export function realMaterials(gl) {
  if (made) return made;
  const target = new THREE.WebGLRenderTarget(SIZE, SIZE, { depthBuffer: false });
  const mat = new THREE.ShaderMaterial({
    uniforms: { uLayer: { value: 0 }, uPass: { value: 0 }, uTexel: { value: 1 / SIZE } },
    vertexShader: PAINT_VERT,
    fragmentShader: PAINT_FRAG,
    depthTest: false,
    depthWrite: false,
  });
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat);
  const scene = new THREE.Scene();
  scene.add(quad);
  const cam = new THREE.Camera();
  const count = MATERIALS.length;
  const albedo = new Uint8Array(SIZE * SIZE * 4 * count);
  const normal = new Uint8Array(SIZE * SIZE * 4 * count);
  const before = gl.getRenderTarget();
  const tone = gl.toneMapping;
  gl.toneMapping = THREE.NoToneMapping;
  for (let layer = 0; layer < count; layer++) {
    for (const pass of [0, 1]) {
      mat.uniforms.uLayer.value = layer;
      mat.uniforms.uPass.value = pass;
      gl.setRenderTarget(target);
      gl.render(scene, cam);
      gl.readRenderTargetPixels(target, 0, 0, SIZE, SIZE, (pass ? normal : albedo).subarray(layer * SIZE * SIZE * 4, (layer + 1) * SIZE * SIZE * 4));
    }
  }
  gl.toneMapping = tone;
  gl.setRenderTarget(before);
  target.dispose();
  mat.dispose();
  quad.geometry.dispose();
  const array = (data, srgb) => {
    const t = new THREE.DataArrayTexture(data, SIZE, SIZE, count);
    t.format = THREE.RGBAFormat;
    t.type = THREE.UnsignedByteType;
    t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    t.wrapS = THREE.RepeatWrapping;
    t.wrapT = THREE.RepeatWrapping;
    t.magFilter = THREE.LinearFilter;
    t.minFilter = THREE.LinearMipmapLinearFilter;
    t.generateMipmaps = true;
    t.anisotropy = 8;
    t.needsUpdate = true;
    return t;
  };
  made = { albedo: array(albedo, true), normal: array(normal, false), size: SIZE };
  return made;
}

// ---------------------------------------------------------------- foliage

// The plants' cards, each a square picture with see-through parts, painted
// on a canvas: a spray of leaves (an oak's, a birch's, a bush's), a pine's
// needles, a palm's frond, a fern's, a bramble's thorny stems, a tuft of
// grass, reeds, and flowers.
export const FOLIAGE = ['oak', 'birch', 'pine', 'palm', 'fern', 'bramble', 'tuft', 'reeds', 'daisy', 'bluebell', 'twigs', 'bush'];
export const LEAF = Object.fromEntries(FOLIAGE.map((k, i) => [k, i]));
const LEAF_SIZE = 256;

function seeded(seed) {
  let s = seed >>> 0 || 1;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// A leaf at (x, y), pointing along angle a, len long and w wide, in colour c.
function leaf(g, x, y, a, len, w, c, vein = true) {
  g.save();
  g.translate(x, y);
  g.rotate(a);
  const grad = g.createLinearGradient(0, -w, 0, w);
  grad.addColorStop(0, c[0]);
  grad.addColorStop(1, c[1]);
  g.fillStyle = grad;
  g.beginPath();
  g.moveTo(0, 0);
  g.bezierCurveTo(len * 0.3, -w, len * 0.75, -w * 0.8, len, 0);
  g.bezierCurveTo(len * 0.75, w * 0.8, len * 0.3, w, 0, 0);
  g.fill();
  if (vein) {
    g.strokeStyle = 'rgba(30,40,10,0.35)';
    g.lineWidth = Math.max(0.6, w * 0.08);
    g.beginPath();
    g.moveTo(0, 0);
    g.lineTo(len * 0.92, 0);
    g.stroke();
  }
  g.restore();
}

const PAINTERS = {
  // A spray of broad leaves on twigs, for an oak's crown.
  oak(g, r) {
    sprayOf(g, r, { leaves: 90, len: [16, 26], w: [7, 11], tones: [['#4f7a2a', '#2e4d17'], ['#5f8b30', '#38591c'], ['#6e9636', '#41611f'], ['#3f6622', '#243e12']] });
  },
  birch(g, r) {
    sprayOf(g, r, { leaves: 120, len: [9, 15], w: [5, 8], tones: [['#7fa23a', '#4f7322'], ['#94b444', '#5d7f28'], ['#6d9232', '#45661e']] });
  },
  bush(g, r) {
    sprayOf(g, r, { leaves: 140, len: [10, 16], w: [5, 8], tones: [['#4e7a2c', '#2c4a17'], ['#5d8a33', '#36591d'], ['#41682a', '#233d14']] });
  },
  // Pine needles: twigs with needles all along them.
  pine(g, r) {
    g.lineCap = 'round';
    for (let i = 0; i < 9; i++) {
      const x0 = 128 + (r() - 0.5) * 60;
      const y0 = 250;
      const a = -Math.PI / 2 + (r() - 0.5) * 1.3;
      const len = 150 + r() * 80;
      g.strokeStyle = '#4a3624';
      g.lineWidth = 3;
      g.beginPath();
      g.moveTo(x0, y0);
      const x1 = x0 + Math.cos(a) * len;
      const y1 = y0 + Math.sin(a) * len;
      g.lineTo(x1, y1);
      g.stroke();
      for (let t = 0.05; t < 1; t += 0.018) {
        const px = x0 + (x1 - x0) * t;
        const py = y0 + (y1 - y0) * t;
        for (const side of [-1, 1]) {
          const na = a + side * (0.9 + r() * 0.3) - 0.25;
          const nl = 18 + r() * 10 * (1 - t * 0.5);
          const tone = r();
          g.strokeStyle = tone < 0.3 ? '#2b4a20' : tone < 0.7 ? '#36592a' : '#456b31';
          g.lineWidth = 1.6;
          g.beginPath();
          g.moveTo(px, py);
          g.lineTo(px + Math.cos(na) * nl, py + Math.sin(na) * nl);
          g.stroke();
        }
      }
    }
  },
  // A palm frond: a midrib curving out, long leaflets either side.
  palm(g, r) {
    g.lineCap = 'round';
    const pts = [];
    for (let t = 0; t <= 1.0001; t += 0.02) pts.push([10 + t * 236, 128 + Math.sin(t * Math.PI) * -18 + t * 10]);
    for (let i = 2; i < pts.length - 1; i++) {
      const [x, y] = pts[i];
      const t = i / pts.length;
      const len = 60 * Math.sin(Math.min(1, t * 1.15) * Math.PI) + 8;
      for (const side of [-1, 1]) {
        const a = side * (1.05 + r() * 0.2) + 0.35;
        leaf(g, x, y, a, len * (0.85 + r() * 0.3), 4.5, r() < 0.5 ? ['#5c8a30', '#3a6020'] : ['#6b9a38', '#45702a'], false);
      }
    }
    g.strokeStyle = '#7a6a38';
    g.lineWidth = 4;
    g.beginPath();
    pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
    g.stroke();
  },
  // A fern frond: leaflets getting smaller to the tip.
  fern(g, r) {
    g.lineCap = 'round';
    const steps = 26;
    for (let i = 1; i < steps; i++) {
      const t = i / steps;
      const x = 128 + Math.sin(t * 1.2) * 12;
      const y = 250 - t * 236;
      const len = 70 * (1 - t) ** 0.8 + 6;
      for (const side of [-1, 1]) {
        const a = -Math.PI / 2 + side * 1.25;
        for (let k = 0; k < 6; k++) {
          const s = k / 6;
          leaf(g, x + Math.cos(a) * len * s, y + Math.sin(a) * len * s - 2, a + side * 0.8, len * 0.22 * (1 - s * 0.6) + 3, 3.2, r() < 0.5 ? ['#5d8f34', '#3a6421'] : ['#4f7f2c', '#2f541a'], false);
        }
      }
    }
    g.strokeStyle = '#4e6b2a';
    g.lineWidth = 2.5;
    g.beginPath();
    g.moveTo(128, 250);
    g.quadraticCurveTo(136, 130, 140, 14);
    g.stroke();
  },
  // A bramble: arching thorny stems, leaves in threes, a few berries.
  bramble(g, r) {
    g.lineCap = 'round';
    for (let i = 0; i < 9; i++) {
      const x0 = r() * 256;
      const y0 = 256;
      const cx = x0 + (r() - 0.5) * 220;
      const cy = 20 + r() * 80;
      const x1 = cx + (r() - 0.5) * 120;
      const y1 = 120 + r() * 136;
      g.strokeStyle = r() < 0.5 ? '#5a2f2a' : '#6b3b2c';
      g.lineWidth = 3.5;
      g.beginPath();
      g.moveTo(x0, y0);
      g.quadraticCurveTo(cx, cy, x1, y1);
      g.stroke();
      for (let t = 0.1; t < 1; t += 0.12) {
        const px = (1 - t) * (1 - t) * x0 + 2 * (1 - t) * t * cx + t * t * x1;
        const py = (1 - t) * (1 - t) * y0 + 2 * (1 - t) * t * cy + t * t * y1;
        g.strokeStyle = '#3a1f18';
        g.lineWidth = 1.4;
        g.beginPath();
        g.moveTo(px, py);
        g.lineTo(px + (r() - 0.5) * 12, py - 6 - r() * 5);
        g.stroke();
        if (r() < 0.55) for (let k = 0; k < 3; k++) leaf(g, px, py, -Math.PI / 2 + (k - 1) * 0.9 + (r() - 0.5) * 0.4, 18 + r() * 8, 8, r() < 0.5 ? ['#3e6524', '#22401a'] : ['#4a7428', '#2a4a1a']);
        if (r() < 0.12) {
          g.fillStyle = r() < 0.5 ? '#1c1424' : '#5a1828';
          for (let k = 0; k < 5; k++) {
            g.beginPath();
            g.arc(px + (r() - 0.5) * 7, py + 6 + (r() - 0.5) * 7, 3, 0, Math.PI * 2);
            g.fill();
          }
        }
      }
    }
  },
  // A tuft of long grass, as seen from the side.
  tuft(g, r) {
    g.lineCap = 'round';
    for (let i = 0; i < 110; i++) {
      const x0 = 128 + (r() - 0.5) * 150;
      const lean = (r() - 0.5) * 110;
      const h = 90 + r() * 160;
      const tone = r();
      g.strokeStyle = tone < 0.2 ? '#a89f6a' : tone < 0.45 ? '#61793e' : tone < 0.75 ? '#6f8848' : '#4c6332';
      g.lineWidth = 1.2 + r() * 1.6;
      g.beginPath();
      g.moveTo(x0, 256);
      g.quadraticCurveTo(x0 + lean * 0.3, 256 - h * 0.6, x0 + lean, 256 - h);
      g.stroke();
    }
  },
  // Reeds: straight tall stems, some with brown heads.
  reeds(g, r) {
    g.lineCap = 'round';
    for (let i = 0; i < 26; i++) {
      const x0 = 128 + (r() - 0.5) * 180;
      const lean = (r() - 0.5) * 30;
      const h = 170 + r() * 80;
      g.strokeStyle = r() < 0.5 ? '#6f7f3c' : '#87924a';
      g.lineWidth = 3;
      g.beginPath();
      g.moveTo(x0, 256);
      g.lineTo(x0 + lean, 256 - h);
      g.stroke();
      if (r() < 0.45) {
        g.fillStyle = '#5a3a22';
        g.beginPath();
        g.ellipse(x0 + lean * 0.92, 256 - h * 0.9, 5, 18, Math.atan2(lean, h), 0, Math.PI * 2);
        g.fill();
      }
    }
    for (let i = 0; i < 30; i++) {
      const x0 = 128 + (r() - 0.5) * 180;
      const a = -Math.PI / 2 + (r() - 0.5) * 1.2;
      leaf(g, x0, 256, a, 100 + r() * 90, 5, ['#7a8a44', '#55662e'], false);
    }
  },
  // Wild flowers: stems with leaves and little white daisies, or bluebells.
  daisy(g, r) {
    flowersOf(g, r, (x, y, s) => {
      for (let p = 0; p < 12; p++) {
        const a = (p / 12) * Math.PI * 2;
        leaf(g, x, y, a, 11 * s, 3.2 * s, ['#ffffff', '#e2e2ea'], false);
      }
      g.fillStyle = '#f0c020';
      g.beginPath();
      g.arc(x, y, 3.6 * s, 0, Math.PI * 2);
      g.fill();
    });
  },
  bluebell(g, r) {
    flowersOf(g, r, (x, y, s) => {
      for (let k = 0; k < 4; k++) {
        g.fillStyle = k % 2 ? '#5a5ad0' : '#6e6ee6';
        g.beginPath();
        g.ellipse(x + 6 * s - k * 3 * s, y + k * 9 * s, 4 * s, 7 * s, 0.3, 0, Math.PI * 2);
        g.fill();
      }
    });
  },
  // Bare twigs, for a dead tree.
  twigs(g, r) {
    g.lineCap = 'round';
    const branch = (x, y, a, len, w, depth) => {
      const x1 = x + Math.cos(a) * len;
      const y1 = y + Math.sin(a) * len;
      g.strokeStyle = '#5a5048';
      g.lineWidth = w;
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x1, y1);
      g.stroke();
      if (depth > 0) for (const s of [-1, 1]) branch(x1, y1, a + s * (0.35 + r() * 0.4), len * 0.68, w * 0.65, depth - 1);
    };
    for (let i = 0; i < 3; i++) branch(128 + (i - 1) * 40, 256, -Math.PI / 2 + (r() - 0.5) * 0.6, 70, 6, 5);
  },
};

function sprayOf(g, r, { leaves, len, w, tones }) {
  // (Leaves only: the branches they grow on are the tree's own.)
  for (let i = 0; i < leaves; i++) {
    // Leaves gathered round a roughly round spray, densest in its middle.
    const a = r() * Math.PI * 2;
    const d = Math.sqrt(r()) * 100;
    const x = 128 + Math.cos(a) * d;
    const y = 120 + Math.sin(a) * d * 0.95;
    const la = r() * Math.PI * 2;
    const tone = tones[Math.floor(r() * tones.length)];
    leaf(g, x, y, la, len[0] + r() * (len[1] - len[0]), w[0] + r() * (w[1] - w[0]), tone);
  }
}

function flowersOf(g, r, bloom) {
  g.lineCap = 'round';
  for (let i = 0; i < 9; i++) {
    const x0 = 40 + r() * 176;
    const h = 90 + r() * 120;
    const lean = (r() - 0.5) * 40;
    g.strokeStyle = '#4c7a2a';
    g.lineWidth = 2.5;
    g.beginPath();
    g.moveTo(x0, 256);
    g.quadraticCurveTo(x0, 256 - h * 0.5, x0 + lean, 256 - h);
    g.stroke();
    leaf(g, x0, 256 - h * 0.3, -Math.PI / 2 - 0.7, 30, 6, ['#5d8f34', '#3a6421'], false);
    leaf(g, x0, 256 - h * 0.4, -Math.PI / 2 + 0.7, 26, 6, ['#5d8f34', '#3a6421'], false);
    bloom(x0 + lean, 256 - h, 0.9 + r() * 0.5);
  }
}

let foliage = null;

// The plants' cards as one DataArrayTexture, a layer each (LEAF their order).
export function foliageTexture() {
  if (foliage) return foliage;
  const count = FOLIAGE.length;
  const data = new Uint8Array(LEAF_SIZE * LEAF_SIZE * 4 * count);
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = LEAF_SIZE;
  const g = canvas.getContext('2d', { willReadFrequently: true });
  FOLIAGE.forEach((key, i) => {
    g.clearRect(0, 0, LEAF_SIZE, LEAF_SIZE);
    PAINTERS[key](g, seeded(1000 + i * 77));
    const img = g.getImageData(0, 0, LEAF_SIZE, LEAF_SIZE).data;
    // Upside down, as textures go; and the colour of the nearest leaf
    // carried into the see-through parts round it, so mipmaps do not
    // darken the edges.
    const out = data.subarray(i * LEAF_SIZE * LEAF_SIZE * 4, (i + 1) * LEAF_SIZE * LEAF_SIZE * 4);
    for (let y = 0; y < LEAF_SIZE; y++) out.set(img.subarray((LEAF_SIZE - 1 - y) * LEAF_SIZE * 4, (LEAF_SIZE - y) * LEAF_SIZE * 4), y * LEAF_SIZE * 4);
    bleed(out, LEAF_SIZE);
  });
  const t = new THREE.DataArrayTexture(data, LEAF_SIZE, LEAF_SIZE, count);
  t.format = THREE.RGBAFormat;
  t.type = THREE.UnsignedByteType;
  t.colorSpace = THREE.SRGBColorSpace;
  t.magFilter = THREE.LinearFilter;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.generateMipmaps = true;
  t.anisotropy = 4;
  t.needsUpdate = true;
  foliage = t;
  return t;
}

// Fills the colour of see-through pixels from their opaque neighbours, a
// few rings out.
function bleed(px, size) {
  for (let pass = 0; pass < 6; pass++) {
    const src = px.slice();
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const o = (y * size + x) * 4;
        if (src[o + 3] > 8) continue;
        let r = 0;
        let gg = 0;
        let b = 0;
        let n = 0;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const xx = x + dx;
          const yy = y + dy;
          if (xx < 0 || yy < 0 || xx >= size || yy >= size) continue;
          const q = (yy * size + xx) * 4;
          if (src[q + 3] <= 8 && !(src[q] | src[q + 1] | src[q + 2])) continue;
          r += src[q];
          gg += src[q + 1];
          b += src[q + 2];
          n++;
        }
        if (n) {
          px[o] = r / n;
          px[o + 1] = gg / n;
          px[o + 2] = b / n;
        }
      }
    }
  }
}
