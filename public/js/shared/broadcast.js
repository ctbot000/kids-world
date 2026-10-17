// TV broadcasts: what the keeper's admin page puts on every TV (tv.js),
// on a channel of its own, 📡 Live, for as long as it is on air.
//
//   { kind: 'youtube', id, start, duration, title }  a YouTube video: every
//       TV plays it from YouTube itself, all at the same place in it (start
//       seconds in when it went on air, round again after `duration`
//       seconds, when that is known)
//   { kind: 'video', station, title }  a video on the keeper's computer: the
//       admin page plays it and is the TV station, a PeerJS peer under the
//       id `station` that every TV calls for the picture and the sound, live
//
// The keeper sends it to pages as news ({ t: 'tv-news', tv }), with `at`:
// how many milliseconds it has been on air.
// No DOM here: the keeper, the admin page and the game share it.

export const TITLE_MAX = 80;
// The longest a YouTube start time may be: a day.
const START_MAX = 24 * 3600;
const YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/;
const STATION = /^kidsworld-tv-[0-9a-z]{8,32}$/;
const YOUTUBE_HOSTS = new Set(['youtube.com', 'www.youtube.com', 'm.youtube.com', 'music.youtube.com', 'youtube-nocookie.com', 'www.youtube-nocookie.com', 'youtu.be']);

// A new TV station's peer id.
export function stationId(random = Math.random) {
  let s = '';
  for (let i = 0; i < 16; i++) s += Math.floor(random() * 36).toString(36);
  return `kidsworld-tv-${s}`;
}

// A YouTube start time as written in a link: 90, 90s, 1m30s, 1h2m3s.
function seconds(raw) {
  if (!raw) return 0;
  if (/^\d+$/.test(raw)) return Number(raw);
  const m = /^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/.exec(raw);
  return m && raw ? Number(m[1] ?? 0) * 3600 + Number(m[2] ?? 0) * 60 + Number(m[3] ?? 0) : 0;
}

// The video in a YouTube link (watch, youtu.be, shorts, live or embed, or
// just its id), and where in it the link starts: { id, start }, or null.
export function parseYouTube(text) {
  const raw = String(text ?? '').trim();
  if (YOUTUBE_ID.test(raw)) return { id: raw, start: 0 };
  let url;
  try {
    url = new URL(/^[a-z]+:\/\//i.test(raw) ? raw : `https://${raw}`);
  } catch {
    return null;
  }
  if (!/^https?:$/.test(url.protocol) || !YOUTUBE_HOSTS.has(url.hostname.toLowerCase())) return null;
  const path = url.pathname.split('/').filter(Boolean);
  let id = null;
  if (url.hostname.toLowerCase() === 'youtu.be') id = path[0];
  else if (path[0] === 'watch') id = url.searchParams.get('v');
  else if (['shorts', 'live', 'embed', 'v'].includes(path[0])) id = path[1];
  if (!id || !YOUTUBE_ID.test(id)) return null;
  const start = Math.min(START_MAX, seconds(url.searchParams.get('t') ?? url.searchParams.get('start') ?? ''));
  return { id, start };
}

export function cleanTitle(raw, fallback) {
  const title = String(raw ?? '')
    .replace(/[\p{Cc}\p{Cf}\u2028\u2029]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
  const chars = [...title];
  if (!chars.length) return fallback;
  return chars.length > TITLE_MAX ? `${chars.slice(0, TITLE_MAX - 1).join('').trimEnd()}…` : title;
}

// A broadcast as given (by the admin page, or the keeper's news), checked:
// the broadcast, or null for nothing on air.
export function cleanBroadcast(raw) {
  if (!raw || typeof raw !== 'object') return null;
  if (raw.kind === 'youtube') {
    if (typeof raw.id !== 'string' || !YOUTUBE_ID.test(raw.id)) return null;
    const start = Number.isFinite(raw.start) ? Math.max(0, Math.min(START_MAX, Math.floor(raw.start))) : 0;
    const duration = Number.isFinite(raw.duration) && raw.duration > 0 && raw.duration < 7 * 24 * 3600 ? Math.floor(raw.duration) : 0;
    return { kind: 'youtube', id: raw.id, start, duration, title: cleanTitle(raw.title, 'A YouTube video') };
  }
  if (raw.kind === 'video') {
    if (typeof raw.station !== 'string' || !STATION.test(raw.station)) return null;
    return { kind: 'video', station: raw.station, title: cleanTitle(raw.title, 'A video') };
  }
  return null;
}

// Whether two broadcasts are the same show (a fresh one is news).
export const sameBroadcast = (a, b) => (a && b ? a.kind === b.kind && a.id === b.id && a.station === b.station && a.start === b.start : a === b);

// Where in a YouTube broadcast every TV is, `ms` after it went on air:
// whole seconds into the video, round again after its duration.
export function youtubeAt(tv, ms) {
  const at = tv.start + Math.max(0, Math.floor(ms / 1000));
  return tv.duration > 0 ? at % tv.duration : at;
}

// The address that plays a YouTube broadcast in a TV, `ms` after it went on
// air: privacy-enhanced, starting at once at the same place as everyone
// else, round and round, without the controls or other videos after it.
export function youtubeEmbed(tv, ms) {
  const params = new URLSearchParams({ autoplay: '1', start: String(youtubeAt(tv, ms)), playsinline: '1', controls: '0', rel: '0', loop: '1', playlist: tv.id, disablekb: '1', fs: '0', iv_load_policy: '3' });
  return `https://www.youtube-nocookie.com/embed/${tv.id}?${params}`;
}
