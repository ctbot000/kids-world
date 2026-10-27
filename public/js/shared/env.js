// Time of day and weather. A day is 18 minutes: 14 of daylight and a short,
// gentle night. time is a fraction of a day: 0 midnight, 0.25 sunrise,
// 0.5 noon, 0.75 sunset.

export const DAY_SECONDS = 14 * 60;
export const NIGHT_SECONDS = 4 * 60;
export const DAY_MODES = ['cycle', 'day', 'night'];

export const isDaytime = (time) => time >= 0.25 && time < 0.75;
export const isNight = (time) => time < 0.2 || time > 0.8;

export function timeRate(time) {
  return isDaytime(time) ? 0.5 / DAY_SECONDS : 0.5 / NIGHT_SECONDS;
}

export function fixedTime(mode) {
  if (mode === 'day') return 0.42;
  if (mode === 'night') return 0.0;
  return null;
}

// Moves the clock on by some seconds, at daytime or night-time speed.
export function advanceTime(time, seconds, mode = 'cycle') {
  const fixed = fixedTime(mode);
  if (fixed !== null) return fixed;
  let t = ((time % 1) + 1) % 1;
  let left = Math.max(0, seconds);
  for (let guard = 0; left > 1e-9 && guard < 16; guard++) {
    const day = isDaytime(t);
    const rate = timeRate(t);
    const boundary = day ? 0.75 : t < 0.25 ? 0.25 : 1.25;
    const need = (boundary - t) / rate;
    if (need >= left) {
      t += left * rate;
      left = 0;
    } else {
      t = boundary;
      left -= need;
    }
    t %= 1;
  }
  return t;
}

// How much sunlight there is, from 0 (deep night) to 1 (full day).
export function daylight(time) {
  const up = smooth(0.2, 0.3, time);
  const down = 1 - smooth(0.7, 0.8, time);
  return Math.min(up, down);
}

function smooth(a, b, x) {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

// ---------------------------------------------------------------- weather

export const WEATHERS = ['clear', 'cloudy', 'rain', 'rainbow', 'snow', 'sprinkles', 'tornado'];

// Something falling out of the sky — rain, snow or candy sprinkles — which
// waters farmland out under the open sky (shared/room.js).
export const isRaining = (weather) => weather === 'rain' || weather === 'snow' || weather === 'sprinkles';

// What comes next, and for how many seconds. A volcano island never rains:
// the rain would only hiss away on the lava (and no rainbow without it).
// Now and then a cloudy sky spins up a tornado, which blows itself out
// back into clouds.
export function nextWeather(current, theme, random = Math.random) {
  if (current === 'rain' || current === 'snow' || current === 'sprinkles') return { weather: 'rainbow', seconds: 70 + random() * 40 };
  if (current === 'rainbow') return { weather: 'clear', seconds: 200 + random() * 160 };
  if (current === 'tornado') return { weather: 'cloudy', seconds: 60 + random() * 60 };
  const r = random();
  if (current === 'cloudy' && r >= 0.9) return { weather: 'tornado', seconds: TORNADO_SECONDS[0] + random() * (TORNADO_SECONDS[1] - TORNADO_SECONDS[0]) };
  if (r < 0.55 || (theme === 'volcano' && r < 0.95)) return { weather: 'clear', seconds: 180 + random() * 180 };
  if (r < 0.8) return { weather: 'cloudy', seconds: 120 + random() * 120 };
  // Anywhere else (but by a volcano), a wet spell is now and then snow
  // instead of rain.
  const wet = theme === 'snowy' ? 'snow' : theme === 'candy' ? 'sprinkles' : theme !== 'volcano' && random() < 0.35 ? 'snow' : 'rain';
  return { weather: wet, seconds: 90 + random() * 90 };
}

// ---------------------------------------------------------------- tornado

// How long one lasts, from and to (seconds).
export const TORNADO_SECONDS = [75, 120];
// Anyone out in the open this close to its middle is swept up.
export const TORNADO_REACH = 2.6;
// How tall the funnel stands over the ground.
export const TORNADO_HEIGHT = 24;

// Where a tornado is, age seconds after it touched down: a wandering path
// over the middle of the island, worked out the same on every machine from
// its seed (the room sends seed and age, shared/room.js envMessage). It
// goes about as fast as you walk, so you can always get away.
export function tornadoAt(seed, age, W = 128, D = 128) {
  const phase = (k) => ((Math.imul(seed + k, 0x9e3779b1) >>> 0) / 4294967296) * Math.PI * 2;
  const rx = W * 0.3;
  const rz = D * 0.3;
  return {
    x: W / 2 + rx * (0.75 * Math.sin(0.045 * age + phase(1)) + 0.25 * Math.sin(0.13 * age + phase(2))),
    z: D / 2 + rz * (0.75 * Math.sin(0.037 * age + phase(3)) + 0.25 * Math.sin(0.11 * age + phase(4))),
  };
}
