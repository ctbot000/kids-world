// A steady interval that keeps going while the tab is in the background.
// Browsers slow a hidden page's own timers to once a second (and later to
// once a minute), which would freeze the island for every visitor whenever
// the host looks at another tab. A worker's timers are not slowed like that,
// and its messages still wake the page.

export function ticker(ms, fn) {
  let worker = null;
  let url = null;
  try {
    const source = `let id = setInterval(() => postMessage(0), ${ms}); onmessage = () => clearInterval(id);`;
    url = URL.createObjectURL(new Blob([source], { type: 'text/javascript' }));
    worker = new Worker(url);
    worker.onmessage = () => fn();
  } catch {
    worker = null;
  }
  if (!worker) {
    const id = setInterval(fn, ms);
    return () => clearInterval(id);
  }
  return () => {
    worker.postMessage('stop');
    worker.terminate();
    URL.revokeObjectURL(url);
  };
}
