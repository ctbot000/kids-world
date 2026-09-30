// Smooth 2D value noise and its fractal sum, for rolling island hills.
import { hash2 } from './rng.js';

const fade = (t) => t * t * t * (t * (t * 6 - 15) + 10);

export function valueNoise(seed, x, z) {
  const x0 = Math.floor(x);
  const z0 = Math.floor(z);
  const fx = fade(x - x0);
  const fz = fade(z - z0);
  const a = hash2(seed, x0, z0);
  const b = hash2(seed, x0 + 1, z0);
  const c = hash2(seed, x0, z0 + 1);
  const d = hash2(seed, x0 + 1, z0 + 1);
  const top = a + (b - a) * fx;
  const bottom = c + (d - c) * fx;
  return (top + (bottom - top) * fz) * 2 - 1; // [-1, 1]
}

// Fractal Brownian motion: octaves of noise, each twice as fine and half as strong.
export function fbm(seed, x, z, octaves = 4) {
  let sum = 0;
  let amp = 1;
  let norm = 0;
  let freq = 1;
  for (let i = 0; i < octaves; i++) {
    sum += valueNoise(seed + i * 1013, x * freq, z * freq) * amp;
    norm += amp;
    amp *= 0.5;
    freq *= 2;
  }
  return sum / norm;
}
