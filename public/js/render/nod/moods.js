// Each dream's own sky and light (sky.js, light.js), by its chapter's key.
export const MOODS = {
  pillow: {
    sky: { top: '#16164a', mid: '#4b3f9a', low: '#c9708f', foldA: '#3a2f8a', foldB: '#c9608f', fold: 0.5, stars: 1.1, orb: { dir: [-0.5, 0.42, -0.75], color: '#fff0cf', size: 0.15, kind: 1 } },
    light: { key: '#fff0d8', sky: '#c2bcf2', earth: '#7a6aa6', rim: '#ffd6ec', rimK: 0.4, haze: '#6a58b0', hazeK: 0.0036, sun: 1.35, hemi: 0.85 },
    motes: ['#fff3c8', '#ffd6e8'],
  },
  garden: {
    sky: { top: '#1f7fe0', mid: '#7cc8f7', low: '#d5ecd6', foldA: '#ffffff', foldB: '#fff3c0', fold: 0.12, stars: 0, puffs: 0.55, puffLit: '#ffffff', puffShade: '#a9cbe8', orb: { dir: [0.5, 0.55, -0.6], color: '#fff0c0', size: 0.06, kind: 2 } },
    light: { key: '#fff2cc', sky: '#cfe4ff', earth: '#86a860', rim: '#fff6d6', rimK: 0.32, haze: '#b5dcf5', hazeK: 0.002, sun: 1.5, hemi: 0.95 },
    motes: ['#fff6b0', '#d8ffb0'],
    tint: { pad: '#b5e36a', boss: '#ffcf5a', base: '#4f8a3a' },
  },
  music: {
    sky: { top: '#120a2e', mid: '#3a1650', low: '#7a2340', foldA: '#5a1f6a', foldB: '#d9703a', fold: 0.75, stars: 0.5, orb: { dir: [0.3, 0.75, -0.55], color: '#ffc98a', size: 0.14, kind: 2 } },
    light: { key: '#ffe6bf', sky: '#b79ad6', earth: '#7a4a52', rim: '#ffb870', rimK: 0.5, haze: '#3d1850', hazeK: 0.0034, sun: 1.35, hemi: 0.8 },
    motes: ['#ffd75e', '#ff9fd0'],
    tint: { pad: '#ff8f9f', boss: '#ffd75e', base: '#6a2a4a' },
  },
  clock: {
    sky: { top: '#071a2e', mid: '#12485c', low: '#b9793a', foldA: '#1f6a7a', foldB: '#e0a84a', fold: 0.6, stars: 1.3, orb: { dir: [-0.4, 0.3, -0.8], color: '#ffe3a8', size: 0.22, kind: 1 } },
    light: { key: '#ffe9c4', sky: '#9fc9d6', earth: '#7a5a3a', rim: '#ffe0a0', rimK: 0.45, haze: '#1b5566', hazeK: 0.0032, sun: 1.4, hemi: 0.85 },
    motes: ['#ffe27a', '#9fe8ff'],
    tint: { pad: '#8fe0d6', boss: '#ffd75e', base: '#5a4a2a' },
  },
  mare: {
    sky: { top: '#030208', mid: '#100a24', low: '#2a0f3a', foldA: '#24105a', foldB: '#5a1a6a', fold: 0.8, stars: 1.5, orb: { dir: [0.2, 0.2, -0.95], color: '#8f6fd0', size: 0.12, kind: 1 } },
    light: { key: '#cdbcff', sky: '#7a6ab8', earth: '#35244f', rim: '#c08fff', rimK: 0.75, haze: '#140c28', hazeK: 0.005, sun: 1.1, hemi: 0.62 },
    motes: ['#b48fff', '#ff9fe0'],
    tint: { pad: '#8f7fd0', boss: '#ff9fe0', base: '#2f2550' },
  },
};
