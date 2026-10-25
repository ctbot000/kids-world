// Screen time: the keeper's admin page locks every player at once, and
// unlocks them again. While it is on, every page connected to the keeper
// covers the game with a "screen time is over" screen and takes no input.
//
//   { since }  locked, since then (milliseconds since the epoch)
//   null       nobody is locked
//
// The keeper keeps it on disk, so a restart keeps the players locked, and
// tells pages that know of it as they connect ({ t: 'me', lock }) and as it
// changes ({ t: 'lock-news', lock }). A page keeps the last word it heard
// too, so a reload, or no keeper at all, does not unlock it.
// No DOM here: the keeper, the admin page and the game share it.

// A lock as given (by the keeper's news, or a file): the lock, or null.
export function cleanLock(raw) {
  if (!raw || typeof raw !== 'object') return null;
  return { since: Number.isFinite(raw.since) && raw.since > 0 ? Math.floor(raw.since) : 0 };
}
