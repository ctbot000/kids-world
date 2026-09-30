// Keyboard, mouse and touch. One finger or button does everything a small
// child needs: tap to use the tool, drag to look around. On touch screens a
// thumbstick appears wherever the left thumb lands, and there are big
// buttons for jumping and flying.

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
    this.press = null;
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
      // The left part of the screen is the thumbstick.
      if (!this.joy && x < rect.width * 0.38 && y > rect.height * 0.35) {
        this.startJoystick(e.pointerId, e.clientX, e.clientY);
        return;
      }
      this.touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (this.touches.size === 2) {
        const [a, b] = [...this.touches.values()];
        this.pinch = { d: Math.hypot(a.x - b.x, a.y - b.y) };
        if (this.press) this.press.moved = true;
        return;
      }
    }
    this.pointer = { x, y, inside: true };
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
        const [a, b] = [...this.touches.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
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
    if (e.pointerType === 'touch') {
      this.touches.delete(e.pointerId);
      if (this.touches.size < 2) this.pinch = null;
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

  ndc(x, y) {
    const rect = this.canvas.getBoundingClientRect();
    return { x: (x / rect.width) * 2 - 1, y: -(y / rect.height) * 2 + 1 };
  }

  hoverNdc() {
    if (!this.pointer.inside || this.touchMode) return null;
    return this.ndc(this.pointer.x, this.pointer.y);
  }

  // ------------------------------------------------ thumbstick

  startJoystick(id, x, y) {
    this.joy = { id, cx: x, cy: y, x: 0, y: 0 };
    if (this.joyEl) {
      this.joyEl.hidden = false;
      this.joyEl.style.left = `${x}px`;
      this.joyEl.style.top = `${y}px`;
      this.joyEl.firstElementChild.style.transform = 'translate(-50%, -50%)';
    }
  }

  moveJoystick(x, y) {
    const j = this.joy;
    const R = 56;
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
    if (this.joyEl) this.joyEl.hidden = true;
  }
}
