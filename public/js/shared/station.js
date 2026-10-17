// Broadcast stations: a TV camera on a tripod (a piece of furniture,
// blocks.js). Walk up to one and press Go live: your own camera and
// microphone go on every TV on the island, on a channel of their own,
// 📹 On Air, for as long as you stay live.
//
// Your page is the TV station, a PeerJS peer (as the keeper's admin page is
// for a video on its computer, broadcast.js) that every TV watching calls
// for the picture and the sound. The island only tells everyone who is on
// air and the station's peer id (room.js): one show at a time, ended when
// its broadcaster says so or leaves.
import { BLOCKS } from './blocks.js';
import { cellNear } from './arcade.js';
import { isStationId } from './broadcast.js';

// Whether a block is a broadcast station (any way it faces).
export const isBroadcastStation = (id) => BLOCKS[id]?.model === 'broadcast-station';

// The broadcast station nearest a body standing beside it: { x, y, z, key } of its cell, or null.
export const stationNear = (world, body, reach = 2.2) => cellNear(world, body, (id) => (isBroadcastStation(id) ? {} : null), reach);

// Who is on air on an island, as it tells of it ({ pid, name, station }),
// checked: that, or null for nobody.
export function cleanOnAir(raw) {
  if (!raw || typeof raw !== 'object' || !Number.isInteger(raw.pid) || raw.pid <= 0 || !isStationId(raw.station)) return null;
  return { pid: raw.pid, name: typeof raw.name === 'string' ? raw.name.slice(0, 40) : '', station: raw.station };
}

// What a TV plays for someone on air (tv-live.js): their station, live.
export const onAirShow = (onAir) => ({ kind: 'video', station: onAir.station, title: onAir.name ? `${onAir.name}, live` : 'Live from the island' });
