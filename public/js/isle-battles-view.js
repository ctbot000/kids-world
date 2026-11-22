// What a page shows of Toon Isle's battles, on a chapter of Adventure Isle's
// fifth episode (shared/isle-battles.js has their rules, run by the host):
// each battle as the island tells of it, the Cloud Blanket over whatever
// nobody has got to yet (the fog: what is under it is not drawn, on the
// screen or the map), what everyone sees and hears as the battles go (the
// island's `bfx` news), and the tags over each battle found (for ui.js
// adventureTags). game.js keeps the state (game.adventure.battles, .fog) and
// calls in here.
import { BATTLE_COLORS, BATTLE_ICONS, unpackFog } from './shared/isle-battles.js';
import { battleOf } from './shared/isle-story.js';

const cell = (c) => Array.isArray(c) && c.length === 3 && c.every(Number.isFinite);
const finite = (...v) => v.every(Number.isFinite);
const GOLD = ['#ffd84d', '#fff3a0', '#ffffff', '#ffb52e'];
const STORM = ['#ffffff', '#cfe8ff', '#9fd8ff', '#fff3a0'];

// ---------------------------------------------------------------- the clouds

// The Cloud Blanket as the island tells of it (adventure.js describe):
// { tile, w, h, seen (a byte for each tile), at (when each was seen, in ms of
// performance.now(): long ago for those seen before you came) }.
export function readFog(f) {
  if (!f || !Number.isInteger(f.w) || !Number.isInteger(f.h) || f.w < 1 || f.h < 1 || f.w * f.h > 1 << 16) return null;
  const tile = Number.isInteger(f.tile) && f.tile > 0 ? f.tile : 8;
  const seen = unpackFog(f.seen, f.w * f.h);
  const at = new Float64Array(f.w * f.h).fill(Infinity);
  for (let k = 0; k < seen.length; k++) if (seen[k]) at[k] = -1e9;
  return { tile, w: f.w, h: f.h, seen, at, count: seen.reduce((n, v) => n + v, 0) };
}

// Whether (x, z) has been got to (off the island's map: the open sea, always).
export function fogSeen(fog, x, z) {
  if (!fog) return true;
  const i = Math.floor(x / fog.tile);
  const j = Math.floor(z / fog.tile);
  if (i < 0 || j < 0 || i >= fog.w || j >= fog.h) return true;
  return fog.seen[i * fog.h + j] === 1;
}

// Tiles of the blanket rolled back (room.js `fog`): seen from now on, for
// everyone, the clouds there puffing away (render/cartoon.js).
export function fogNews(g, msg) {
  const fog = g.adventure?.fog;
  if (!fog || !Array.isArray(msg.a)) return;
  const now = performance.now();
  const fresh = [];
  for (const k of msg.a) {
    if (!Number.isInteger(k) || k < 0 || k >= fog.seen.length || fog.seen[k]) continue;
    fog.seen[k] = 1;
    fog.at[k] = now;
    fog.count++;
    fresh.push(k);
  }
  if (!fresh.length) return;
  g.renderer.fogChanged?.(fog, fresh);
  // The whole blanket blown away at once (a stage won): with a whoosh.
  if (msg.all) g.sound.play('blow');
  g.emit('fog');
}

// ---------------------------------------------------------------- the battles

// The battles as the island tells of them as you arrive (isle-battles.js
// describe), on the stage they are of: each with its name and what to do from
// the story (isle-story.js), checked.
export function readBattles(list, stage) {
  const out = new Map();
  for (const b of Array.isArray(list) ? list.slice(0, 6) : []) {
    if (!Number.isInteger(b?.id) || !finite(b.x, b.y, b.z) || !BATTLE_ICONS[b.kind]) continue;
    const told = battleOf(stage, b.id) ?? {};
    const s = { id: b.id, kind: b.kind, name: told.name ?? '', hint: told.hint ?? '', doneText: told.done ?? '', who: told.who ?? '', beast: told.beast ?? '', after: told.after === true, icon: BATTLE_ICONS[b.kind], color: BATTLE_COLORS[b.kind], x: b.x, y: b.y, z: b.z, r: Number.isFinite(b.r) ? b.r : 10, done: b.done === true, state: b.done === true ? 'done' : 'idle', a: 0, b: 0, c: 0 };
    if (cell(b.prize)) s.prize = b.prize;
    if (cell(b.beacon)) s.beacon = b.beacon;
    if (Array.isArray(b.spots)) s.spots = b.spots.filter(cell).slice(0, 8);
    if (Array.isArray(b.rods)) s.rods = b.rods.filter(cell).slice(0, 4);
    if (Array.isArray(b.range)) s.range = b.range.filter((p) => Array.isArray(p) && p.length === 2 && p.every(Number.isFinite)).slice(0, 400);
    out.set(s.id, s);
  }
  return out;
}

const STATE = ['idle', 'on', 'done', 'locked'];

// How one is going, as the island packs it a few times a second
// (isle-battles.js pack): [id, state, a, b, c].
export function readBattleRow(s, row) {
  if (!Array.isArray(row)) return;
  s.state = STATE[row[1]] ?? 'idle';
  if (s.state === 'done') s.done = true;
  s.a = Math.max(0, Number(row[2]) || 0);
  s.b = Math.max(0, Number(row[3]) || 0);
  s.c = Math.max(0, Number(row[4]) || 0);
}

// Whether a battle waits for the others (Baron Bluster's) and they are not
// all won yet.
export const battleLocked = (adv, b) => b.after && [...adv.battles.values()].some((o) => o !== b && !o.done);

// Whether a battle has been found: the clouds rolled back off where it is.
export const battleFound = (adv, b) => fogSeen(adv.fog, b.x, b.z);

// The hunt's Big Bad (a monster of the island's), if it is about and seen.
function bigBad(g, b) {
  if (b.kind !== 'hunt') return null;
  for (const [, e] of g.monsters) if (e.kind === b.beast && e.model?.group.visible) return e;
  return null;
}

// The island's news of a battle (room.js `bfx`): what everyone sees and
// hears, and the word for whoever is there.
export function battleFx(g, msg) {
  const adv = g.adventure;
  if (!adv?.battles || typeof msg.k !== 'string') return;
  const b = adv.battles.get(msg.id) ?? null;
  const fx = g.renderer.effects;
  const me = g.me?.body;
  const near = (x, z, d) => Boolean(me) && Math.hypot(x - me.x, z - me.z) <= d;
  const here = b ? near(b.x, b.z, (b.r ?? 10) + 30) : false;
  const toast = (icon, text) => g.emit('toast', { icon, text });
  const mon = Number.isInteger(msg.m) ? g.monsters.get(msg.m) : null;
  const mp = mon?.model?.group.position;
  switch (msg.k) {
    case 'spring': {
      if (!b) return;
      if (here) {
        g.sound.play('grumble', { big: true });
        g.renderer.shake(0.25);
        for (let i = 0; i < 24; i++) {
          const a = (i / 24) * Math.PI * 2;
          fx.add('puff', b.x + Math.cos(a) * b.r, b.y + 0.4, b.z + Math.sin(a) * b.r, { vy: 1.4, size: 0.6, life: 0.9, grow: 1.4, color: '#6fae4a', delay: i * 0.01 });
        }
        toast('💥', `It’s a trap! A ring of thorns shoots up round ${b.name.replace(/^The /, 'the ')} — pop every wave of the Storm Gang to break it!`);
      }
      break;
    }
    case 'wave':
      if (here && b) {
        g.sound.play('grumble');
        toast('👾', `Wave ${msg.n} of ${msg.of}${msg.n === msg.of ? ' — the last one!' : '!'}`);
      }
      break;
    case 'fail':
      if (here && b) toast('😵', `The trap resets: everyone inside it is out of the fight! Get your hearts back and try again — friends help!`);
      break;
    case 'lit': {
      if (!b?.beacon) return;
      const [x, y, z] = b.beacon;
      if (here) {
        fx.sparkles(x + 0.5, y + 0.8, z + 0.5, 30, ['#ffd84d', '#ff9a3d', '#ffffff']);
        g.sound.play('fanfare');
        toast('🔥', `The beacon is alight! Keep the Storm Gang off it for ${Math.round((Number(msg.ms) || 60000) / 1000)} seconds — they come from every side!`);
      }
      b.flicker = false;
      break;
    }
    case 'hit': {
      if (!b?.beacon) return;
      const [x, y, z] = b.beacon;
      if (near(x, z, 60)) {
        for (let i = 0; i < 8; i++) fx.add('sparkle', x + 0.5, y + 0.6, z + 0.5, { vx: (Math.random() - 0.5) * 4, vy: 2 + Math.random() * 2, vz: (Math.random() - 0.5) * 4, size: 0.18, life: 0.5, gravity: 6, color: i % 2 ? '#ff6b2e' : '#ffd84d' });
        g.sound.play('bump');
      }
      b.a = Math.max(0, Number(msg.hearts) || 0);
      if (here && !b.flicker && msg.max && msg.hearts <= msg.max * 0.3) {
        b.flicker = true;
        toast('⚠️', 'The beacon is flickering — get the Storm Gang off it!');
      }
      break;
    }
    case 'out':
      if (here && b) {
        g.sound.play('blow');
        toast('💨', 'The beacon went out, and the Storm Gang runs off cheering. Light it again to try again!');
      }
      break;
    case 'push':
      if (here) toast('😠', 'The Storm Gang’s last push — and something big is with them!');
      break;
    case 'wake':
      if (!b || !here) return;
      if (b.kind === 'nest') toast('🥚', 'The Storm Nests rumble awake! Bop every nest till it bursts — the monsters keep hatching till they are gone.');
      else if (b.kind === 'hunt') {
        g.sound.play('roar');
        toast('🐾', `${b.who || 'The Big Bad'} is here! Bop it — and when it runs off, run after it!`);
      }
      break;
    case 'hatch':
      if (mp && near(mp.x, mp.z, 40)) {
        for (let i = 0; i < 6; i++) fx.add('puff', mp.x + (Math.random() - 0.5) * 0.8, mp.y + 0.5, mp.z + (Math.random() - 0.5) * 0.8, { vy: 1, size: 0.4, life: 0.7, grow: 1.2, color: '#8d84b8', delay: i * 0.03 });
        g.sound.play('boing', { speed: 3 });
      }
      break;
    case 'burst':
      if (finite(msg.x, msg.y, msg.z) && near(msg.x, msg.z, 60)) {
        fx.sparkles(msg.x, msg.y + 1, msg.z, 36, STORM);
        fx.confetti(msg.x, msg.y + 1.2, msg.z, 40, 0.8);
        g.sound.play('pop');
        if (b) {
          const left = Math.max(0, b.a - 1);
          toast('🥚', left ? `A Storm Nest bursts! ${left} to go.` : 'The last Storm Nest bursts!');
        }
      }
      break;
    case 'flee':
      if (b?.kind === 'hunt' && mon) {
        if (mp && near(mp.x, mp.z, 50)) {
          g.sound.play('roar');
          toast('🐾', `${b.who || 'The Big Bad'} runs off to rest! Follow the tracks — it gets its hearts back if you let it rest.`);
        }
      } else if (finite(msg.x, msg.y, msg.z) && near(msg.x, msg.z, 50)) {
        // One of the Storm Gang running off, a battle lost to it.
        for (let i = 0; i < 6; i++) fx.add('puff', msg.x, msg.y + 0.4, msg.z, { vx: (Math.random() - 0.5) * 3, vy: 1, vz: (Math.random() - 0.5) * 3, size: 0.4, life: 0.6, grow: 1, color: '#ffffff' });
      }
      break;
    case 'rest':
      if (mp && near(mp.x, mp.z, 70)) toast('😮‍💨', `${b?.who || 'The Big Bad'} stopped to rest. Quick, before it gets its hearts back!`);
      break;
    case 'show':
      if (here) {
        g.sound.play('boom');
        toast('🎩', 'Baron Bluster floats down over his arena on his cloud, laughing! He is out of reach up there: stand on all three lightning rods at once to zap him down!');
      }
      break;
    case 'rod': {
      const r = b?.rods?.[msg.n];
      if (!r) return;
      if (near(r[0], r[2], 60)) {
        fx.sparkles(r[0] + 0.5, r[1] + 2.2, r[2] + 0.5, 24, STORM);
        g.sound.play('zap');
      }
      break;
    }
    case 'zap':
      if (finite(msg.x, msg.y, msg.z) && near(msg.x, msg.z, 90)) {
        g.renderer.sky?.strike?.({ x: Math.floor(msg.x), y: Math.floor(msg.y) - 1, z: Math.floor(msg.z) }, me ? { x: me.x, z: me.z } : null);
        fx.sparkles(msg.x, msg.y + 1.5, msg.z, 60, STORM);
        g.renderer.shake(0.4);
        g.sound.play('boom');
        toast('⚡', 'ZAP! Down tumbles Baron Bluster, all in a daze — bop him now!');
      }
      break;
    case 'drop':
      if (here) g.sound.play('grumble');
      break;
    case 'up':
      if (here) {
        g.sound.play('blow');
        toast('🎩', 'Baron Bluster puffs himself back up into the sky! Charge all three lightning rods again!');
      }
      break;
    case 'gang':
      if (finite(msg.x, msg.z) && near(msg.x, msg.z, 30)) toast('🎉', 'That whole gang of the Storm Gang is popped!');
      break;
    case 'cloud':
      // A gang of the Storm Gang dropping out of the clouds, on whoever
      // rolled them back.
      if (finite(msg.x, msg.y, msg.z) && near(msg.x, msg.z, 60)) {
        for (let i = 0; i < 18; i++) fx.add('puff', msg.x + (Math.random() - 0.5) * 6, msg.y + 5 + Math.random() * 3, msg.z + (Math.random() - 0.5) * 6, { vy: -2.5, size: 1.1, life: 1.1, grow: 1.5, color: '#e6defa', delay: i * 0.02 });
        g.sound.play('grumble', { big: true });
        if (msg.to === g.pid) toast('☁️', 'Out of the clouds! A gang of the Storm Gang drops down right in front of you!');
      }
      break;
    default:
      break;
  }
}

// A battle won (room.js battleDone): its lamp lit on the Sky Lantern, a
// fanfare, what the story says of it. Returns whether it was one of yours
// (you were there: a key quiz, as for a camp freed).
export function battleWon(g, msg) {
  const adv = g.adventure;
  const b = adv?.battles?.get(msg.id);
  if (!b) return false;
  b.done = true;
  b.state = 'done';
  const fx = g.renderer.effects;
  const lamp = adv.hub?.lamps?.[b.id - 1];
  if (lamp && g.near(lamp[0], lamp[1], lamp[2], 90)) fx.sparkles(lamp[0] + 0.5, lamp[1] + 0.6, lamp[2] + 0.5, 30, GOLD);
  if (g.near(b.x, b.y, b.z, 80)) fx.confetti(b.x, b.y + 2, b.z, 90, 1.2);
  g.sound.play('fanfare');
  const left = [...adv.battles.values()].filter((o) => !o.done).length;
  const more = left ? ` A spark flies off to the Sky Lantern — ${left === 1 ? 'one more battle' : `${left} more battles`} to go!` : '';
  g.emit('toast', { icon: '✨', text: `${b.doneText || `${b.name}: won!`}${msg.won ? '' : more}` });
  return Array.isArray(msg.by) && msg.by.includes(g.pid);
}

// Each frame, on a chapter told in battles: an untaken Lantern Spark
// glinting, a lit beacon's sparks, the lightning rods crackling while
// charged, and the Baron's dizzy stars.
export function battleFrame(g, now) {
  const adv = g.adventure;
  if (!adv?.battles) return;
  const fx = g.renderer.effects;
  const me = g.me?.body;
  if (!me) return;
  for (const b of adv.battles.values()) {
    if (b.done || !battleFound(adv, b) || Math.hypot(b.x - me.x, b.z - me.z) > 70) continue;
    if (now < (b.glintAt ?? 0)) continue;
    b.glintAt = now + 380;
    if (b.kind === 'ambush' && b.prize && b.state !== 'on') {
      const [x, y, z] = b.prize;
      fx.add('sparkle', x + 0.5 + (Math.random() - 0.5) * 0.6, y + 0.4 + Math.random() * 0.6, z + 0.5 + (Math.random() - 0.5) * 0.6, { vy: 0.7, size: 0.45, life: 0.7, color: GOLD[Math.floor(Math.random() * GOLD.length)] });
    }
    if (b.kind === 'siege' && b.beacon && b.state === 'on') {
      const [x, y, z] = b.beacon;
      fx.add('sparkle', x + 0.5 + (Math.random() - 0.5) * 0.6, y + 1.2, z + 0.5 + (Math.random() - 0.5) * 0.6, { vy: 2.4, size: 0.16, life: 0.9, color: '#ffd84d' });
    }
    if (b.kind === 'showdown' && b.rods && b.state === 'on') {
      b.rods.forEach(([x, y, z], i) => {
        if (b.b & (1 << i)) fx.add('sparkle', x + 0.5 + (Math.random() - 0.5) * 0.5, y + 2 + Math.random() * 0.5, z + 0.5 + (Math.random() - 0.5) * 0.5, { vy: 1.2, size: 0.2, life: 0.5, color: STORM[i % STORM.length] });
      });
    }
  }
}

// The tags over the battles (ui.js adventureTags draws them): over each
// battle found and not yet won, its name and how it is going; over a hunt's
// Big Bad where it is seen. Each { key, x, y, z, label, share, kind }.
export function battleTags(g, me) {
  const adv = g.adventure;
  const out = [];
  if (!adv?.battles || !me || adv.won) return out;
  for (const b of adv.battles.values()) {
    if (b.done || !battleFound(adv, b)) continue;
    const near = Math.hypot(b.x - me.x, b.z - me.z) < 30;
    let label = `${b.icon} ${b.name}`;
    let at = { x: b.x, y: b.y + 3, z: b.z };
    let share = null;
    switch (b.kind) {
      case 'ambush':
        if (b.prize) at = { x: b.prize[0] + 0.5, y: b.prize[1] + 2.2, z: b.prize[2] + 0.5 };
        if (b.state === 'on') label = `💥 Wave ${b.a} of ${b.b}!`;
        else if (near) label = '✨ A Lantern Spark… walk up to it — if you dare!';
        break;
      case 'siege':
        if (b.beacon) at = { x: b.beacon[0] + 0.5, y: b.beacon[1] + 2.4, z: b.beacon[2] + 0.5 };
        if (b.state === 'on') {
          label = `🔥 ${b.c} s · ❤️ ${b.a}/${b.b}`;
          share = b.b ? b.a / b.b : null;
        } else if (b.c > 0) {
          label = '🔥 Lighting…';
          share = b.c / 100;
        } else if (near) label = '🪵 Stand by the beacon to light it!';
        break;
      case 'nest':
        label = `${b.icon} ${b.name} · ${b.a} of ${b.b} left`;
        share = b.b ? 1 - b.a / b.b : null;
        break;
      case 'hunt': {
        const e = bigBad(g, b);
        if (!e) continue;
        const p = e.model.group.position;
        at = { x: p.x, y: p.y + (e.model.height ?? 2.2) + 1.2, z: p.z };
        label = `🐾 ${b.who || b.name}${b.c ? ' — running off!' : ''}`;
        share = b.b ? b.a / b.b : null;
        break;
      }
      case 'showdown':
        if (battleLocked(adv, b)) label = '🔒 Baron Bluster’s arena — win every other battle first!';
        else if (b.state === 'on') label = b.c ? '⚡ Bop the Baron!' : `⚡ Lightning rods: ${[0, 1, 2].filter((i) => b.b & (1 << i)).length} of 3 charged`;
        break;
      default:
        break;
    }
    out.push({ key: `battle-${b.id}`, ...at, label, share, kind: 'quest' });
    // Near you, on each lightning rod: charged or not.
    if (b.kind === 'showdown' && b.rods && b.state === 'on' && !b.c && near) {
      b.rods.forEach(([x, y, z], i) => out.push({ key: `rod-${b.id}-${i}`, x: x + 0.5, y: y + 3, z: z + 0.5, label: b.b & (1 << i) ? '⚡ Charged!' : '⚡ Stand here!', share: null, kind: 'quest' }));
    }
  }
  return out;
}

// How a battle is going, in a few words (the island card, the story).
export function battleStatus(adv, b) {
  if (b.done) return 'won ✓';
  if (!battleFound(adv, b)) return 'somewhere under the clouds…';
  if (battleLocked(adv, b)) return 'after the rest 🔒';
  switch (b.kind) {
    case 'ambush':
      return b.state === 'on' ? `wave ${b.a} of ${b.b}` : 'a trap!';
    case 'siege':
      return b.state === 'on' ? `${b.c} s to go` : 'light the beacon';
    case 'nest':
      return `${b.a} of ${b.b} nests left`;
    case 'hunt':
      return b.b ? `${Math.round((100 * b.a) / b.b)}% of its hearts` : 'find it!';
    case 'showdown':
      return b.state === 'on' ? (b.c ? 'on the ground!' : 'up on his cloud') : 'waiting…';
    default:
      return '';
  }
}
