// Screen time: the keeper's admin page locks every player at once, and
// unlocks them again. Players get a minute's warning first, counting down;
// then every page connected to the keeper covers the game with a "screen
// time is over" screen and takes no input.
//
//   { since, at }  locking since `since`, and locked from `at` (milliseconds
//                  since the epoch, by the keeper's clock)
//   null           nobody is locked
//
// The keeper keeps it on disk, so a restart keeps the players locked, and
// tells pages that know of it as they connect ({ t: 'me', lock }) and as it
// changes ({ t: 'lock-news', lock }), with `left`: how many milliseconds
// until it locks (0 once it has), so a page's own clock need not agree with
// the keeper's. A page keeps the last word it heard too, so a reload, or no
// keeper at all, does not unlock it.
// No DOM here: the keeper, the admin page and the game share it.

export const LOCK_WARNING_MS = 60_000;

// A lock as given (by the keeper's news, or a file): the lock, or null. One
// with no `at` (from before the warning) locks at once.
export function cleanLock(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const since = Number.isFinite(raw.since) && raw.since > 0 ? Math.floor(raw.since) : 0;
  const at = Number.isFinite(raw.at) && raw.at > since ? Math.floor(raw.at) : since;
  return { since, at };
}

// A lock as the keeper tells pages of it, `now` by its clock.
export const lockNews = (lock, now) => (lock ? { ...lock, left: Math.max(0, lock.at - now) } : null);
