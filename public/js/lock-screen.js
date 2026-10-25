// Screen time (shared/lock.js): when the keeper's admin page locks every
// player, a banner first counts down the minute left, to finish up; then a
// screen over everything says screen time is over, and the page takes no
// keys, clicks or touches, and makes no sound, until the grown-ups unlock it.

// What a locked page takes no more of. Letting go (keyup, pointerup) still
// goes through, so nothing is left held down.
const BLOCKED = ['keydown', 'keypress', 'pointerdown', 'pointermove', 'mousedown', 'mousemove', 'click', 'dblclick', 'contextmenu', 'wheel', 'touchstart', 'touchmove'];

export class LockScreen {
  constructor(sound) {
    this.sound = sound;
    this.el = null;
    this.banner = null;
    this.timer = 0;
    this.block = (e) => {
      e.preventDefault();
      e.stopImmediatePropagation();
    };
  }

  get locked() {
    return Boolean(this.el);
  }

  // The lock as the keeper says ({ at } by this page's clock), or null.
  show(lock) {
    clearTimeout(this.timer);
    this.timer = 0;
    if (!lock) {
      this.warn(0);
      this.cover(false);
      return;
    }
    const left = lock.at - Date.now();
    if (left <= 0) {
      this.warn(0);
      this.cover(true);
      return;
    }
    this.cover(false);
    this.warn(left);
    // Once a second, to the next whole second, until it locks.
    this.timer = setTimeout(() => this.show(lock), left % 1000 || 1000);
  }

  // The countdown over the game, `ms` before it locks, or none (0).
  warn(ms) {
    if (!ms) {
      this.banner?.remove();
      this.banner = null;
      return;
    }
    if (!this.banner) {
      this.banner = document.createElement('div');
      this.banner.id = 'screen-lock-warning';
      this.banner.setAttribute('role', 'status');
      document.body.append(this.banner);
    }
    const seconds = Math.ceil(ms / 1000);
    this.banner.textContent = `⏰ Screen time ends in ${seconds} ${seconds === 1 ? 'second' : 'seconds'}. Time to finish up!`;
  }

  cover(on) {
    if (on === this.locked) return;
    if (!on) {
      for (const type of BLOCKED) window.removeEventListener(type, this.block, { capture: true });
      this.el.remove();
      this.el = null;
      this.sound.ctx?.resume().catch(() => {});
      return;
    }
    for (const type of BLOCKED) window.addEventListener(type, this.block, { capture: true, passive: false });
    // Whatever was held down (walking, say) is let go; whatever was being
    // typed into stops taking keys.
    window.dispatchEvent(new Event('blur'));
    document.activeElement?.blur?.();
    this.sound.ctx?.suspend().catch(() => {});
    this.el = document.createElement('div');
    this.el.id = 'screen-lock';
    this.el.setAttribute('role', 'alertdialog');
    this.el.setAttribute('aria-modal', 'true');
    this.el.setAttribute('aria-labelledby', 'screen-lock-title');
    const icon = document.createElement('div');
    icon.className = 'screen-lock-icon';
    icon.textContent = '🌙';
    const title = document.createElement('h2');
    title.id = 'screen-lock-title';
    title.textContent = 'Screen time is over';
    const text = document.createElement('p');
    text.textContent = 'Time for a break! Your islands are safe and will be here next time.';
    this.el.append(icon, title, text);
    document.body.append(this.el);
  }
}
