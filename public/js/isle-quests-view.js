// What a page shows of Jinx the Magpie's challenges, on a chapter of Adventure
// Isle's fourth episode (shared/isle-quests.js has their rules, run by the
// host): each challenge as the island tells of it, what everyone sees and
// hears as it goes (the island's `qfx` news), the glints that give away where
// the shinies are, the Singing Stones singing their tune, and the tags over
// each challenge, its monkey, its lost animals, its bonfires and Jinx (for
// ui.js adventureTags). game.js keeps the state (game.adventure.quests) and
// calls in here.
import { bossSays } from './boss-voice.js';
import * as B from './shared/blocks.js';
import { LOCK_COLORS, questIcon } from './shared/isle-quests.js';
import { questOf } from './shared/isle-story.js';

const cell = (c) => Array.isArray(c) && c.length === 3 && c.every(Number.isFinite);
const finite = (...v) => v.every(Number.isFinite);
// The Singing Stones' colours and notes: red, yellow, green and blue, singing
// C, E, G and the C above.
export const STONE_COLORS = ['#ef4b3f', '#ffd23a', '#4cc35a', '#3f7ee8'];
const STONE_NOTES = [72, 76, 79, 84];
const GOLD = ['#ffd84d', '#fff3a0', '#ffffff', '#ffb52e'];
// How far off the shinies still left glint, now and then.
const GLINT_NEAR = 26;

// The challenges as the island tells of them as you arrive (adventure.js
// describe: isle-quests.js Quests.describe), on the stage they are of: each
// with its name and what to do from the story (isle-story.js), checked.
export function readQuests(list, stage) {
  const quests = new Map();
  for (const q of Array.isArray(list) ? list.slice(0, 4) : []) {
    if (!Number.isInteger(q?.id) || !finite(q.x, q.y, q.z) || typeof q.kind !== 'string') continue;
    const told = questOf(stage, q.id) ?? {};
    const animal = told.animal ?? (typeof q.animal === 'string' ? q.animal : undefined);
    const s = { id: q.id, kind: q.kind, name: told.name ?? '', hint: told.hint ?? '', doneText: told.done ?? '', animal, icon: questIcon({ kind: q.kind, animal }), x: q.x, y: q.y, z: q.z, done: q.done === true, after: q.after === true, n: 0, of: 1, left: [], phase: 0, color: LOCK_COLORS[(q.id - 1) % LOCK_COLORS.length] };
    if (Array.isArray(q.spots)) s.spots = q.spots.filter(cell).slice(0, 16);
    if (cell(q.at)) s.at = q.at;
    if (Number.isInteger(q.cid)) s.cid = q.cid;
    if (Array.isArray(q.flock)) s.flock = q.flock.filter(Number.isInteger).slice(0, 12);
    if (q.home && finite(q.home.x, q.home.y, q.home.z, q.home.r)) s.home = { x: q.home.x, y: q.home.y, z: q.home.z, r: q.home.r };
    if (Array.isArray(q.fires)) s.fires = q.fires.filter(cell).slice(0, 8);
    if (Number.isFinite(q.burn)) s.burn = q.burn;
    if (Array.isArray(q.pads)) s.pads = q.pads.filter(cell).slice(0, 4);
    if (cell(q.start)) s.start = q.start;
    if (cell(q.perch)) s.perch = q.perch;
    if (cell(q.land)) s.land = q.land;
    readRow(s, q.p);
    quests.set(s.id, s);
  }
  return quests;
}

// How one is going, as the island packs it a few times a second
// (isle-quests.js pack): [id, done, so far, of how many, and its kind's own].
export function readRow(s, row) {
  if (!Array.isArray(row)) return;
  s.done = row[1] === 1;
  s.n = Math.max(0, Number(row[2]) || 0);
  s.of = Math.max(1, Number(row[3]) || 1);
  const rest = row.slice(4, 14).map((v) => Math.max(0, Number(v) || 0));
  if (s.kind === 'fires') s.left = rest;
  else if (s.kind === 'stones') s.phase = rest[0] ?? 0;
  else if (s.kind === 'jinx') {
    s.phase = rest[0] ?? 0;
    s.left = rest.slice(1);
  }
}

// Whether a challenge waits for the others (the last, catching Jinx) and
// they are not all beaten yet.
export const questLocked = (adv, q) => q.after && [...adv.quests.values()].some((o) => o !== q && !o.done);

// The island's news of a challenge (room.js `qfx`): what everyone sees and
// hears, and the word for whoever it was.
export function questFx(g, msg) {
  const adv = g.adventure;
  const q = adv?.quests?.get(msg.id);
  if (!q || typeof msg.k !== 'string') return;
  const fx = g.renderer.effects;
  const mine = msg.by === g.pid;
  const who = mine ? 'You' : (g.players.get(msg.by)?.name ?? 'Someone');
  const critter = Number.isInteger(msg.cid) ? g.critters.get(msg.cid) : null;
  const pos = critter?.model?.group.position;
  const named = critter?.name || (q.kind === 'jinx' ? 'Jinx' : 'it');
  const toast = (icon, text) => g.emit('toast', { icon, text });
  switch (msg.k) {
    case 'found': {
      if (!cell(msg.at)) return;
      const [x, y, z] = msg.at;
      if (g.near(x, y, z, 60)) {
        fx.sparkles(x + 0.5, y + 0.5, z + 0.5, 26, GOLD);
        g.sound.play('collect');
      }
      if (mine || g.near(x, y, z, 30)) toast('✨', `${mine ? 'You found one!' : `${who} found one!`} ${msg.n} of ${msg.of} — ${q.name}`);
      break;
    }
    case 'top': {
      if (!cell(msg.at)) return;
      const [x, y, z] = msg.at;
      if (g.near(x, y, z, 80)) {
        fx.sparkles(x + 0.5, y + 0.6, z + 0.5, 40, GOLD);
        g.sound.play('treasure');
      }
      toast('🗝️', `${who} reached the golden key at the top of ${q.name.replace(/^The /, 'the ')}!`);
      break;
    }
    case 'flee':
      if (pos && g.near(pos.x, pos.y, pos.z, 30)) {
        g.sound.play('monkey');
        if (!q.toldFlee) {
          q.toldFlee = true;
          toast('🐒', `${named} runs off, giggling! Run after ${named} — and watch out, ${q.of > 1 ? `you have to catch ${named} ${q.of} times!` : 'a monkey can jink aside!'}`);
        }
      }
      break;
    case 'puff':
      if (pos && g.near(pos.x, pos.y, pos.z, 30)) {
        for (let i = 0; i < 3; i++) fx.add('puff', pos.x + (Math.random() - 0.5) * 0.4, pos.y + 0.8, pos.z + (Math.random() - 0.5) * 0.4, { vy: 0.6, size: 0.25, life: 0.6, grow: 0.8, color: '#ffffff', delay: i * 0.15 });
      }
      break;
    case 'jink':
      if (pos && g.near(pos.x, pos.y, pos.z, 20)) g.sound.play('boing', { speed: 6 });
      break;
    case 'caught': {
      const at = finite(msg.x, msg.y, msg.z) ? { x: msg.x, y: msg.y, z: msg.z } : pos;
      if (at && g.near(at.x, at.y, at.z, 60)) {
        fx.sparkles(at.x, at.y + 1, at.z, 30, GOLD);
        fx.stars(at.x, at.y + 1.2, at.z, 6);
        g.sound.play(q.kind === 'jinx' ? 'magpie' : 'laugh');
      }
      const left = msg.of - msg.n;
      toast(q.kind === 'jinx' ? '🐦' : '🐒', `${who} caught ${named}! ${left > 0 ? `${msg.n} of ${msg.of} — ${left === 1 ? 'once more' : `${left} more times`}!` : ''}${left > 0 && q.kind === 'jinx' ? ' Up he flaps again — light the beacons again!' : ''}`);
      break;
    }
    case 'escaped':
      if (pos && g.near(pos.x, pos.y, pos.z, 80)) g.sound.play('magpie');
      toast('🐦', 'Jinx shook off the dazzle and flapped back up to his nest! Light every beacon again — and catch him quicker next time!');
      break;
    case 'follow':
      if (pos && g.near(pos.x, pos.y, pos.z, 30)) g.sound.play(q.animal === 'sheep' ? 'sheep' : 'chick');
      if (mine) toast(questIcon(q), `${named} is following you! Lead ${q.animal === 'sheep' ? 'it into the fold' : 'it into the coop'} — not too fast!`);
      break;
    case 'lost':
      if (mine) toast(questIcon(q), `${named} lost you! Go back and fetch it again.`);
      break;
    case 'scramble': {
      // Stuck where it could not climb out, it scrambled up after whoever
      // leads it: a puff where it was, and a hop.
      for (const at of [msg.from, msg.to]) {
        if (!cell(at) || !g.near(at[0], at[1], at[2], 50)) continue;
        for (let i = 0; i < 4; i++) fx.dust(at[0] + (Math.random() - 0.5) * 0.8, at[1], at[2] + (Math.random() - 0.5) * 0.8);
      }
      if (cell(msg.to) && g.near(msg.to[0], msg.to[1], msg.to[2], 40)) g.sound.play('boing', { speed: 8 });
      break;
    }
    case 'home': {
      if (pos && g.near(pos.x, pos.y, pos.z, 60)) {
        fx.hearts(pos.x, pos.y + 0.6, pos.z, 4);
        fx.sparkles(pos.x, pos.y + 0.6, pos.z, 16);
        g.sound.play(q.animal === 'sheep' ? 'sheep' : 'chick');
      }
      toast(questIcon(q), `${named} is home! ${msg.n} of ${msg.of}${msg.n < msg.of ? '' : ' — every one!'}`);
      break;
    }
    case 'lit':
    case 'out': {
      const f = q.fires?.[msg.fire];
      if (!f) return;
      const [x, y, z] = f;
      if (!g.near(x, y, z, 70)) return;
      if (msg.k === 'lit') {
        fx.sparkles(x + 0.5, y + 1, z + 0.5, 16, ['#ffd84d', '#ff9a3d', '#ff5a1f', '#fff3a0']);
        g.sound.play('fire');
        // (The first of Jinx's own beacons lit: his last challenge is on.)
        if (q.kind === 'jinx') bossSays(g, 'jinx', 'before');
        if (mine && !q.toldLit) {
          q.toldLit = true;
          toast('🔥', `Lit! It soon burns out (${q.burn ?? 30} seconds), so hurry and light ${q.fires.length > 2 ? 'all the others' : 'the other one'} too${q.kind === 'jinx' ? ' — every beacon at once dazzles Jinx!' : ' — or bring friends!'}`);
        }
      } else {
        for (let i = 0; i < 4; i++) fx.add('puff', x + 0.5 + (Math.random() - 0.5) * 0.6, y + 0.6, z + 0.5 + (Math.random() - 0.5) * 0.6, { vy: 0.8, size: 0.4, life: 1.1, grow: 1.4, color: '#b9b9b9', delay: i * 0.1 });
        if (g.near(x, y, z, 30)) toast('💨', `A ${q.kind === 'jinx' ? 'beacon' : 'bonfire'} burnt out! Light it again.`);
      }
      break;
    }
    case 'tune': {
      if (!Array.isArray(msg.tune) || !q.pads) return;
      const gap = Math.min(2000, Math.max(200, Number(msg.gap) || 700));
      const now = performance.now();
      g.questShow ??= [];
      msg.tune.slice(0, 12).forEach((pad, i) => Number.isInteger(pad) && q.pads[pad] && g.questShow.push({ at: now + 350 + i * gap, q, pad }));
      if (g.near(q.x, q.y, q.z, 40)) toast('🎵', `Listen… round ${msg.n} of ${msg.of}: ${msg.tune.length} notes. Then step on the stones in the same order!`);
      break;
    }
    case 'note':
      if (q.pads?.[msg.pad]) singStone(g, q, msg.pad, true);
      break;
    case 'oops': {
      const p = q.pads?.[msg.pad];
      if (p && g.near(p[0], p[1], p[2], 50)) {
        fx.sparkles(p[0] + 0.5, p[1] + 0.3, p[2] + 0.5, 20, ['#ff4f4f', '#ffffff']);
        g.sound.play('buzz');
      }
      if (g.near(q.x, q.y, q.z, 40)) toast('🎵', `Oops — that was not the next stone! Listen to the tune again…`);
      break;
    }
    case 'round':
      if (g.near(q.x, q.y, q.z, 40)) {
        g.sound.play('ding');
        toast('🎵', `Well sung! Round ${msg.n} of ${msg.of}: the tune gets a note longer…`);
      }
      break;
    case 'dazzle': {
      if (cell(msg.land)) {
        const [x, y, z] = msg.land;
        g.renderer.warnRing(x + 0.5, y, z + 0.5, 2.2, Math.min(4000, Number(msg.ms) || 1400));
      }
      if (pos) fx.sparkles(pos.x, pos.y + 1.2, pos.z, 50, ['#ffffff', '#fff3a0', '#ffd84d']);
      g.sound.play('magpie');
      g.renderer.shake(0.15);
      toast('💫', 'Every beacon blazes — Jinx is dazzled! Down he tumbles: catch him before he flies back up!');
      break;
    }
    default:
      break;
  }
}

// A Singing Stone singing: its colour glowing up off it, notes floating up,
// and its bell note (said: someone stepped on it; else the ring sang it).
function singStone(g, q, pad, said = false) {
  const p = q.pads[pad];
  if (!p || !g.near(p[0], p[1], p[2], 60)) return;
  const fx = g.renderer.effects;
  const color = STONE_COLORS[pad % 4];
  for (let i = 0; i < 14; i++) {
    fx.add('sparkle', p[0] + 0.5 + (Math.random() - 0.5) * 2.6, p[1] + 0.1, p[2] + 0.5 + (Math.random() - 0.5) * 2.6, { vy: 1.6 + Math.random() * 1.6, size: 0.28, life: 0.9, drag: 0.6, color, delay: Math.random() * 0.12 });
  }
  fx.notes(p[0] + 0.5, p[1] + 1.2, p[2] + 0.5);
  g.sound.play('bell', { n: STONE_NOTES[pad % 4], gain: said ? 0.9 : 1 });
}

// Each frame, on a chapter told in challenges: the tune the Singing Stones
// are singing, a glint now and then off a shiny still to find near you, a
// golden key glinting on the monkey that has one, and Jinx's dizzy stars.
export function questFrame(g, now) {
  const adv = g.adventure;
  if (!adv?.quests) return;
  const fx = g.renderer.effects;
  const me = g.me?.body;
  const show = g.questShow;
  while (show?.length && show[0].at <= now) {
    const s = show.shift();
    singStone(g, s.q, s.pad);
  }
  if (!me) return;
  for (const q of adv.quests.values()) {
    if (q.done) continue;
    if (q.kind === 'finds' && q.spots && now >= (q.glintAt ?? 0)) {
      q.glintAt = now + 450;
      for (const [x, y, z] of q.spots) {
        if (Math.hypot(x + 0.5 - me.x, z + 0.5 - me.z) > GLINT_NEAR || !B.SHINIES.includes(g.world.get(x, y, z))) continue;
        if (Math.random() < 0.35) fx.add('sparkle', x + 0.5 + (Math.random() - 0.5) * 0.5, y + 0.5 + Math.random() * 0.4, z + 0.5 + (Math.random() - 0.5) * 0.5, { vy: 0.5, size: 0.4, life: 0.6, color: '#ffffff' });
      }
    }
    if (q.kind === 'climb' && q.at && now >= (q.glintAt ?? 0)) {
      q.glintAt = now + 600;
      const [x, y, z] = q.at;
      if (g.world.get(x, y, z) === B.GOLD_KEY && Math.hypot(x - me.x, z - me.z) < 90) fx.add('sparkle', x + 0.5, y + 0.7, z + 0.5, { vy: 0.8, size: 0.6, life: 0.8, color: '#fff3a0' });
    }
    if (q.kind === 'chase' && now >= (q.glintAt ?? 0)) {
      q.glintAt = now + 500;
      const p = g.critters.get(q.cid)?.model?.group.position;
      if (p && Math.hypot(p.x - me.x, p.z - me.z) < 40) fx.add('sparkle', p.x, p.y + 0.9, p.z, { vy: 0.7, size: 0.35, life: 0.6, color: '#ffd84d' });
    }
    if (q.kind === 'jinx' && q.phase === 2) {
      const c = g.critters.get(q.cid);
      const p = c?.model?.group.position;
      if (p && g.near(p.x, p.y, p.z, 50)) fx.dizzy(p.x, p.y + (c.model.height ?? 1.4) + 0.2, p.z, now / 1000, 0.6);
    }
  }
}

// The tags over the challenges (ui.js adventureTags draws them): over each
// challenge from anywhere on the island, its name and how it is going; and
// near you, over its monkey, its lost animals, its bonfires and Jinx.
// Each { key, x, y, z, label, share (a bar, 0-1, or null), kind }.
export function questTags(g, me) {
  const adv = g.adventure;
  const out = [];
  if (!adv?.quests || !me || adv.won) return out;
  const near = (x, z, d) => Math.hypot(x - me.x, z - me.z) < d;
  for (const q of adv.quests.values()) {
    if (q.done) continue;
    const locked = questLocked(adv, q);
    const c = Number.isInteger(q.cid) ? g.critters.get(q.cid) : null;
    const cp = c?.model?.group.position;
    let label = `${q.icon} ${q.name}`;
    let at = { x: q.x + 0.5, y: q.y + 2.6, z: q.z + 0.5 };
    let share = null;
    switch (q.kind) {
      case 'finds':
        label += ` · ${q.n}/${q.of}`;
        share = q.n / q.of;
        break;
      case 'climb':
        if (q.at) at = { x: q.at[0] + 0.5, y: q.at[1] + 1.4, z: q.at[2] + 0.5 };
        label = near(at.x, at.z, 6) ? '🗝️ Grab the key!' : `${q.icon} ${q.name}: climb up!`;
        break;
      case 'chase':
        if (cp) at = { x: cp.x, y: cp.y + (c.model.height ?? 0.7) + 0.9, z: cp.z };
        label = `${q.icon} Catch ${c?.name ?? 'the monkey'}!${q.of > 1 ? ` ${q.n}/${q.of}` : ''}`;
        if (c?.snaps?.at(-1)?.state === 'slide' && near(at.x, at.z, 24) && q.n < q.of) label = '😮‍💨 Puffed out — now!';
        if (c?.snaps?.at(-1)?.state === 'happy') label = '🤭 Hee hee!';
        break;
      case 'lead':
        if (q.home) at = { x: q.home.x, y: q.home.y + 2.4, z: q.home.z };
        label = `${q.icon} ${q.name} · ${q.n}/${q.of} home`;
        share = q.n / q.of;
        break;
      case 'fires': {
        const lit = q.left.filter((s) => s > 0).length;
        label = `${q.icon} ${q.name} · ${lit}/${q.of} alight`;
        break;
      }
      case 'stones':
        if (q.start) at = { x: q.start[0] + 0.5, y: q.start[1] + 2.6, z: q.start[2] + 0.5 };
        label = q.phase === 1 ? '🎵 Listen…' : q.phase === 2 ? '🎵 Your turn: step on the stones!' : near(at.x, at.z, 22) ? `🎵 Step on the gold stone to hear the tune! · ${q.n}/${q.of}` : `${q.icon} ${q.name} · ${q.n}/${q.of}`;
        break;
      case 'jinx': {
        if (cp) at = { x: cp.x, y: cp.y + (c.model.height ?? 1.5) + 0.8, z: cp.z };
        const lit = q.left.filter((s) => s > 0).length;
        if (locked) label = '🔒 Catch Jinx — beat every other challenge first!';
        else if (q.phase === 2) label = '💫 Catch him!';
        else if (q.phase === 1) label = '💫 Down he tumbles!';
        else if (q.phase === 3) label = '🐦 Off he flaps…';
        else label = `🐦 Catch Jinx! ${q.n}/${q.of} · 🔥 ${lit}/${q.fires?.length ?? 0} beacons`;
        break;
      }
      default:
        break;
    }
    out.push({ key: `quest-${q.id}`, ...at, label, share, kind: 'quest' });
    // Near you: each bonfire's (or beacon's) seconds left, or what to do.
    if ((q.kind === 'fires' || (q.kind === 'jinx' && !locked && q.phase === 0)) && q.fires) {
      q.fires.forEach(([x, y, z], i) => {
        if (!near(x, z, 40)) return;
        const s = q.left[i] ?? 0;
        out.push({ key: `fire-${q.id}-${i}`, x: x + 0.5, y: y + 2.2, z: z + 0.5, label: s > 0 ? `🔥 ${s}` : '🪵 Stand here to light!', share: s > 0 && q.burn ? s / q.burn : null, kind: 'quest' });
      });
    }
    // Near you: each lost animal not yet home, and whether it follows you.
    if (q.kind === 'lead' && q.flock) {
      for (const id of q.flock) {
        const a = g.critters.get(id);
        const p = a?.model?.group.position;
        if (!p || !near(p.x, p.z, 30) || (q.home && Math.hypot(p.x - q.home.x, p.z - q.home.z) <= q.home.r)) continue;
        out.push({ key: `stray-${id}`, x: p.x, y: p.y + (a.model.height ?? 0.4) + 0.6, z: p.z, label: `${q.icon} ${a.name}`, share: null, kind: 'quest' });
      }
    }
  }
  return out;
}

// A challenge beaten (room.js questDone): its lock on the bell's cage lit,
// a fanfare, what the story says of it — and for whoever beat it, a key quiz
// as for a camp freed. Returns whether it was one of yours.
export function questBeaten(g, msg) {
  const adv = g.adventure;
  const q = adv?.quests?.get(msg.id);
  if (!q) return false;
  q.done = true;
  q.n = q.of;
  if (q.kind === 'jinx') bossSays(g, 'jinx', 'after');
  const fx = g.renderer.effects;
  const lock = adv.hub?.locks?.[q.id - 1];
  if (lock && g.near(lock[0], lock[1], lock[2], 90)) fx.sparkles(lock[0] + 0.5, lock[1] + 1, lock[2] + 0.5, 30, [q.color, '#ffffff', '#ffd84d']);
  g.sound.play('fanfare');
  const left = [...adv.quests.values()].filter((o) => !o.done).length;
  const more = left ? ` ${left === 1 ? 'One more challenge' : `${left} more challenges`} to go!` : '';
  g.emit('toast', { icon: '🔓', text: `${q.doneText || `${q.name}: done!`}${msg.won ? '' : more}` });
  return Array.isArray(msg.by) && msg.by.includes(g.pid);
}
