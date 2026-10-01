// Full screen: the island fills the whole screen, without the browser's bars.
// iPhones have no way for a page to do that, but the game opened from the
// Home Screen fills it all the same.

const doc = () => globalThis.document;

// 'toggle': the page can go full screen by itself.
// 'home-screen': Safari on an iPhone, which can only do it from the Home Screen.
// 'none': already opened from the Home Screen, or a browser that cannot.
export function fullscreenMode() {
  const d = doc();
  if (d.fullscreenEnabled ?? d.webkitFullscreenEnabled) return 'toggle';
  return globalThis.navigator?.standalone === false ? 'home-screen' : 'none';
}

export function isFullscreen() {
  const d = doc();
  return Boolean(d.fullscreenElement ?? d.webkitFullscreenElement);
}

// Must be called while handling a tap or click; browsers refuse it otherwise.
export function setFullscreen(on) {
  const d = doc();
  if (on === isFullscreen()) return Promise.resolve();
  try {
    if (!on) return Promise.resolve((d.exitFullscreen ?? d.webkitExitFullscreen).call(d));
    const root = d.documentElement;
    // Older Safari only has the prefixed call, which takes no options and returns nothing.
    if (root.requestFullscreen) return root.requestFullscreen({ navigationUI: 'hide' });
    return Promise.resolve(root.webkitRequestFullscreen());
  } catch (error) {
    return Promise.reject(error);
  }
}

export function onFullscreenChange(fn) {
  const d = doc();
  d.addEventListener('fullscreenchange', fn);
  d.addEventListener('webkitfullscreenchange', fn);
}
