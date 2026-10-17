// The admin page's TV broadcast (see public/js/shared/broadcast.js): puts a
// YouTube video, or a video on this computer, on every TV in the game, and
// takes it off again.
//
// A YouTube video goes out as its link: every TV plays it from YouTube, all
// at the same place. A video on this computer never leaves it as a file:
// this page plays it, and is the TV station, a PeerJS peer that each TV
// watching it calls and is answered with the picture and sound as they play
// here, live — pause or skip here, and every TV does too (the sound goes to
// them whatever the volume here). So the page has
// to stay open while it is on air, and says so; it tells the keeper it is
// still there every few seconds, and a video whose page is gone comes off.
import { signalingOptions } from '/js/net.js';
import { cleanTitle, parseYouTube, stationId, youtubeEmbed } from '/js/shared/broadcast.js';

const ALIVE_MS = 8000;
// How long the YouTube player may take to say what a video is called and how long it is.
const YOUTUBE_INFO_MS = 8000;

const $ = (id) => document.getElementById(id);
const time = new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' });

function h(tag, props = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props ?? {})) {
    if (v === undefined || v === null || v === false) continue;
    if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k === 'class') el.className = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children.flat()) if (c !== null && c !== undefined && c !== false) el.append(c.nodeType ? c : String(c));
  return el;
}

const send = (method, body, path = 'tv') =>
  fetch(`/admin/api/${path}`, { method, cache: 'no-store', headers: { 'X-Kids-World-Admin': '1', 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });

// The YouTube IFrame API, loaded the first time it is needed.
let youtubeApi = null;
function loadYouTube() {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  youtubeApi ??= new Promise((resolve, reject) => {
    const before = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      before?.();
      resolve(window.YT);
    };
    const script = h('script', { src: 'https://www.youtube.com/iframe_api', async: true });
    script.onerror = () => {
      youtubeApi = null;
      reject(new Error('YouTube could not be reached.'));
    };
    document.head.append(script);
  });
  return youtubeApi;
}

// What YouTube says a video is called and how long it is, in a player
// tucked away for the purpose: { title, duration }, or nothing it could
// not find out in time (a video that cannot be embedded, say: then the
// error code too).
async function youtubeInfo(id) {
  // YouTube puts its player in place of the slot: the box round it goes.
  const slot = h('div');
  const box = h('div', { class: 'tv-probe' }, slot);
  document.body.append(box);
  try {
    const YT = await Promise.race([loadYouTube(), new Promise((resolve) => setTimeout(resolve, YOUTUBE_INFO_MS))]);
    if (!YT?.Player) return {};
    return await new Promise((resolve) => {
      const done = (info) => {
        clearTimeout(timer);
        resolve(info);
      };
      const timer = setTimeout(() => done({}), YOUTUBE_INFO_MS);
      const player = new YT.Player(slot, {
        videoId: id,
        width: 160,
        height: 90,
        playerVars: { autoplay: 0, controls: 0 },
        events: {
          onReady: () => done({ title: player.getVideoData?.()?.title ?? '', duration: player.getDuration?.() ?? 0 }),
          onError: (e) => done({ error: e.data }),
        },
      });
    });
  } catch {
    return {};
  } finally {
    box.remove();
  }
}

// ---------------------------------------------------------------- the station

// The video on this computer being played to every TV, while it is.
const station = {
  peer: null,
  id: '',
  stream: null,
  calls: new Set(),
  alive: 0,
  url: '',
};

function stopStation() {
  clearInterval(station.alive);
  for (const call of station.calls) call.close();
  station.calls.clear();
  station.peer?.destroy();
  station.peer = null;
  station.id = '';
  station.stream = null;
  const video = $('tv-video');
  video.pause();
  video.removeAttribute('src');
  video.load();
  if (station.url) URL.revokeObjectURL(station.url);
  station.url = '';
  $('tv-station').hidden = true;
}

async function signalOptions() {
  try {
    const config = await (await fetch('/keeper.json', { cache: 'no-cache' })).json();
    return config?.signal ? signalingOptions(new URLSearchParams({ signal: config.signal })) : {};
  } catch {
    return {};
  }
}

function viewers() {
  const n = [...station.calls].filter((c) => c.open).length;
  $('tv-viewers').textContent = n === 1 ? '1 TV watching' : `${n} TVs watching`;
}

// A video file from this computer, on air: played here, every TV calling in for it.
async function playFile(file, loop) {
  stopStation();
  if (typeof Peer === 'undefined') throw new Error('PeerJS did not load.');
  const video = $('tv-video');
  station.url = URL.createObjectURL(file);
  video.src = station.url;
  video.loop = loop;
  // The TVs get the sound however loud it is here (Chrome and Firefox
  // capture it before the page's own volume), so here it starts quiet.
  video.muted = true;
  $('tv-station').hidden = false;
  await video.play();
  const capture = video.captureStream ?? video.mozCaptureStream;
  if (!capture) throw new Error('This browser cannot play a video to the TVs: use Chrome or Firefox.');
  station.stream = capture.call(video);
  const id = stationId();
  const peer = new Peer(id, await signalOptions());
  station.peer = peer;
  station.id = id;
  await new Promise((resolve, reject) => {
    peer.on('open', resolve);
    peer.on('error', (error) => {
      if (peer.open) return;
      reject(new Error(`The signaling server said no: ${error.type ?? error.message}`));
    });
  });
  peer.on('call', (call) => {
    station.calls.add(call);
    call.on('stream', viewers);
    call.on('close', () => {
      station.calls.delete(call);
      viewers();
    });
    call.on('error', () => {
      station.calls.delete(call);
      viewers();
    });
    call.answer(station.stream);
    setTimeout(viewers, 1500);
  });
  peer.on('disconnected', () => {
    if (station.peer === peer) peer.reconnect();
  });
  const res = await send('PUT', { kind: 'video', station: id, title: cleanTitle(file.name.replace(/\.[^.]+$/, ''), 'A video') });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? 'The keeper said no.');
  viewers();
  // Still here, every few seconds; off air when the video ends, unless it goes round.
  station.alive = setInterval(async () => {
    const answer = await send('POST', undefined, 'tv/alive')
      .then((r) => r.json())
      .catch(() => null);
    if (answer && !answer.on && station.peer === peer) stopStation();
  }, ALIVE_MS);
  video.onended = () => {
    if (station.peer === peer && !video.loop) takeOff();
  };
}

async function takeOff() {
  stopStation();
  await send('DELETE');
  refreshTv();
}

// ---------------------------------------------------------------- the card

let state = null;

function onAir() {
  const tv = state;
  const el = $('tv-now');
  if (!tv) {
    el.replaceChildren(h('span', { class: 'badge' }, 'Off air'), h('span', { class: 'muted' }, ' Nothing on the TVs but their own channels.'));
    $('tv-stop').hidden = true;
    $('tv-preview').replaceChildren();
    return;
  }
  const kind = tv.kind === 'youtube' ? 'YouTube' : 'Video on this computer';
  el.replaceChildren(h('span', { class: 'badge ok' }, 'On air'), ' ', h('b', {}, tv.title), h('span', { class: 'muted' }, ` · ${kind} · since ${time.format(tv.since)}`));
  $('tv-stop').hidden = false;
  // A YouTube video, as the TVs show it (without the sound).
  const preview = $('tv-preview');
  if (tv.kind === 'youtube' && preview.dataset.id !== `${tv.id}:${tv.since}`) {
    preview.dataset.id = `${tv.id}:${tv.since}`;
    const src = `${youtubeEmbed(tv, Date.now() - tv.since)}&mute=1`;
    preview.replaceChildren(h('iframe', { class: 'tv-frame', src, allow: 'autoplay; encrypted-media', title: tv.title, referrerpolicy: 'strict-origin-when-cross-origin' }));
  } else if (tv.kind !== 'youtube') {
    preview.dataset.id = '';
    preview.replaceChildren();
  }
  // Another page's station, or one from before this page was opened: this page can only take it off.
  if (tv.kind === 'video' && tv.station !== station.id) $('tv-elsewhere').hidden = false;
  else $('tv-elsewhere').hidden = true;
}

export async function refreshTv(keeper = undefined) {
  if (keeper === undefined) {
    try {
      keeper = (await (await fetch('/admin/api/state', { cache: 'no-store' })).json()).keeper;
    } catch {
      keeper = null;
    }
  }
  $('tv-section').hidden = !keeper;
  state = keeper?.tv ?? null;
  // Taken off from elsewhere (another admin tab, a keeper restarted): this station stops too.
  if (station.peer && (!state || state.station !== station.id)) stopStation();
  onAir();
}

function problem(text) {
  $('tv-problem').textContent = text;
  $('tv-problem').hidden = !text;
}

async function busy(button, fn) {
  button.disabled = true;
  problem('');
  try {
    await fn();
  } catch (error) {
    problem(error.message);
  } finally {
    button.disabled = false;
    refreshTv();
  }
}

export function setUpTv() {
  const file = h('input', { type: 'file', accept: 'video/*', id: 'tv-file' });
  const loop = h('input', { type: 'checkbox', id: 'tv-loop', checked: true });
  const playButton = h('button', { type: 'button', class: 'primary' }, 'Put on TV');
  playButton.onclick = () =>
    busy(playButton, async () => {
      if (!file.files[0]) throw new Error('Pick a video first.');
      await playFile(file.files[0], loop.checked);
    });
  const link = h('input', { type: 'url', id: 'tv-link', placeholder: 'https://www.youtube.com/watch?v=…', autocomplete: 'off', spellcheck: 'false' });
  const linkButton = h('button', { type: 'button', class: 'primary' }, 'Put on TV');
  const putLink = () =>
    busy(linkButton, async () => {
      const found = parseYouTube(link.value);
      if (!found) throw new Error('That is not a YouTube link.');
      const info = await youtubeInfo(found.id);
      if (info.error === 101 || info.error === 150 || info.error === 153) throw new Error('That video’s owner does not let it play anywhere but on YouTube.');
      if (info.error === 100) throw new Error('That video is not there (removed, or private).');
      stopStation();
      const res = await send('PUT', { kind: 'youtube', id: found.id, start: found.start, duration: info.duration ?? 0, title: info.title || 'A YouTube video' });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? 'The keeper said no.');
      link.value = '';
    });
  linkButton.onclick = putLink;
  link.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') putLink();
  });
  const stop = h('button', { type: 'button', class: 'danger', id: 'tv-stop', hidden: true }, 'Take off air');
  stop.onclick = () => busy(stop, takeOff);
  $('tv').replaceChildren(
    h('div', { class: 'tv-now-row' }, h('div', { id: 'tv-now', class: 'tv-now' }), stop),
    h('p', { id: 'tv-elsewhere', class: 'muted', hidden: true }, 'Another admin page is playing this video to the TVs.'),
    h('div', { id: 'tv-preview', class: 'tv-preview' }),
    h(
      'div',
      { id: 'tv-station', class: 'tv-station', hidden: true },
      h('video', { id: 'tv-video', class: 'tv-frame', controls: true, playsinline: true }),
      h('p', { class: 'muted' }, h('b', { id: 'tv-viewers' }, '0 TVs watching'), ' · Keep this page open while it is on air: the TVs get it from here. Pause or skip here and every TV does too; the sound here is only for you (it starts muted), the TVs always get it.'),
    ),
    h('p', { id: 'tv-problem', class: 'tv-problem', role: 'alert', hidden: true }),
    h(
      'div',
      { class: 'tv-forms' },
      h('div', { class: 'tv-form' }, h('label', { for: 'tv-file' }, 'A video on this computer'), file, h('label', { class: 'check' }, loop, ' Play it again and again'), playButton),
      h('div', { class: 'tv-form' }, h('label', { for: 'tv-link' }, 'A YouTube link'), link, h('span', { class: 'muted' }, 'A t= in the link starts it there.'), linkButton),
    ),
    h('p', { class: 'muted' }, 'It goes on every TV in the game as channel 📡 Live, for players logged in while the keeper is online, and tells them so.'),
  );
  // Closing the page while it plays to the TVs asks first; closed, the
  // video comes off air once the keeper misses it.
  window.addEventListener('beforeunload', (e) => {
    if (station.peer) e.preventDefault();
  });
}
