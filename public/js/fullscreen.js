// Full screen: the island fills the whole screen, without the browser's bars.
// iPhones have no way for a page to do that, but the game opened from the
// Home Screen fills it all the same. iPads have the calls, but there any swipe
// down leaves full screen again, and playing is all swipes: a gesture of
// WebKit's own, in every iPad browser, that no page can turn off. So iPads are
// sent to the Home Screen too, where nothing swipes the game away.

const doc = () => globalThis.document;

// 'toggle': the page can go full screen by itself.
// 'home-screen': an iPhone or iPad, which can only do it from the Home Screen.
// 'none': already opened from the Home Screen, or a browser that cannot.
export function fullscreenMode() {
  const d = doc();
  const nav = globalThis.navigator;
  if (isIPad(nav)) return nav.standalone === true ? 'none' : 'home-screen';
  if (d.fullscreenEnabled ?? d.webkitFullscreenEnabled) return 'toggle';
  return nav?.standalone === false ? 'home-screen' : 'none';
}

// iPads ask for desktop pages by default and so say they are a Mac, the one
// Mac with a touch screen.
function isIPad(nav) {
  if (!nav) return false;
  return /iPad/.test(nav.userAgent ?? '') || (nav.platform === 'MacIntel' && nav.maxTouchPoints > 1);
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
