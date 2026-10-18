// How finished the picture is (render/renderer.js QUALITY), chosen in
// ⚙️ Settings or left to the device. Auto starts a computer at the best, a
// tablet in the middle and a phone (or any browser drawing without a GPU) at
// the plainest, then steps down this ladder a rung at a time while frames come
// too slowly. Its last two rungs give up sharpness (fewer pixels), then the
// studs and how far you see.
export const QUALITY_CHOICES = ['auto', 'high', 'medium', 'low'];
export const RUNGS = [
  { level: 'high', sharp: true, studs: true },
  { level: 'medium', sharp: true, studs: true },
  { level: 'low', sharp: true, studs: true },
  { level: 'low', sharp: false, studs: true },
  { level: 'low', sharp: false, studs: false },
];

// The rung to start on, for a choice and a device: fine (it has a mouse or a
// trackpad), shortSide (the screen's shorter side, in CSS pixels) and software
// (it draws without a GPU).
export function startRung(choice, { fine = true, shortSide = 1080, software = false } = {}) {
  if (choice === 'high') return 0;
  if (choice === 'medium') return 1;
  if (choice === 'low') return 2;
  if (software) return 2;
  if (fine) return 0;
  return shortSide >= 600 ? 1 : 2;
}

// Whether slow frames may step down from this rung: always on auto, and on a
// chosen quality only to the rungs that keep it (the plainest one's fewer
// pixels and no studs).
export function canStepDown(choice, rung) {
  const next = RUNGS[rung + 1];
  if (!next) return false;
  return !QUALITY_CHOICES.includes(choice) || choice === 'auto' || next.level === RUNGS[rung].level;
}
