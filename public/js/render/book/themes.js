// The colours of each story of the Storybook (shared/book/stories), as its
// pages are painted: its sky, the ground and blocks and planks of its page
// (terrain.js), what lies at the bottom of its pits, the hills and things far
// off behind it (backdrop.js), and its light for whoever stands on it.
export const THEMES = {
  meadow: {
    sky: ['#7cc8f7', '#bfe6ff', '#f2fbff'],
    sun: '#fff1a8',
    ground: { fill: '#b47a4e', top: '#6cc04a', topLight: '#a5e26e', under: '#8f5d38', speck: '#d29a68', pattern: 'pebbles' },
    block: { fill: '#e8b866', top: '#f6d58e', topLight: '#fff1c0', under: '#c99549', speck: '#f3cd85', pattern: 'planks' },
    plank: { fill: '#c98a4b', light: '#e3ab6c', style: 'board' },
    pit: { fill: '#58b7ea', light: '#a8e1ff', kind: 'water' },
    far: ['#b5e48c', '#99d98c'],
    mid: ['#76c893', '#52b69a'],
    near: '#57a83f',
    clouds: '#ffffff',
    light: { key: '#fff7e6', sky: '#cfeeff', earth: '#b8d89a', sun: 2.4, hemi: 1.5 },
  },
  harbor: {
    sky: ['#79c7f2', '#c8ecff', '#fff4dc'],
    sun: '#fff0b0',
    ground: { fill: '#f0cf86', top: '#fbe5ad', topLight: '#fff6d8', under: '#d7b067', speck: '#e2b96e', pattern: 'sand' },
    block: { fill: '#a8693d', top: '#c58a55', topLight: '#dfaa72', under: '#81502c', speck: '#bb7c4a', pattern: 'hull' },
    plank: { fill: '#b98250', light: '#d8a16d', style: 'board' },
    pit: { fill: '#2f86cc', light: '#8fd0ff', kind: 'water' },
    far: ['#a8d8f0', '#7fbde6'],
    mid: ['#5fa8d8', '#3d8fd1'],
    near: '#e8c77a',
    clouds: '#ffffff',
    light: { key: '#fff6e4', sky: '#d0f0ff', earth: '#f0dca8', sun: 2.4, hemi: 1.5 },
  },
  turret: {
    sky: ['#8fcff7', '#d2ecff', '#fff0f7'],
    sun: '#fff3c0',
    ground: { fill: '#8a6342', top: '#5cb24a', topLight: '#94da6c', under: '#6c4b30', speck: '#a57b56', pattern: 'pebbles' },
    block: { fill: '#b9b2cc', top: '#d9d4e8', topLight: '#f1eefa', under: '#938cab', speck: '#cbc5dc', pattern: 'bricks' },
    plank: { fill: '#9c6b3f', light: '#bf8b5a', style: 'board' },
    pit: { fill: '#4a9fd6', light: '#9fd6ff', kind: 'water' },
    far: ['#c9d8f0', '#aebfe3'],
    mid: ['#8fb7a0', '#6a9c86'],
    near: '#4e9a45',
    clouds: '#ffffff',
    light: { key: '#fff5ea', sky: '#dbeeff', earth: '#c2c9a0', sun: 2.3, hemi: 1.5 },
  },
  starry: {
    sky: ['#121540', '#2a2a6e', '#5b3f93'],
    sun: '#fff6c8',
    night: true,
    ground: { fill: '#dfe4ff', top: '#ffffff', topLight: '#ffffff', under: '#a9b1e6', speck: '#f3f5ff', pattern: 'puffs', scallop: [0.13, 2] },
    block: { fill: '#ffcf4a', top: '#ffe07a', topLight: '#fff1b0', under: '#e0a92c', speck: '#e8b53a', pattern: 'cheese' },
    plank: { fill: '#e8ecff', light: '#ffffff', style: 'cloud' },
    pit: { fill: '#2a2462', light: '#6b5fc4', kind: 'clouds' },
    far: ['#3b3a85', '#2e2f78'],
    mid: ['#4b3f99', '#3d3488'],
    near: '#6d61b8',
    clouds: '#8f86d6',
    light: { key: '#e9e6ff', sky: '#8c8ce8', earth: '#5b4fa8', sun: 2.0, hemi: 1.7 },
  },
  inkwell: {
    sky: ['#1d1430', '#3a2652', '#6a4a80'],
    sun: '#e6d8ff',
    night: true,
    ground: { fill: '#45395c', top: '#7a6aa0', topLight: '#a897cc', under: '#30263f', speck: '#5a4c74', pattern: 'blots' },
    block: { fill: '#5d4b73', top: '#8b78a8', topLight: '#b4a3d2', under: '#3f3152', speck: '#6e5c86', pattern: 'bricks' },
    plank: { fill: '#6b5584', light: '#9480b0', style: 'board' },
    pit: { fill: '#120b1f', light: '#5c3f88', kind: 'ink' },
    far: ['#2e2145', '#3a2a55'],
    mid: ['#4a3566', '#3d2c57'],
    near: '#5a4677',
    clouds: '#6c5590',
    light: { key: '#efe6ff', sky: '#9a86cc', earth: '#4a3a66', sun: 2.1, hemi: 1.7 },
  },
};

// How far the camera stands off the page (render/book/view.js), and how much
// of it, top to bottom, it sees.
export const BOOK_D = 60;
export const BOOK_VIEW_H = 10.5;

export const themeOf = (key) => THEMES[key] ?? THEMES.meadow;
