// Keyboard, mouse and touch. One finger or button does everything a small
// child needs: tap to use the tool, drag to look around; two fingers pinch
// to zoom, and nothing else. On touch screens a thumbstick appears wherever
// the left thumb lands, and there are big buttons for jumping and flying.

const DRAG_PX = 9;

export class Input {
  constructor(canvas, joystickEl) {
    this.canvas = canvas;
    this.joyEl = joystickEl;
    this.keys = new Set();
    this.move = { x: 0, y: 0 };
    this.jumpHeld = false;
    this.downHeld = false;
    this.pointer = { x: 0, y: 0, inside: false };
    this.press = null;
    this.touches = new Map();
    this.joy = null;
    this.pinch = null;
    this.enabled = false;
    this.handlers = {};
    this.lastTouchAt = -Infinity;

    canvas.addEventListener('pointerdown', (e) => this.onDown(e));
    window.addEventListener('pointermove', (e) => this.onMove(e));
    window.addEventListener('pointerup', (e) => this.onUp(e));
    window.addEventListener('pointercancel', (e) => this.onUp(e, true));
    canvas.addEventListener('pointerleave', (e) => {
      if (e.pointerType === 'mouse') this.pointer.inside = false;
    });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    canvas.addEventListener(
      'wheel',
      (e) => {
        e.preventDefault();
        if (this.enabled) this.emit('zoom', Math.exp(Math.sign(e.deltaY) * Math.min(Math.abs(e.deltaY), 100) * 0.0022));
      },
      { passive: false },
    );
    window.addEventListener('keydown', (e) => this.onKey(e, true));
    window.addEventListener('keyup', (e) => this.onKey(e, false));
    window.addEventListener('blur', () => this.releaseAll());
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this.releaseAll();
    });
  }

  on(name, fn) {
    this.handlers[name] = fn;
    return this;
  }

  emit(name, ...args) {
    return this.handlers[name]?.(...args);
  }

  releaseAll() {
    this.keys.clear();
    this.jumpHeld = false;
    this.downHeld = false;
    this.endPress();
    this.touches.clear();
    this.endJoystick();
    this.pinch = null;
  }

  // Touch screens get thumb controls and no hover previews. A device with a
  // mouse counts as touch only once a finger has actually been used.
  get touchMode() {
    if (performance.now() - this.lastTouchAt < 60000) return true;
    return !(window.matchMedia?.('(any-pointer: fine)').matches ?? true);
  }

  noteDevice(type) {
    if (type === 'touch') this.lastTouchAt = performance.now();
    else if (type === 'mouse') this.lastTouchAt = -Infinity;
    document.body.classList.toggle('touch', this.touchMode);
  }

  // ------------------------------------------------ keys

  onKey(e, down) {
    const tag = e.target?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
    const code = e.code;
    if (down) {
      if (!this.enabled) return;
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(code)) e.preventDefault();
      if (!e.repeat) {
        const handled = this.emit('key', code, e);
        if (handled) e.preventDefault();
      }
      this.keys.add(code);
    } else {
      this.keys.delete(code);
    }
  }

  // Movement wish from the keys and the thumbstick: x right, y forward.
  readMove() {
    let x = 0;
    let y = 0;
    const k = this.keys;
    if (k.has('KeyW') || k.has('ArrowUp')) y += 1;
    if (k.has('KeyS') || k.has('ArrowDown')) y -= 1;
    if (k.has('KeyD') || k.has('ArrowRight')) x += 1;
    if (k.has('KeyA') || k.has('ArrowLeft')) x -= 1;
    if (this.joy) {
      x += this.joy.x;
      y += this.joy.y;
    }
    const len = Math.hypot(x, y);
    if (len > 1) {
      x /= len;
      y /= len;
    }
    this.move.x = x;
    this.move.y = y;
    return this.move;
  }

  get jump() {
    return this.jumpHeld || this.keys.has('Space');
  }

  get down() {
    return this.downHeld || this.keys.has('ShiftLeft') || this.keys.has('ShiftRight') || this.keys.has('KeyC');
  }

  get run() {
    return this.keys.has('ControlLeft') || this.keys.has('KeyR') || (this.joy ? Math.hypot(this.joy.x, this.joy.y) > 0.95 : false);
  }

  // ------------------------------------------------ pointer

  onDown(e) {
    if (!this.enabled) return;
    this.emit('unlock');
    this.noteDevice(e.pointerType);
    const rect = this.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    if (e.pointerType === 'touch') {
      // A touch on (or near) the thumbstick moves you.
      const base = this.joyEl?.getBoundingClientRect();
      if (!this.joy && base?.width > 0) {
        const cx = base.left + base.width / 2;
        const cy = base.top + base.height / 2;
        if (Math.hypot(e.clientX - cx, e.clientY - cy) < base.width * 0.8) {
          this.startJoystick(e.pointerId, cx, cy);
          this.moveJoystick(e.clientX, e.clientY);
          return;
        }
      }
      this.touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (this.touches.size >= 2) {
        // A second finger makes it a pinch, which only zooms: what the first
        // one started is over, holding to keep building included.
        this.endPress();
        this.pinch = { d: this.spread() };
        return;
      }
    }
    this.pointer = { x, y, inside: true };
    if (e.button === 1) {
      // The middle button picks up the kind of block under the pointer.
      e.preventDefault();
      this.emit('pickBlock', this.ndc(x, y));
      return;
    }
    this.press = { id: e.pointerId, x: e.clientX, y: e.clientY, lx: e.clientX, ly: e.clientY, moved: false, button: e.button, type: e.pointerType, at: performance.now() };
    if (e.button === 0) this.emit('hold', true, this.ndc(x, y));
  }

  onMove(e) {
    const rect = this.canvas.getBoundingClientRect();
    if (this.joy && e.pointerId === this.joy.id) {
      this.moveJoystick(e.clientX, e.clientY);
      return;
    }
    if (e.pointerType === 'touch' && this.touches.has(e.pointerId)) {
      this.touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (this.pinch && this.touches.size >= 2) {
        const d = this.spread();
        if (d > 10 && this.pinch.d > 10) this.emit('zoom', this.pinch.d / d);
        this.pinch.d = d;
        return;
      }
    }
    if (e.pointerType === 'mouse') {
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const inside = e.target === this.canvas;
      this.pointer = { x, y, inside };
    }
    const p = this.press;
    if (!p || p.id !== e.pointerId) return;
    if (!p.moved && Math.hypot(e.clientX - p.x, e.clientY - p.y) > DRAG_PX) {
      p.moved = true;
      this.emit('hold', false);
    }
    if (p.moved) {
      this.emit('orbit', e.clientX - p.lx, e.clientY - p.ly, p.type);
      p.lx = e.clientX;
      p.ly = e.clientY;
    } else if (e.pointerType !== 'mouse') {
      this.pointer = { x: e.clientX - rect.left, y: e.clientY - rect.top, inside: true };
    }
  }

  onUp(e, cancelled = false) {
    if (this.joy && e.pointerId === this.joy.id) {
      this.endJoystick();
      return;
    }
    if (e.pointerType === 'touch' && this.touches.delete(e.pointerId) && this.pinch) {
      if (this.touches.size >= 2) this.pinch.d = this.spread();
      else {
        // The finger left down turns the camera from where it is now, and never taps.
        this.pinch = null;
        for (const [id, t] of this.touches) this.press = { id, x: t.x, y: t.y, lx: t.x, ly: t.y, moved: true, button: 0, type: 'touch', at: performance.now() };
      }
      return;
    }
    // The gesture belongs to where it started, not to what is under the release.
    const p = this.press;
    if (!p || p.id !== e.pointerId) return;
    this.press = null;
    this.emit('hold', false);
    if (cancelled || p.moved) return;
    const rect = this.canvas.getBoundingClientRect();
    const x = p.x - rect.left;
    const y = p.y - rect.top;
    this.emit('tap', this.ndc(x, y), p.button, p.type);
  }

  // Ends a press without a tap, and tells the game the button is up.
  endPress() {
    if (!this.press) return;
    this.press = null;
    this.emit('hold', false);
  }

  // How far apart the two fingers of a pinch are.
  spread() {
    const [a, b] = this.touches.values();
    return Math.hypot(a.x - b.x, a.y - b.y);
  }

  ndc(x, y) {
    const rect = this.canvas.getBoundingClientRect();
    return { x: (x / rect.width) * 2 - 1, y: -(y / rect.height) * 2 + 1 };
  }

  hoverNdc() {
    if (!this.pointer.inside || this.touchMode) return null;
    return this.ndc(this.pointer.x, this.pointer.y);
  }

  // ------------------------------------------------ thumbstick

  startJoystick(id, cx, cy) {
    this.joy = { id, cx, cy, x: 0, y: 0 };
    this.joyEl?.classList.add('active');
  }

  moveJoystick(x, y) {
    const j = this.joy;
    const R = 52;
    let dx = x - j.cx;
    let dy = y - j.cy;
    const d = Math.hypot(dx, dy);
    if (d > R) {
      dx = (dx / d) * R;
      dy = (dy / d) * R;
    }
    j.x = dx / R;
    j.y = -dy / R;
    if (this.joyEl) this.joyEl.firstElementChild.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
  }

  endJoystick() {
    this.joy = null;
    if (this.joyEl) {
      this.joyEl.classList.remove('active');
      this.joyEl.firstElementChild.style.transform = 'translate(-50%, -50%)';
    }
  }
}
