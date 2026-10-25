// Screen time (shared/lock.js): while the keeper's admin page has every
// player locked, a screen over everything says screen time is over, and the
// page takes no keys, clicks or touches, and makes no sound, until the
// grown-ups unlock it.

// What a locked page takes no more of. Letting go (keyup, pointerup) still
// goes through, so nothing is left held down.
const BLOCKED = ['keydown', 'keypress', 'pointerdown', 'pointermove', 'mousedown', 'mousemove', 'click', 'dblclick', 'contextmenu', 'wheel', 'touchstart', 'touchmove'];

export class LockScreen {
  constructor(sound) {
    this.sound = sound;
    this.el = null;
    this.block = (e) => {
      e.preventDefault();
      e.stopImmediatePropagation();
    };
  }

  get locked() {
    return Boolean(this.el);
  }

  show(lock) {
    if (Boolean(lock) === this.locked) return;
    if (!lock) {
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
