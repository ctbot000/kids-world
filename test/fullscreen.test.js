// Full screen through the standard calls and Safari's older prefixed ones,
// and iPhones and iPads, which can only get it by opening the game from the Home Screen.
import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { fullscreenMode, isFullscreen, setFullscreen } from '../public/js/fullscreen.js';

const realNavigator = Object.getOwnPropertyDescriptor(globalThis, 'navigator');

function pretend({ document, navigator = {} }) {
  Object.defineProperty(globalThis, 'document', { value: document, configurable: true });
  Object.defineProperty(globalThis, 'navigator', { value: navigator, configurable: true });
}

afterEach(() => {
  delete globalThis.document;
  Object.defineProperty(globalThis, 'navigator', realNavigator);
});

// A page whose root element goes full screen, with or without the webkit prefix.
function fakePage(prefix = '') {
  const calls = [];
  const doc = {
    [prefix ? 'webkitFullscreenEnabled' : 'fullscreenEnabled']: true,
    [prefix ? 'webkitFullscreenElement' : 'fullscreenElement']: null,
    documentElement: {},
  };
  const element = prefix ? 'webkitFullscreenElement' : 'fullscreenElement';
  doc.documentElement[prefix ? 'webkitRequestFullscreen' : 'requestFullscreen'] = (...args) => {
    calls.push(['request', ...args]);
    doc[element] = doc.documentElement;
    return prefix ? undefined : Promise.resolve();
  };
  doc[prefix ? 'webkitExitFullscreen' : 'exitFullscreen'] = () => {
    calls.push(['exit']);
    doc[element] = null;
    return prefix ? undefined : Promise.resolve();
  };
  return { doc, calls };
}

test('the whole page goes full screen and comes back', async () => {
  const { doc, calls } = fakePage();
  pretend({ document: doc });
  assert.equal(fullscreenMode(), 'toggle');
  assert.equal(isFullscreen(), false);
  await setFullscreen(true);
  assert.equal(isFullscreen(), true);
  await setFullscreen(true);
  await setFullscreen(false);
  assert.equal(isFullscreen(), false);
  assert.deepEqual(calls, [['request', { navigationUI: 'hide' }], ['exit']]);
});

test('older Safari uses the prefixed calls, which return nothing', async () => {
  const { doc, calls } = fakePage('webkit');
  pretend({ document: doc, navigator: { standalone: false } });
  assert.equal(fullscreenMode(), 'toggle');
  await setFullscreen(true);
  assert.equal(isFullscreen(), true);
  await setFullscreen(false);
  assert.equal(isFullscreen(), false);
  assert.deepEqual(calls, [['request'], ['exit']]);
});

test('Safari on an iPhone is pointed to the Home Screen, where nothing more is needed', () => {
  const doc = { fullscreenEnabled: false, documentElement: {} };
  pretend({ document: doc, navigator: { standalone: false } });
  assert.equal(fullscreenMode(), 'home-screen');
  pretend({ document: doc, navigator: { standalone: true } });
  assert.equal(fullscreenMode(), 'none');
  // Any other browser that cannot, such as a page inside a frame that does not allow it.
  pretend({ document: doc, navigator: {} });
  assert.equal(fullscreenMode(), 'none');
});

test('an iPad is pointed to the Home Screen, since any swipe down there leaves full screen', () => {
  const { doc } = fakePage();
  const desktop = { userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', platform: 'MacIntel' };
  // Asking for the desktop page, as iPads do by default (Chrome too), it says it is a Mac with a touch screen.
  pretend({ document: doc, navigator: { ...desktop, maxTouchPoints: 5, standalone: false } });
  assert.equal(fullscreenMode(), 'home-screen');
  pretend({ document: doc, navigator: { ...desktop, maxTouchPoints: 5 } });
  assert.equal(fullscreenMode(), 'home-screen');
  pretend({ document: doc, navigator: { userAgent: 'Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X) CriOS/140.0', platform: 'iPad', maxTouchPoints: 5 } });
  assert.equal(fullscreenMode(), 'home-screen');
  // Opened from the Home Screen, it is full screen already.
  pretend({ document: doc, navigator: { ...desktop, maxTouchPoints: 5, standalone: true } });
  assert.equal(fullscreenMode(), 'none');
  // A real Mac goes full screen as before.
  pretend({ document: doc, navigator: { ...desktop, maxTouchPoints: 0, standalone: false } });
  assert.equal(fullscreenMode(), 'toggle');
});

test('a refused request is a rejected promise, never a throw', async () => {
  const { doc } = fakePage();
  doc.documentElement.requestFullscreen = () => Promise.reject(new TypeError('Permissions check failed'));
  pretend({ document: doc });
  await assert.rejects(setFullscreen(true), TypeError);
  const old = fakePage('webkit');
  old.doc.documentElement.webkitRequestFullscreen = () => {
    throw new Error('not allowed');
  };
  pretend({ document: old.doc });
  await assert.rejects(setFullscreen(true), /not allowed/);
  assert.equal(isFullscreen(), false);
});
