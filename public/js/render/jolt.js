// What a blow does to the whole picture. Moving the camera while it keeps
// looking at the same spot hardly shows, as what it looks at stays put on
// the screen. So this moves the picture itself (renderer.updateCamera): kicked
// the moment a blow lands, then springing back past where it was and settling,
// all in about a quarter of a second, a little tipped and pushed in as it goes.
// All of it is in shares of the screen's height (and radians), so it looks the
// same on any screen and from any way the camera stands.

// How quick the spring is, and how soon it settles: 9 times a second, losing
// most of each swing.
const OMEGA = 2 * Math.PI * 9;
const DAMP = 0.42;
const K = OMEGA * OMEGA;
const C = 2 * DAMP * OMEGA;
// A frame that comes late still steps the spring in small steps: one big step
// would throw it further than it was kicked.
const STEP = 1 / 240;
// How soon a push in dies away (it does not spring back past where it was).
const ZOOM_FADE = 13;
// Nothing a blow does moves the picture further than this.
const MAX_SHIFT = 0.07;
const MAX_ROLL = 0.05;
const MAX_ZOOM = 0.1;
// The ground shaking, by shake(amount): that much is about this share of the
// screen's height, dying away by SHAKE_FADE a second.
const SHAKE_SCALE = 0.06;
const SHAKE_FADE = 1.2;
const REST = 1e-4;

const clamp = (v, max) => Math.max(-max, Math.min(max, v));

export class Jolt {
  constructor() {
    this.x = 0;
    this.y = 0;
    this.roll = 0;
    this.zoom = 0;
    this.vx = 0;
    this.vy = 0;
    this.vRoll = 0;
    this.shaking = 0;
    this.time = 0;
    this.shakeX = 0;
    this.shakeY = 0;
    this.fresh = false;
  }

  // A blow: the picture kicked across (x, y; y is down), tipped by roll and
  // pushed in by zoom, at once. Another on top of it adds to it.
  hit({ x = 0, y = 0, roll = 0, zoom = 0 } = {}) {
    this.x = clamp(this.x + x, MAX_SHIFT);
    this.y = clamp(this.y + y, MAX_SHIFT);
    this.roll = clamp(this.roll + roll, MAX_ROLL);
    this.zoom = Math.min(MAX_ZOOM, this.zoom + zoom);
    this.fresh = true;
  }

  // The ground shaking under you: not one kick but a rattle, dying away.
  shake(amount) {
    this.shaking = Math.max(this.shaking, amount);
  }

  update(dt) {
    // The first frame after a blow shows the whole of the kick, not what is left
    // of it a frame on: at this speed that would be less than half.
    const spring = this.fresh ? 0 : dt;
    this.fresh = false;
    for (let left = spring; left > 0; left -= STEP) {
      const h = Math.min(STEP, left);
      this.vx += (-K * this.x - C * this.vx) * h;
      this.vy += (-K * this.y - C * this.vy) * h;
      this.vRoll += (-K * this.roll - C * this.vRoll) * h;
      this.x += this.vx * h;
      this.y += this.vy * h;
      this.roll += this.vRoll * h;
    }
    if (Math.abs(this.x) + Math.abs(this.vx) * 0.02 < REST) this.x = this.vx = 0;
    if (Math.abs(this.y) + Math.abs(this.vy) * 0.02 < REST) this.y = this.vy = 0;
    if (Math.abs(this.roll) + Math.abs(this.vRoll) * 0.02 < REST) this.roll = this.vRoll = 0;
    this.zoom *= Math.exp(-spring * ZOOM_FADE);
    if (this.zoom < REST) this.zoom = 0;
    this.time += dt;
    const k = this.shaking * SHAKE_SCALE;
    this.shakeX = k * Math.sin(this.time * 197) * Math.cos(this.time * 71);
    this.shakeY = k * Math.sin(this.time * 233 + 1) * Math.cos(this.time * 53);
    this.shaking = Math.max(0, this.shaking - dt * SHAKE_FADE);
    return this;
  }

  // Where the picture is now, ground shaking and all.
  get shiftX() {
    return this.x + this.shakeX;
  }

  get shiftY() {
    return this.y + this.shakeY;
  }

  // Whether it is anywhere but where it belongs.
  get moved() {
    return this.x !== 0 || this.y !== 0 || this.zoom !== 0 || this.shakeX !== 0 || this.shakeY !== 0;
  }
}
