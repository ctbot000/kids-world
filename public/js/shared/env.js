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

export const WEATHERS = ['clear', 'cloudy', 'rain', 'rainbow', 'snow', 'sprinkles'];

// What comes next, and for how many seconds.
export function nextWeather(current, theme, random = Math.random) {
  const wet = theme === 'snowy' ? 'snow' : theme === 'candy' ? 'sprinkles' : 'rain';
  if (current === 'rain' || current === 'snow' || current === 'sprinkles') return { weather: 'rainbow', seconds: 70 + random() * 40 };
  if (current === 'rainbow') return { weather: 'clear', seconds: 200 + random() * 160 };
  const r = random();
  if (r < 0.55) return { weather: 'clear', seconds: 180 + random() * 180 };
  if (r < 0.8) return { weather: 'cloudy', seconds: 120 + random() * 120 };
  return { weather: wet, seconds: 90 + random() * 90 };
}
