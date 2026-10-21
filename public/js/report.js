// Telling the grown-ups about a problem (ui.js reportDialog): a picture of
// the screen as it is, buttons and all, and what went wrong in the page
// lately, to go with what a player writes to the island keeper
// (KeeperClient.report). The 3D view comes from the renderer, which can read
// its own pixels back only straight after drawing (renderer.photo); what is
// on top of it is drawn from the page itself, with modern-screenshot.
import { domToCanvas } from '../vendor/modern-screenshot.js';

// The picture's longer side, at most, and its JPEG quality: a few hundred KB.
const WIDEST = 1280;
const QUALITY = 0.8;
// Not drawn from the page: the game's own canvas (from the renderer instead),
// and what comes and goes over everything, like the dialog this started from;
// nor what only a page without JavaScript shows.
const LEFT_OUT = new Set(['world', 'modal', 'toasts', 'flash', 'loading']);
// How many of the page's latest errors go along.
const ERRORS_KEPT = 10;

const errors = [];

// From now on, the page's errors are noted, the latest few kept.
export function watchErrors(target = window) {
  const note = (text) => {
    errors.push(`${new Date().toISOString().slice(11, 19)} ${text}`.slice(0, 500));
    if (errors.length > ERRORS_KEPT) errors.shift();
  };
  target.addEventListener('error', (e) => note(e.error?.stack || `${e.message} (${e.filename}:${e.lineno})`));
  target.addEventListener('unhandledrejection', (e) => note(`Unhandled: ${e.reason?.stack || e.reason}`));
}

export const recentErrors = () => [...errors];

const loadImage = (url) =>
  new Promise((done, fail) => {
    const img = new Image();
    img.onload = () => done(img);
    img.onerror = fail;
    img.src = url;
  });

// A picture the player picked (from a phone's gallery, say: the screenshot
// the game takes cannot see everything, like what the browser itself drew),
// as a JPEG data URL no bigger than the game's own, turned the way the photo
// is meant to be seen. Rejects when the browser cannot read it.
export async function pictureFrom(file) {
  const url = URL.createObjectURL(file);
  try {
    const img = await loadImage(url);
    const scale = Math.min(1, WIDEST / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
    const ctx = canvas.getContext('2d');
    // A see-through picture on white, as JPEG has no see-through.
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', QUALITY);
  } finally {
    URL.revokeObjectURL(url);
  }
}

// The screen as a JPEG data URL: the island (from the renderer, while one is
// shown) with the page's buttons on top. Whichever half cannot be drawn is
// left out, so there is always a picture.
export async function screenshot(renderer = null) {
  const width = innerWidth;
  const height = innerHeight;
  const scale = Math.min(1, WIDEST / Math.max(width, height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(height * scale);
  const ctx = canvas.getContext('2d');
  let scene = null;
  try {
    scene = renderer ? await loadImage(renderer.photo()) : null;
  } catch {
    scene = null;
  }
  if (scene) ctx.drawImage(scene, 0, 0, canvas.width, canvas.height);
  else {
    ctx.fillStyle = getComputedStyle(document.body).backgroundColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  try {
    const page = await domToCanvas(document.body, {
      width,
      height,
      scale,
      backgroundColor: null,
      style: { background: 'transparent' },
      filter: (node) => node.nodeName !== 'NOSCRIPT' && !(node.id && LEFT_OUT.has(node.id)),
      timeout: 5000,
    });
    ctx.drawImage(page, 0, 0, canvas.width, canvas.height);
  } catch {
    // The island alone, then.
  }
  return canvas.toDataURL('image/jpeg', QUALITY);
}
