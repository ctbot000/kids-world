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
  // Where the souls of the soul weapons are fought (shared/nod/worlds/souls.js).
  soulstar: {
    sky: { top: '#03051c', mid: '#101c66', low: '#3a2f9a', foldA: '#1f3fd0', foldB: '#c98a2a', fold: 0.7, stars: 2.2, orb: { dir: [-0.3, 0.5, -0.8], color: '#ffe9a0', size: 0.1, kind: 2 } },
    light: { key: '#fff2cc', sky: '#9fb4ff', earth: '#4a4f9a', rim: '#ffe27a', rimK: 0.55, haze: '#141f6a', hazeK: 0.003, sun: 1.35, hemi: 0.85 },
    motes: ['#fff3a0', '#9fd8ff'],
  },
  soulrainbow: {
    sky: { top: '#2a6fe0', mid: '#8fb8ff', low: '#ffd0ec', foldA: '#ffb0e0', foldB: '#a0ffd8', fold: 0.55, stars: 0.5, puffs: 0.35, puffLit: '#ffffff', puffShade: '#c9b8f2', orb: { dir: [0.45, 0.5, -0.7], color: '#fff3d6', size: 0.07, kind: 2 } },
    light: { key: '#e8dccc', sky: '#aeb9e0', earth: '#a27aa8', rim: '#ffffff', rimK: 0.3, haze: '#c9c8ff', hazeK: 0.0024, sun: 1.3, hemi: 0.85 },
    motes: ['#ff9fe0', '#9fffe0'],
  },
  soulwild: {
    sky: { top: '#0a1f2a', mid: '#1f4f4a', low: '#d98a3a', foldA: '#2f7a4a', foldB: '#ffb04a', fold: 0.6, stars: 1, orb: { dir: [0.2, 0.12, -0.95], color: '#ffc46a', size: 0.2, kind: 2 } },
    light: { key: '#ffe0a8', sky: '#9fd0b8', earth: '#5a5a3a', rim: '#ffcf7a', rimK: 0.5, haze: '#2f5a4a', hazeK: 0.0036, sun: 1.4, hemi: 0.8 },
    motes: ['#d8ff8a', '#ffd07a'],
  },
  soulbells: {
    sky: { top: '#3a1206', mid: '#a8481a', low: '#ffd27a', foldA: '#ffb04a', foldB: '#ff7a3a', fold: 0.5, stars: 0.4, orb: { dir: [-0.4, 0.22, -0.88], color: '#fff0b0', size: 0.16, kind: 2 } },
    light: { key: '#fff0c4', sky: '#ffcf9a', earth: '#8a4a2a', rim: '#fff0b0', rimK: 0.5, haze: '#c9702f', hazeK: 0.0028, sun: 1.45, hemi: 0.85 },
    motes: ['#fff0b0', '#ffb04a'],
  },
  soultoon: {
    sky: { top: '#3a1f8f', mid: '#ff5cb0', low: '#ffd84d', foldA: '#3ad0ff', foldB: '#8aff6a', fold: 0.6, stars: 0.3, puffs: 0.4, puffLit: '#ffffff', puffShade: '#ffb0dc', orb: { dir: [0.4, 0.45, -0.8], color: '#fff9c0', size: 0.1, kind: 1 } },
    light: { key: '#eadfce', sky: '#d0a8c4', earth: '#7a68b0', rim: '#ffffff', rimK: 0.28, haze: '#ff9fd0', hazeK: 0.0024, sun: 1.3, hemi: 0.85 },
    motes: ['#ff7ad9', '#3ad0ff'],
  },
  soulnod: {
    sky: { top: '#050214', mid: '#1f1450', low: '#4a2a8a', foldA: '#4a33c8', foldB: '#b98cff', fold: 0.65, stars: 1.9, orb: { dir: [-0.35, 0.45, -0.82], color: '#efe6ff', size: 0.2, kind: 1 } },
    light: { key: '#e6dcff', sky: '#9f8fe0', earth: '#4a3f8a', rim: '#d8c4ff', rimK: 0.6, haze: '#1f1550', hazeK: 0.0036, sun: 1.25, hemi: 0.75 },
    motes: ['#d8c4ff', '#ffe9a8'],
  },
  // A bedtime sky, a reading lamp glowing low in it.
  soulbook: {
    sky: { top: '#060d2e', mid: '#1f3388', low: '#e8995a', foldA: '#3d6bff', foldB: '#ffd98a', fold: 0.6, stars: 1.5, puffs: 0.25, puffLit: '#ffe9c4', puffShade: '#5a62a8', orb: { dir: [0.35, 0.3, -0.88], color: '#ffe2a8', size: 0.16, kind: 2 } },
    light: { key: '#fff0d4', sky: '#a9b8f0', earth: '#7a6a5a', rim: '#ffe2a8', rimK: 0.5, haze: '#25307a', hazeK: 0.003, sun: 1.4, hemi: 0.85 },
    motes: ['#ffe9b0', '#9fb8ff'],
  },
};
