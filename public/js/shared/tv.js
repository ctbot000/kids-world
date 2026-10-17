// TVs: the TV on its stand, a Retro TV with rabbit-ear antennae and a Wall
// TV that hangs on a wall (pieces of furniture, blocks.js), their screens
// glowing. Walk up to one and press Watch: its picture opens in a window,
// a show on each of a few channels (render/tv-shows.js draws them), to
// flip through.
//
// It all happens on your own page: everyone watches what they like. And
// while the keeper's admin page has something on air (broadcast.js), every
// TV has one channel more after these, 📡 Live, the same on every TV; and
// while someone on the island is live from a broadcast station (station.js),
// one more, 📹 On Air, their camera.
import { BLOCKS } from './blocks.js';
import { cellNear } from './arcade.js';

// The channels, in order: 1 to 5 on a keyboard.
export const CHANNELS = [
  { key: 'fish', icon: '🐠', name: 'Fish Tank' },
  { key: 'bunny', icon: '🐰', name: 'Bunny Hop' },
  { key: 'space', icon: '🚀', name: 'Space Trip' },
  { key: 'weather', icon: '🌦️', name: 'Island Weather' },
  { key: 'dance', icon: '🪩', name: 'Dance Party' },
];

export const LIVE = { key: 'live', icon: '📡', name: 'Live' };
export const ON_AIR = { key: 'onair', icon: '📹', name: 'On Air' };

// The channels a TV has: someone on the island on air from a broadcast
// station (onAir), and the keeper's live one (live), as there are.
export const channelsWith = (live, onAir = null) => (live || onAir ? [...CHANNELS, ...(onAir ? [ON_AIR] : []), ...(live ? [LIVE] : [])] : CHANNELS);

// The channel a step (+1 or -1) along from channel i of n, round and round.
export const nextChannel = (i, step, n = CHANNELS.length) => (((i + step) % n) + n) % n;

const MODELS = { tv: 'TV', 'retro-tv': 'Retro TV', 'wall-tv': 'Wall TV' };

// Whether a block is a TV, of any kind (any way it faces).
export const isTv = (id) => BLOCKS[id]?.model in MODELS;

// The TV nearest a body standing beside it: { x, y, z, key, name } of its
// cell, or null. A Wall TV hangs higher than you stand, so up to two cells
// over your feet.
export const tvNear = (world, body, reach = 2.2) => cellNear(world, body, (id) => (isTv(id) ? { name: MODELS[BLOCKS[id].model] } : null), reach, 2);
