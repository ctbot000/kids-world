// Broadcast stations: a TV camera on a tripod (a piece of furniture,
// blocks.js). Walk up to one and press Go live: your own camera and
// microphone go on every TV in the game, on every island, on a channel of
// their own, 📹 On Air, for as long as you stay live.
//
// Your page is the TV station, a PeerJS peer (as the keeper's admin page is
// for a video on its computer, broadcast.js) that every TV watching calls
// for the picture and the sound. The keeper only tells every page who is on
// air and the station's peer id ({ t: 'onair-news', onAir }), as the admin
// page's broadcasts are told: one show at a time in the whole game, ended
// when its broadcaster says so or their page's connection to the keeper
// goes.
// No DOM here: the keeper and the game share it.
import { BLOCKS } from './blocks.js';
import { cellNear } from './arcade.js';
import { cleanTitle, isStationId } from './broadcast.js';

export const NAME_MAX = 40;

// Whether a block is a broadcast station (any way it faces).
export const isBroadcastStation = (id) => BLOCKS[id]?.model === 'broadcast-station';

// The broadcast station nearest a body standing beside it: { x, y, z, key } of its cell, or null.
export const stationNear = (world, body, reach = 2.2) => cellNear(world, body, (id) => (isBroadcastStation(id) ? {} : null), reach);

// Who is on air ({ name, station }), as a page asks to be or the keeper
// tells of it, checked: that, or null for nobody.
export function cleanOnAir(raw) {
  if (!raw || typeof raw !== 'object' || !isStationId(raw.station)) return null;
  const name = cleanTitle(typeof raw.name === 'string' ? [...raw.name].slice(0, NAME_MAX).join('') : '', 'Someone');
  return { name, station: raw.station };
}

// Whether two are the same show.
export const sameOnAir = (a, b) => (a && b ? a.station === b.station : a === b);

// What a TV plays for someone on air (tv-live.js): their station, live.
export const onAirShow = (onAir) => ({ kind: 'video', station: onAir.station, title: `${onAir.name}, live` });
