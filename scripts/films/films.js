// Adventure Isle's films, shot by shot (stage.js shoots them, score.js makes
// their music, make-films.mjs puts them together). The first episode's:
//
// - The intro, played the first time you come to the isle: the Star shining
//   on the lighthouse over a happy isle, King Grumble stealing it in a storm
//   and breaking it into twelve Star Shards, his eleven captains each in their
//   lair with one, the last shard with him on Gloom Rock, and a little boat
//   washed up on the beach in the storm: you and your friends.
// - The ending, played when King Grumble is popped once and for all on the
//   last stage: the shards flying home, the Star whole again, the whole isle
//   cheering, the captains friends now, fireworks, the credits — and King
//   Grumble already puffing himself up again for the next journey.
//
// And the second episode's (intro2, ending2):
//
// - Its intro, played the first time you come to it: a rainbow over the happy
//   isle, Queen Grizzle floating down under her great grey umbrella, catching
//   the rainbow in it and shaking its seven colours out into seven jars, her
//   six helpers each in its lair with one, the last with her in Castle Drab,
//   and you and your friends at the foot of the Tulip Fields.
// - Its ending, played when Queen Grizzle is popped on its last stage: the
//   colours flying up into the sky, the rainbow whole again, everyone on the
//   beach under it, the credits — and Queen Grizzle floating home, having to
//   say it looks rather nice, and the story going on.
//
// And the third episode's (intro3, ending3), on the Wild Isle, drawn as the
// real thing (render/real.js): Old Murk and the five Sunstones (see intro3
// and ending3 below). And the fourth's (intro4, ending4): Jinx the Magpie and
// the five Golden Bells, on his Puzzle Isles (see below). And the fifth's
// (intro5, ending5): Baron Bluster, his Cloud Blanket and the five Sky
// Lanterns of Toon Isle, drawn as a cartoon (render/cartoon.js).
import { BOSSES } from '/js/shared/bosses.js';
import { questIcon } from '/js/shared/isle-quests.js';
import { BATTLE_ICONS } from '/js/shared/isle-battles.js';
import { CHAPTERS, RAINBOW } from '/js/shared/isle-story.js';
import { ANIM, B, caption, critter, isle, kid, monster, nameCard, prop, renderer, roll, star, THREE, titleCard, toon } from './stage.js';

const SEA = 20;
const lerp = (a, b, k) => a + (b - a) * k;
const ease = (k) => (k <= 0 ? 0 : k >= 1 ? 1 : k * k * (3 - 2 * k));
const mix = (a, b, k) => a.map((v, i) => lerp(v, b[i], k));

// Where something stands on a column: just over its top (not a tree's).
function groundY(world, x, z) {
  for (let y = world.H - 2; y > 0; y--) {
    const id = world.get(Math.floor(x), y, Math.floor(z));
    if (B.SOLID[id] && !B.TREE_PART[id]) return y + 1;
  }
  return SEA + 1;
}

// A camera moving through keys, each { t, pos, look, fov }, eased between.
function keys(list) {
  return (t) => {
    let i = 0;
    while (i < list.length - 2 && t > list[i + 1].t) i++;
    const a = list[i];
    const b = list[Math.min(i + 1, list.length - 1)];
    const k = b.t > a.t ? ease((t - a.t) / (b.t - a.t)) : 0;
    return { pos: mix(a.pos, b.pos, k), look: mix(a.look, b.look, k), fov: lerp(a.fov ?? 50, b.fov ?? 50, k) };
  };
}

// A camera going round (cx, cy, cz), r away and up high, from angle a0 to a1.
function orbit([cx, cy, cz], r, high, a0, a1, dur, fov = 50) {
  return (t) => {
    const a = lerp(a0, a1, t / dur);
    return { pos: [cx + Math.sin(a) * r, cy + high, cz + Math.cos(a) * r], look: [cx, cy, cz], fov };
  };
}

// Something to do once, the first frame at or past `at` in a shot.
function once(shot, key, t, at, fn) {
  shot.done ??= new Set();
  if (t < at || shot.done.has(key)) return;
  shot.done.add(key);
  fn();
}

// A bolt of lightning striking near (x, z), the island lit up.
function strike(world, x, z, cam) {
  renderer.sky.strike({ x: Math.floor(x), y: groundY(world, x, z) - 1, z: Math.floor(z) }, { x: cam[0], z: cam[2] });
}

const KIDS = [
  { animal: 'kid', skin: 'golden', hair: 'short', hairColor: 'brown', shirt: 0, hat: 'cap' },
  { animal: 'kid', skin: 'light', hair: 'pigtails', hairColor: 'black', shirt: 6, hat: 'none' },
  { animal: 'bunny', fur: 'white', shirt: 10, hat: 'flower' },
];

// The first episode's chapters (the second's come after them).
const STAR_CHAPTERS = CHAPTERS.filter((ch) => !ch.episode);

// The chapter's own time of day for its captain's shot.
const dayOf = (ch) => (ch.day === 'night' ? 0.02 : ch.key === 'ember' ? 0.72 : ch.key === 'hollow' ? 0.02 : 0.36);

// Shore (stage 1): the lighthouse, the village, the beach.
function shoreSpots(m) {
  const { world } = m;
  const top = groundY(world, 92, 20);
  return { world, light: [92.5, top, 20.5], gallery: top - 5, village: m.camps[0], spawn: world.spawn };
}

// ------------------------------------------------------------ the intro

function intro() {
  const shore = isle(1);
  const happy = isle(1, { freed: true });
  const S = shoreSpots(shore);
  const L = S.light;
  const shots = [];
  const overlays = [];
  let at = 0;
  const add = (shot) => {
    shot.start = at;
    shots.push(shot);
    at += shot.dur;
    return shot;
  };

  // 1. Night over the sea, the Star shining on the lighthouse.
  add({
    dur: 7,
    world: shore,
    time: 0.03,
    cut: 'fade',
    setup() {
      const s = star(1.1);
      prop(s, (t) => ({ x: L[0], y: L[1] + 2.4, z: L[2], ry: t * 0.8 }));
    },
    camera: keys([
      { t: 0, pos: [L[0] - 46, SEA + 5, L[2] - 52], look: [L[0], L[1] - 4, L[2]], fov: 46 },
      { t: 7, pos: [L[0] - 14, L[1] + 3, L[2] - 13], look: [L[0], L[1] + 1.5, L[2]], fov: 46 },
    ]),
  });
  overlays.push(caption(0.9, 5.8, 'Far out in the sea lies Adventure Isle, and high on its lighthouse shines the Star.'));

  // 2. A happy isle in the sunshine: the village, its animals, the lighthouse far off.
  add({
    dur: 7.5,
    world: happy,
    time: 0.38,
    cut: 'fade',
    setup() {
      const v = S.village;
      for (let i = 0; i < 6; i++) {
        const type = ['bunny', 'chick', 'sheep', 'bunny', 'chick', 'cow'][i];
        const a0 = i * 1.05;
        critter(type, (t) => {
          const a = a0 + t * 0.18 * (i % 2 ? 1 : -1);
          const x = v.x + Math.cos(a) * (4 + (i % 3));
          const z = v.z + Math.sin(a) * (4 + (i % 3));
          return { x, y: groundY(happy.world, x, z), z, yaw: a + Math.PI / 2, state: 'walk', moving: true };
        });
      }
      kid(KIDS[2], () => ({ x: v.x + 2, y: v.y, z: v.z + 3, yaw: Math.PI, emote: 'dance' }));
    },
    camera: keys([
      { t: 0, pos: [S.village.x - 21, S.village.y + 17, S.village.z + 19], look: [S.village.x, S.village.y + 1, S.village.z], fov: 46 },
      { t: 5, pos: [S.village.x + 7, S.village.y + 18, S.village.z + 24], look: [S.village.x, S.village.y + 1.5, S.village.z], fov: 46 },
      { t: 7.5, pos: [S.village.x + 9, S.village.y + 21, S.village.z + 22], look: [L[0], L[1], L[2]], fov: 44 },
    ]),
  });
  overlays.push(caption(7.5 + 0.6, 6.4, 'The Star kept the whole isle happy and bright, from the sandy shore to the tallest mountain.'));

  // 3. A stormy night: King Grumble creeps up the lighthouse and takes the Star.
  const kingStand = [L[0] + 1.5, L[1] - 0.6, L[2] - 0.9];
  add({
    dur: 8,
    world: shore,
    time: 0.92,
    weather: 'storm',
    cut: 'flash',
    setup(shot) {
      const s = star(1.1);
      shot.star = s;
      prop(s, (t) => {
        // Grabbed at 3.4 s, held up over his head, and off he goes with it.
        if (t < 3.4) return { x: L[0], y: L[1] + 2.4, z: L[2], ry: t * 0.8 };
        const k = shot.king;
        return { x: k.x, y: k.y + 2.8, z: k.z, ry: t * 3, scale: 0.8 };
      });
      shot.king = { x: kingStand[0], y: kingStand[1], z: kingStand[2] };
      monster('king', (t) => {
        const k = shot.king;
        if (t < 1.6) {
          // Climbing up over the gallery's rail.
          const u = ease(t / 1.6);
          Object.assign(k, { x: kingStand[0] + 3 * (1 - u), y: kingStand[1] - 6 * (1 - u) + Math.sin(u * Math.PI) * 2, z: kingStand[2] });
          return { ...k, yaw: -Math.PI / 2, state: 'hop', air: 1 - u };
        }
        if (t < 5.6) {
          Object.assign(k, { x: kingStand[0], y: kingStand[1], z: kingStand[2] });
          return { ...k, yaw: Math.atan2(L[0] - k.x, L[2] - k.z), state: t < 3.4 ? 'hurl' : 'giggle' };
        }
        // And away, leaping down off the lighthouse into the dark.
        const u = (t - 5.6) / 2.4;
        Object.assign(k, { x: kingStand[0] + u * 14, y: kingStand[1] + Math.sin(Math.min(1, u * 1.4) * Math.PI) * 4 - u * u * 18, z: kingStand[2] + u * 8 });
        return { ...k, yaw: Math.PI / 2, state: 'leap', air: 2 };
      });
    },
    fx(t, dt) {
      const shot = shots[2];
      once(shot, 'bolt1', t, 0.4, () => strike(shore.world, L[0] - 20, L[2] + 10, shot.camera(t).pos));
      once(shot, 'grab', t, 3.4, () => renderer.effects.sparkles(L[0], L[1] + 2.4, L[2], 40, ['#ffd84d', '#ffffff', '#ffe680']));
      once(shot, 'bolt2', t, 3.5, () => strike(shore.world, L[0] + 12, L[2] + 16, shot.camera(t).pos));
      once(shot, 'bolt3', t, 6.4, () => strike(shore.world, L[0] - 6, L[2] + 24, shot.camera(t).pos));
    },
    camera: keys([
      { t: 0, pos: [L[0] - 9, L[1] - 1, L[2] + 8], look: [L[0], L[1] - 2, L[2]], fov: 52 },
      { t: 5, pos: [L[0] - 7.5, L[1] + 0.5, L[2] + 6.5], look: [L[0] + 1, L[1] - 2, L[2] - 1], fov: 50 },
      { t: 8, pos: [L[0] - 9, L[1] + 2, L[2] + 9], look: [L[0] + 8, L[1] - 8, L[2] + 6], fov: 52 },
    ]),
  });
  overlays.push(caption(shots[2].start + 0.7, 6.8, 'Then one stormy night, grumpy King Grumble crept up the lighthouse… and stole the Star!'));

  // 4. On the cliff top, he breaks it into twelve Star Shards.
  const cliff = [84.5, groundY(shore.world, 84, 34), 34.5];
  add({
    dur: 6.5,
    world: shore,
    time: 0.95,
    weather: 'storm',
    cut: 'cut',
    setup(shot) {
      const whole = star(0.9);
      prop(whole, (t) => ({ x: cliff[0], y: cliff[1] + 3, z: cliff[2], ry: t * 2, scale: t < 2.2 ? 1 + Math.sin(t * 30) * 0.05 * t : 0.001, visible: t < 2.2 }));
      monster('king', (t) => ({ x: cliff[0], y: cliff[1], z: cliff[2], yaw: -2.6, state: t < 2.2 ? 'hurl' : 'giggle' }));
      shot.shards = [];
      for (let i = 0; i < 12; i++) {
        const s = star(0.32);
        const a = (i / 12) * Math.PI * 2;
        const up = 0.5 + (i % 3) * 0.35;
        prop(s, (t) => {
          const u = Math.max(0, t - 2.2);
          return { x: cliff[0] + Math.cos(a) * u * 9, y: cliff[1] + 3 + u * (6 * up) + u * u * 0.6, z: cliff[2] + Math.sin(a) * u * 9, ry: t * 5, visible: t >= 2.2 };
        });
      }
    },
    fx(t) {
      const shot = shots[3];
      once(shot, 'break', t, 2.2, () => {
        renderer.effects.sparkles(cliff[0], cliff[1] + 3, cliff[2], 80, ['#ffd84d', '#ffffff', '#ffe680', '#ff9a3d']);
        renderer.effects.bang(cliff[0], cliff[1] + 3, cliff[2]);
        renderer.sky.flash = 1;
      });
      if (t > 2.2 && t < 5) {
        for (let i = 0; i < 12; i += 3) {
          const a = (i / 12) * Math.PI * 2;
          const u = t - 2.2;
          renderer.effects.add('sparkle', cliff[0] + Math.cos(a) * u * 9, cliff[1] + 3 + u * 4, cliff[2] + Math.sin(a) * u * 9, { size: 0.16, life: 0.6, vy: -0.5, color: '#ffe680' });
        }
      }
    },
    camera: keys([
      { t: 0, pos: [cliff[0] - 5.5, cliff[1] + 0.8, cliff[2] + 5], look: [cliff[0], cliff[1] + 2.4, cliff[2]], fov: 48 },
      { t: 6.5, pos: [cliff[0] - 9, cliff[1] + 1.5, cliff[2] + 9], look: [cliff[0], cliff[1] + 5, cliff[2]], fov: 56 },
    ]),
  });
  overlays.push(caption(shots[3].start + 0.5, 5.8, 'He broke it into twelve Star Shards, and gave them to his captains to keep, all over the isle.'));

  // 5. The captains, each in its lair with its shard.
  for (const [i, ch] of STAR_CHAPTERS.slice(0, 11).entries()) {
    const m = isle(i + 1);
    const lair = m.camps.at(-1);
    const c = [lair.x, lair.y, lair.z];
    const a0 = 0.6 + i * 0.9;
    const shot = add({
      dur: 2.5,
      world: m,
      time: dayOf(ch),
      cut: i === 0 ? 'flash' : 'cut',
      setup() {
        const plan = BOSSES[ch.boss];
        const tall = plan.body.height;
        monster(ch.boss, (t) => ({ x: c[0], y: c[1] + 1, z: c[2], yaw: a0 + 0.3, state: t % 2.5 < 1.2 ? 'idle' : 'giggle' }));
        prop(star(0.4), (t) => ({ x: c[0], y: c[1] + 1 + tall + 1.4 + Math.sin(t * 3) * 0.15, z: c[2], ry: t * 2 }));
      },
      camera: (t) => {
        const tall = BOSSES[ch.boss].body.height;
        return orbit([c[0], c[1] + 1 + tall * 0.55, c[2]], 6.4 + tall, 1.6, a0, a0 + 0.35, 2.5, 46)(t);
      },
    });
    overlays.push(nameCard(shot.start + 0.15, 2.2, `${BOSSES[ch.boss].icon} ${BOSSES[ch.boss].name}`, `${ch.icon} ${ch.name} · ${ch.lair}`));
  }

  // 6. The last shard, with King Grumble himself on Gloom Rock.
  const castle = isle(12);
  const throne = castle.camps.at(-1);
  add({
    dur: 6,
    world: castle,
    time: 0.74,
    weather: 'cloudy',
    cut: 'flash',
    setup() {
      monster('king', (t) => ({ x: throne.x, y: throne.y + 1, z: throne.z, yaw: 0.4, state: t < 2.5 ? 'idle' : 'giggle' }));
      prop(star(0.45), (t) => ({ x: throne.x, y: throne.y + 4.6 + Math.sin(t * 2) * 0.2, z: throne.z, ry: t * 1.5 }));
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2 + 0.4;
        monster('knight', (t) => ({ x: throne.x + Math.sin(a) * 5, y: throne.y, z: throne.z + Math.cos(a) * 5, yaw: a + Math.PI, state: (t + i) % 1.4 < 0.7 ? 'hop' : 'idle', air: Math.abs(Math.sin((t + i) * 4.5)) * 0.3 }));
      }
    },
    camera: keys([
      { t: 0, pos: [throne.x + 2, throne.y + 2.2, throne.z + 7.5], look: [throne.x, throne.y + 2.4, throne.z], fov: 50 },
      { t: 6, pos: [throne.x + 4, throne.y + 11, throne.z + 9], look: [throne.x, throne.y + 2, throne.z], fov: 52 },
    ]),
  });
  overlays.push(caption(shots.at(-1).start + 0.6, 5.2, 'The last shard King Grumble kept for himself, high up on Gloom Rock.'));

  // 7. That same night, a little boat tossed on the stormy sea.
  const boatAt = [6.5, SEA + 0.75, 120.5];
  add({
    dur: 7,
    world: shore,
    time: 0.94,
    weather: 'storm',
    cut: 'fade',
    setup(shot) {
      const roll = (t) => Math.sin(t * 2.1) * 0.22;
      const bob = (t) => Math.sin(t * 2.7) * 0.28;
      shot.boat = critter('boat', (t) => ({ x: boatAt[0] + t * 0.9, y: boatAt[1] + bob(t), z: boatAt[2] - t * 0.6, yaw: -0.9, roll: roll(t), pitch: Math.sin(t * 1.7) * 0.12 }));
      for (const [i, look] of KIDS.entries()) {
        const off = (i - 1) * 0.55;
        kid(look, (t) => ({ x: boatAt[0] + t * 0.9 + Math.cos(-0.9) * off, y: boatAt[1] + bob(t) + 0.35, z: boatAt[2] - t * 0.6 + Math.sin(-0.9) * off, yaw: -0.9, anim: ANIM.sit }));
      }
    },
    fx(t) {
      const shot = shots.at(-2);
      once(shot, 'b1', t, 1.2, () => strike(shore.world, 30, 108, [boatAt[0], 0, boatAt[2]]));
      once(shot, 'b2', t, 4.6, () => strike(shore.world, 18, 96, [boatAt[0], 0, boatAt[2]]));
      if (Math.random() < 0.4) renderer.effects.splash(boatAt[0] + t * 0.9 + (Math.random() - 0.5) * 3, SEA + 1, boatAt[2] - t * 0.6 + (Math.random() - 0.5) * 3);
    },
    camera: (t) => ({ pos: [boatAt[0] + t * 0.9 - 3.4, SEA + 2.7 + Math.sin(t * 2.2) * 0.35, boatAt[2] - t * 0.6 + 3.6], look: [boatAt[0] + t * 0.9, SEA + 1.5, boatAt[2] - t * 0.6], fov: 44 }),
  });
  overlays.push(caption(shots.at(-1).start + 0.6, 6, 'That same stormy night, a little boat was tossed this way and that, far out at sea…'));

  // 8. Morning on the beach: the heroes, and the dark lighthouse far off.
  const sp = S.spawn;
  add({
    dur: 10,
    world: shore,
    time: 0.29,
    cut: 'white',
    out: 'fade',
    setup() {
      for (const [i, look] of KIDS.entries()) {
        const x = sp.x - 1.6 + i * 1.6;
        const z = sp.z + 1 + Math.abs(i - 1) * 0.6;
        kid(look, (t) => ({ x, y: groundY(shore.world, x, z), z, yaw: Math.PI + 0.6, emote: t < 2.4 ? 'surprise' : t < 5.5 ? 'wave' : 'cheer', anim: ANIM.idle }));
      }
    },
    camera: keys([
      { t: 0, pos: [sp.x - 2, sp.y + 1.8, sp.z + 7], look: [sp.x, sp.y + 1, sp.z + 1], fov: 46 },
      { t: 3, pos: [sp.x - 3, sp.y + 2.5, sp.z + 8], look: [sp.x, sp.y + 1.2, sp.z + 1], fov: 46 },
      { t: 10, pos: [sp.x - 8, sp.y + 16, sp.z + 18], look: [L[0], L[1] - 6, L[2]], fov: 52 },
    ]),
  });
  const last = shots.at(-1).start;
  overlays.push(caption(last + 0.5, 3, 'In the morning, the boat lay on the beach… and out of it climbed you!'));
  overlays.push(titleCard(last + 3.8, 6, 'The Star of Adventure Isle', 'Win back all twelve Star Shards — together!'));
  return { shots, overlays, poster: last + 7.2 };
}

// ------------------------------------------------------------ the ending

function ending() {
  const castle = isle(12, { freed: true });
  const happy = isle(1, { freed: true });
  const S = shoreSpots(happy);
  const L = S.light;
  const throne = castle.camps.at(-1);
  const shots = [];
  const overlays = [];
  let at = 0;
  const add = (shot) => {
    shot.start = at;
    shots.push(shot);
    at += shot.dur;
    return shot;
  };

  // 1. Pop! King Grumble, puffed up and beaten, goes pop; the last shard rises.
  add({
    dur: 6.5,
    world: castle,
    time: 0.7,
    cut: 'fade',
    setup() {
      monster('king', (t) => ({ x: throne.x, y: throne.y + 1, z: throne.z, yaw: 0.3, state: 'dazed', scale: 1.45 * (t < 1.4 ? 1 + t * 0.12 : 1), visible: t < 1.5 }));
      prop(star(0.45), (t) => ({ x: throne.x, y: throne.y + 1.5 + Math.max(0, t - 1.5) * 1.6, z: throne.z, ry: t * 2, visible: t >= 1.5 }));
      for (const [i, look] of KIDS.entries()) {
        const a = 0.3 + (i - 1) * 0.55;
        const x = throne.x + Math.sin(a) * 6;
        const z = throne.z + Math.cos(a) * 6;
        kid(look, (t) => ({ x, y: throne.y, z, yaw: a + Math.PI, emote: t > 1.6 ? 'cheer' : null, anim: ANIM.idle }));
      }
    },
    fx(t) {
      const shot = shots[0];
      once(shot, 'pop', t, 1.5, () => {
        renderer.effects.jellyPop(throne.x, throne.y + 1.4, throne.z, '#b18cff', 2.4);
        renderer.effects.confetti(throne.x, throne.y + 2, throne.z, 160, 1.6);
        renderer.effects.bang(throne.x, throne.y + 2, throne.z);
      });
      if (t > 1.5) renderer.effects.add('sparkle', throne.x, throne.y + 1.5 + (t - 1.5) * 1.6, throne.z, { size: 0.18, life: 0.7, vy: -0.6, color: '#ffe680' });
    },
    camera: keys([
      { t: 0, pos: [throne.x + 2.5, throne.y + 3.5, throne.z + 8.5], look: [throne.x, throne.y + 1.8, throne.z], fov: 52 },
      { t: 6.5, pos: [throne.x + 1.5, throne.y + 3, throne.z + 8.5], look: [throne.x, throne.y + 10, throne.z], fov: 56 },
    ]),
  });
  overlays.push(caption(0.6, 5.6, 'Pop! King Grumble was beaten once and for all — and up rose the last Star Shard.'));

  // 2. From all over the isle the shards fly home, across the dusk sky.
  add({
    dur: 7,
    world: castle,
    time: 0.76,
    cut: 'cut',
    setup() {
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2;
        prop(star(0.38), (t) => {
          const k = ease(t / 5);
          const r = lerp(40, 3.5, k);
          const spin = a + t * 0.9;
          return { x: throne.x + Math.cos(spin) * r - t * 6 * ease((t - 4) / 3), y: throne.y + 14 + Math.sin(i + t) * 1.5 + k * 4, z: throne.z + Math.sin(spin) * r + t * 6 * ease((t - 4) / 3), ry: t * 4 };
        });
      }
    },
    fx(t) {
      for (let i = 0; i < 12; i += 2) {
        const a = (i / 12) * Math.PI * 2;
        const k = ease(t / 5);
        const r = lerp(40, 3.5, k);
        const spin = a + t * 0.9;
        renderer.effects.add('sparkle', throne.x + Math.cos(spin) * r - t * 6 * ease((t - 4) / 3), throne.y + 14 + k * 4, throne.z + Math.sin(spin) * r + t * 6 * ease((t - 4) / 3), { size: 0.2, life: 0.8, vy: -0.4, color: ['#ffe680', '#ffffff', '#ff9a3d'][i % 3] });
      }
    },
    camera: keys([
      { t: 0, pos: [throne.x + 2, throne.y + 4, throne.z + 26], look: [throne.x, throne.y + 14, throne.z], fov: 58 },
      { t: 7, pos: [throne.x - 6, throne.y + 9, throne.z + 20], look: [throne.x - 20, throne.y + 18, throne.z + 18], fov: 58 },
    ]),
  });
  overlays.push(caption(shots[1].start + 0.4, 6.2, 'From every corner of the isle, the twelve Star Shards flew home…'));

  // 3. Round the lighthouse they gather: the Star whole again, and dawn.
  add({
    dur: 8.5,
    world: happy,
    time: (t) => lerp(0.08, 0.3, ease((t - 3) / 5)),
    cut: 'fade',
    setup() {
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2;
        prop(star(0.34), (t) => {
          const r = lerp(9, 0, ease((t - 0.5) / 2.6));
          return { x: L[0] + Math.cos(a + t * 2) * r, y: L[1] + 2.4 + Math.sin(a * 3 + t) * 0.4 * r / 9, z: L[2] + Math.sin(a + t * 2) * r, ry: t * 4, visible: t < 3.1 };
        });
      }
      prop(star(1.1), (t) => ({ x: L[0], y: L[1] + 2.4, z: L[2], ry: t * 0.8, scale: t < 3.1 ? 0.001 : ease((t - 3.1) / 0.6) * 1.05, visible: t >= 3.1 }));
    },
    fx(t) {
      const shot = shots[2];
      once(shot, 'whole', t, 3.1, () => {
        renderer.effects.sparkles(L[0], L[1] + 2.4, L[2], 120, ['#ffd84d', '#ffffff', '#ffe680', '#9fe8ff']);
        renderer.effects.bang(L[0], L[1] + 2.4, L[2]);
        renderer.sky.flash = 1;
      });
    },
    camera: orbit([L[0], L[1] + 1.4, L[2]], 13, 2.5, 2.2, 3.4, 8.5, 50),
  });
  overlays.push(caption(shots[2].start + 3.6, 4.6, '…and the Star of Adventure Isle shone again!'));

  // 4. All over the isle, the gloom gone and the captains cheered up.
  const party = [
    [1, 'clawbeard', 0.4],
    [2, 'puffcap', 0.4],
    [4, 'gumbo', 0.42],
    [8, 'baronboo', 0.02],
    [10, 'sprocket', 0.45],
    [11, 'nimbus', 0.38],
  ];
  for (const [i, [stage, boss, time]] of party.entries()) {
    const m = isle(stage, { freed: true });
    const lair = m.camps.at(-1);
    const a0 = 0.8 + i;
    add({
      dur: 2.6,
      world: m,
      time,
      cut: i ? 'cut' : 'fade',
      setup() {
        monster(boss, (t) => ({ x: lair.x, y: lair.y + 1 + Math.abs(Math.sin(t * 5)) * 0.4, z: lair.z, yaw: a0 + 0.2, state: 'giggle', air: Math.abs(Math.sin(t * 5)) * 0.4 }));
        const look = KIDS[i % 3];
        kid(look, (t) => ({ x: lair.x + Math.sin(a0 - 0.6) * 4, y: lair.y, z: lair.z + Math.cos(a0 - 0.6) * 4, yaw: a0 - 0.6 + Math.PI, emote: 'dance' }));
      },
      fx(t) {
        if (time < 0.2 && Math.random() < 0.04) renderer.effects.firework(lair.x + (Math.random() - 0.5) * 20, lair.y + 14, lair.z + (Math.random() - 0.5) * 20);
        if (Math.random() < 0.12) renderer.effects.add('sparkle', lair.x + (Math.random() - 0.5) * 8, lair.y + 3 + Math.random() * 3, lair.z + (Math.random() - 0.5) * 8, { size: 0.16, life: 0.8, vy: 0.4, color: ['#ffe680', '#ff8fc4', '#9fe8ff'][Math.floor(Math.random() * 3)] });
      },
      camera: orbit([lair.x, lair.y + 2.2, lair.z], 9.5, 2.4, a0, a0 + 0.4, 2.6, 48),
    });
  }
  overlays.push(caption(shots[3].start + 0.4, 15, 'All over the isle the gloom went away — and even the grumpy captains cheered up.'));

  // 5. A party on the beach, fireworks over the shining lighthouse.
  const sp = S.spawn;
  add({
    dur: 9,
    world: happy,
    time: 0.86,
    cut: 'fade',
    setup() {
      prop(star(1.1), (t) => ({ x: L[0], y: L[1] + 2.4, z: L[2], ry: t * 0.8 }));
      for (const [i, look] of KIDS.entries()) {
        const x = sp.x - 1.6 + i * 1.6;
        const z = sp.z + 0.5;
        kid(look, () => ({ x, y: groundY(happy.world, x, z), z, yaw: Math.PI * 0.8, emote: ['cheer', 'dance', 'clap'][i] }));
      }
      for (let i = 0; i < 5; i++) {
        const type = ['bunny', 'chick', 'sheep', 'bunny', 'dog'][i];
        critter(type, (t) => {
          const x = sp.x - 4 + i * 2;
          const z = sp.z + 3 + (i % 2);
          return { x, y: groundY(happy.world, x, z) + Math.abs(Math.sin(t * 6 + i)) * 0.5, z, yaw: Math.PI * 0.8, state: 'idle' };
        });
      }
    },
    fx(t) {
      if (Math.random() < 0.09) renderer.effects.firework(L[0] - 30 + Math.random() * 50, L[1] + 6 + Math.random() * 10, L[2] + 30 + Math.random() * 30);
      if (t < 0.1) renderer.effects.confetti(sp.x, sp.y + 3, sp.z, 140, 1.4);
    },
    camera: keys([
      { t: 0, pos: [sp.x + 3, sp.y + 2, sp.z + 8], look: [sp.x, sp.y + 1.5, sp.z], fov: 50 },
      { t: 9, pos: [sp.x - 1, sp.y + 9, sp.z + 15], look: [L[0] - 20, L[1] + 6, L[2] + 30], fov: 56 },
    ]),
  });
  overlays.push(caption(shots.at(-1).start + 0.5, 7.8, 'Thank you, heroes of Adventure Isle!'));

  // 6. The credits, round the Star shining over the sea at night.
  add({
    dur: 15,
    world: happy,
    time: 0.94,
    cut: 'fade',
    setup() {
      prop(star(1.1), (t) => ({ x: L[0], y: L[1] + 2.4, z: L[2], ry: t * 0.8 }));
    },
    fx() {
      if (Math.random() < 0.03) renderer.effects.firework(L[0] - 20 + Math.random() * 40, L[1] + 8 + Math.random() * 8, L[2] + 10 + Math.random() * 30);
    },
    camera: orbit([L[0], L[1] - 2, L[2]], 30, 6, 2.6, 3.6, 15, 50),
  });
  const cast = STAR_CHAPTERS.map((ch) => `${BOSSES[ch.boss].icon} ${BOSSES[ch.boss].name}`);
  overlays.push(
    roll(shots.at(-1).start + 0.3, 14.5, ['#The Star of Adventure Isle', '', '#Starring', 'You and your friends', '', '#and', ...cast, '', '#The twelve chapters', ...STAR_CHAPTERS.map((ch) => `${ch.icon} ${ch.name}`), '', '#Made in Kids World', 'Thank you for playing!']),
  );

  // 7. But far out at sea, a crown bobs up: King Grumble, puffing himself up again.
  const sea = [L[0] - 4, SEA + 0.4, L[2] - 26];
  add({
    dur: 8.5,
    world: happy,
    time: 0.97,
    cut: 'fade',
    out: 'fade',
    setup() {
      monster('king', (t) => ({ x: sea[0], y: sea[1] - 1.2 + ease(t / 3) * 0.9 + Math.sin(t * 2) * 0.08, z: sea[2], yaw: 0.2, state: t > 3.5 ? 'giggle' : 'idle', scale: 1 + Math.max(0, t - 4) * 0.05 }));
    },
    fx(t) {
      if (Math.random() < 0.2) renderer.effects.add('puff', sea[0] + (Math.random() - 0.5) * 2, SEA + 1.1, sea[2] + (Math.random() - 0.5) * 2, { size: 0.15, life: 0.8, vy: 0.6, color: '#d8ecff' });
    },
    camera: keys([
      { t: 0, pos: [sea[0] + 1, SEA + 2.4, sea[2] + 9], look: [sea[0], SEA + 1, sea[2]], fov: 44 },
      { t: 8.5, pos: [sea[0] + 0.5, SEA + 1.8, sea[2] + 5], look: [sea[0], SEA + 1.4, sea[2]], fov: 40 },
    ]),
  });
  const teaser = shots.at(-1).start;
  overlays.push(caption(teaser + 0.5, 4, 'But far out at sea, King Grumble is already puffing himself up again…'));
  overlays.push(titleCard(teaser + 4.6, 3.9, 'A new journey begins!', 'Come back to Adventure Isle!', { size: 70 }));
  return { shots, overlays, poster: shots[2].start + 5.5 };
}

// ------------------------------------------------------------ episode 2

// A rainbow: its seven bows one inside another, R across at the outside,
// standing up over wherever it is put (its feet at y there).
function rainbow(R = 50, w = 1.6) {
  const g = new THREE.Group();
  RAINBOW.forEach(({ color }, i) => {
    g.add(new THREE.Mesh(new THREE.TorusGeometry(R - i * w, w * 0.52, 6, 80, Math.PI), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.85, depthWrite: false, fog: false })));
  });
  return g;
}

// One of the seven jars a colour of the rainbow is shut up in: glass, a cork,
// and the colour glowing inside it.
function jar(color, size = 1) {
  const g = new THREE.Group();
  const inner = new THREE.Group();
  inner.add(new THREE.Mesh(new THREE.SphereGeometry(0.3, 16, 12), new THREE.MeshBasicMaterial({ color })));
  inner.add(new THREE.Mesh(new THREE.SphereGeometry(0.66, 16, 12), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.25, depthWrite: false, blending: THREE.AdditiveBlending })));
  inner.add(new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.38, 0.72, 16), new THREE.MeshBasicMaterial({ color: '#e8f6ff', transparent: true, opacity: 0.3, depthWrite: false })));
  const cork = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.3, 0.16, 12), new THREE.MeshBasicMaterial({ color: '#9a6a3c' }));
  cork.position.y = 0.44;
  inner.add(cork);
  inner.scale.setScalar(size);
  g.add(inner);
  return g;
}

// The second episode's chapters, and where each starts among the stages.
const RAINBOW_FROM = CHAPTERS.findIndex((ch) => ch.episode === 2) + 1;
const RAINBOW_CHAPTERS = CHAPTERS.filter((ch) => ch.episode === 2);
// Where the rainbow stands over the isle, seen from the south.
const BOW = [64, SEA - 2, 6];

// ------------------------------------------------------------ the intro, episode 2

function intro2() {
  const shore = isle(1, { freed: true });
  const S = shoreSpots(shore);
  const L = S.light;
  const shots = [];
  const overlays = [];
  let at = 0;
  const add = (shot) => {
    shot.start = at;
    shots.push(shot);
    at += shot.dur;
    return shot;
  };

  // 1. Morning over a happy isle: the Star on its lighthouse, a rainbow across the sky.
  add({
    dur: 6.5,
    world: shore,
    time: 0.31,
    cut: 'fade',
    setup() {
      prop(star(1.1), (t) => ({ x: L[0], y: L[1] + 2.4, z: L[2], ry: t * 0.8 }));
      prop(rainbow(), () => ({ x: BOW[0], y: BOW[1], z: BOW[2] }));
    },
    camera: keys([
      { t: 0, pos: [40, SEA + 26, 168], look: [66, SEA + 20, 20], fov: 48 },
      { t: 6.5, pos: [58, SEA + 20, 142], look: [70, SEA + 22, 20], fov: 48 },
    ]),
  });
  overlays.push(caption(0.8, 5.4, 'The Star shone again over Adventure Isle — and every morning, its light painted a rainbow right across the sky.'));

  // 2. Queen Grizzle comes down under her great grey umbrella, onto the end
  // of the Old Pier, out over the sea under the rainbow.
  const cliff = [39.5, SEA + 2, 13.5];
  add({
    dur: 7,
    world: shore,
    time: 0.34,
    weather: 'cloudy',
    cut: 'fade',
    setup() {
      prop(rainbow(), () => ({ x: BOW[0], y: BOW[1], z: BOW[2] }));
      monster('grizzle', (t) => {
        if (t < 3.4) {
          const u = ease(t / 3.4);
          return { x: cliff[0] + (1 - u) * 5, y: cliff[1] + (1 - u) * 15, z: cliff[2] - (1 - u) * 3, yaw: 0.15, state: 'leap', air: 1 };
        }
        return { x: cliff[0], y: cliff[1], z: cliff[2], yaw: 0.15, state: t < 4.8 ? 'idle' : 'giggle' };
      });
    },
    fx(t) {
      once(shots[1], 'land', t, 3.4, () => renderer.effects.dust(cliff[0], cliff[1], cliff[2]));
    },
    camera: keys([
      { t: 0, pos: [cliff[0] + 1.2, cliff[1] + 2.5, cliff[2] + 13], look: [cliff[0] + 3, cliff[1] + 11, cliff[2] - 2], fov: 52 },
      { t: 3.6, pos: [cliff[0] + 0.8, cliff[1] + 1.6, cliff[2] + 8.5], look: [cliff[0], cliff[1] + 1.8, cliff[2]], fov: 48 },
      { t: 7, pos: [cliff[0] + 0.5, cliff[1] + 1.3, cliff[2] + 5.6], look: [cliff[0], cliff[1] + 1.5, cliff[2]], fov: 46 },
    ]),
  });
  overlays.push(caption(shots[1].start + 0.6, 6, 'But King Grumble’s big sister, Queen Grizzle, cannot bear bright colours. Down she came, under her great grey umbrella…'));

  // 3. She catches the rainbow in it, and shakes its colours out into seven jars.
  const hold = [cliff[0], cliff[1] + 3.2, cliff[2]];
  add({
    dur: 7.5,
    world: shore,
    time: 0.36,
    weather: 'cloudy',
    cut: 'cut',
    setup() {
      prop(rainbow(), (t) => {
        // Sucked down out of the sky into her umbrella, from 1.2 s to 4.2.
        const u = ease((t - 1.2) / 3);
        return { x: lerp(BOW[0], hold[0], u), y: lerp(BOW[1], hold[1], u), z: lerp(BOW[2], hold[2], u), scale: lerp(1, 0.02, u), rz: u * 2.4, visible: t < 4.25 };
      });
      monster('grizzle', (t) => ({ x: cliff[0], y: cliff[1], z: cliff[2], yaw: 0.3, state: t < 1 ? 'idle' : t < 4.5 ? 'puff' : 'giggle' }));
      RAINBOW.forEach(({ color }, i) => {
        const a = (i / 7) * Math.PI * 2 + 0.3;
        const up = 0.6 + (i % 3) * 0.3;
        prop(jar(color, 1.1), (t) => {
          const u = Math.max(0, t - 4.5);
          return { x: hold[0] + Math.cos(a) * u * 8, y: hold[1] + u * 5 * up + u * u * 0.5, z: hold[2] + Math.sin(a) * u * 8, ry: t * 4, visible: t >= 4.5 };
        });
      });
    },
    fx(t) {
      const shot = shots[2];
      if (t > 1.2 && t < 4.2 && Math.random() < 0.7) {
        const u = ease((t - 1.2) / 3);
        const c = RAINBOW[Math.floor(Math.random() * 7)].color;
        renderer.effects.add('sparkle', lerp(BOW[0], hold[0], u) + (Math.random() - 0.5) * 30 * (1 - u), lerp(BOW[1] + 30, hold[1], u) + Math.random() * 6 * (1 - u), lerp(BOW[2], hold[2], u), { size: 0.3, life: 0.7, vy: -1, color: c });
      }
      once(shot, 'shake', t, 4.5, () => {
        renderer.effects.sparkles(hold[0], hold[1], hold[2], 90, RAINBOW.map((c) => c.color));
        renderer.effects.bang(hold[0], hold[1], hold[2]);
        renderer.sky.flash = 1;
      });
    },
    camera: keys([
      { t: 0, pos: [cliff[0] + 3, cliff[1] + 1.5, cliff[2] + 17], look: [cliff[0] + 9, cliff[1] + 20, cliff[2] - 8], fov: 62 },
      { t: 4.2, pos: [cliff[0] + 2.4, cliff[1] + 1.6, cliff[2] + 10], look: [cliff[0], cliff[1] + 3.2, cliff[2]], fov: 50 },
      { t: 7.5, pos: [cliff[0] + 3.5, cliff[1] + 1.6, cliff[2] + 12], look: [cliff[0], cliff[1] + 6.5, cliff[2]], fov: 56 },
    ]),
  });
  overlays.push(caption(shots[2].start + 0.5, 6.6, '…caught the rainbow in it, and shook its seven colours out into seven jars!'));

  // 4. Her helpers, each in its lair in the Rainbow Lands with its jar.
  for (const [i, ch] of RAINBOW_CHAPTERS.slice(0, 6).entries()) {
    const m = isle(RAINBOW_FROM + i);
    const lair = m.camps.at(-1);
    const c = [lair.x, lair.y, lair.z];
    const a0 = 0.6 + i * 0.9;
    const tall = BOSSES[ch.boss].body.height;
    const shot = add({
      dur: 2.5,
      world: m,
      time: dayOf(ch),
      cut: i === 0 ? 'flash' : 'cut',
      setup() {
        monster(ch.boss, (t) => ({ x: c[0], y: c[1] + 1, z: c[2], yaw: a0 + 0.3, state: t % 2.5 < 1.2 ? 'idle' : 'giggle' }));
        prop(jar(RAINBOW[i].color, 1.7), (t) => ({ x: c[0], y: c[1] + 1 + tall + 1.6 + Math.sin(t * 3) * 0.15, z: c[2], ry: t * 2 }));
      },
      camera: (t) => orbit([c[0], c[1] + 1 + tall * 0.55, c[2]], 6.4 + tall, 1.6, a0, a0 + 0.35, 2.5, 46)(t),
    });
    overlays.push(nameCard(shot.start + 0.15, 2.2, BOSSES[ch.boss].icon + ' ' + BOSSES[ch.boss].name, ch.icon + ' ' + ch.name + ' · ' + ch.lair));
  }

  // 5. The last colour, violet, with Queen Grizzle herself in Castle Drab.
  const vale = isle(RAINBOW_FROM + 6);
  const yard = vale.camps.at(-1);
  add({
    dur: 5.5,
    world: vale,
    time: 0.4,
    weather: 'cloudy',
    cut: 'flash',
    setup() {
      monster('grizzle', (t) => ({ x: yard.x, y: yard.y + 1, z: yard.z, yaw: 0.4, state: t < 2.4 ? 'idle' : 'giggle' }));
      prop(jar(RAINBOW[6].color, 1.7), (t) => ({ x: yard.x, y: yard.y + 5 + Math.sin(t * 2) * 0.2, z: yard.z, ry: t * 1.5 }));
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2 + 0.4;
        monster('knight', (t) => ({ x: yard.x + Math.sin(a) * 5, y: yard.y, z: yard.z + Math.cos(a) * 5, yaw: a + Math.PI, state: (t + i) % 1.4 < 0.7 ? 'hop' : 'idle', air: Math.abs(Math.sin((t + i) * 4.5)) * 0.3 }));
      }
    },
    camera: keys([
      { t: 0, pos: [yard.x + 2, yard.y + 2.2, yard.z + 7.5], look: [yard.x, yard.y + 2.4, yard.z], fov: 50 },
      { t: 5.5, pos: [yard.x + 5, yard.y + 12, yard.z + 11], look: [yard.x - 4, yard.y + 3, yard.z - 2], fov: 54 },
    ]),
  });
  overlays.push(caption(shots.at(-1).start + 0.5, 4.8, 'The last colour, violet, she kept for herself, in Castle Drab.'));

  // 6. The heroes at the foot of the Tulip Fields, and the way ahead.
  const fields = isle(RAINBOW_FROM);
  const sp = fields.world.spawn;
  const first = fields.camps[0];
  add({
    dur: 9,
    world: fields,
    time: 0.3,
    cut: 'white',
    out: 'fade',
    setup() {
      for (const [i, look] of KIDS.entries()) {
        const x = sp.x - 1.6 + i * 1.6;
        const z = sp.z + 0.6 - Math.abs(i - 1) * 0.5;
        kid(look, (t) => ({ x, y: groundY(fields.world, x, z), z, yaw: Math.atan2(first.x - x, first.z - z) + Math.PI, emote: t < 2.4 ? 'surprise' : t < 5.2 ? 'wave' : 'cheer', anim: ANIM.idle }));
      }
    },
    camera: keys([
      { t: 0, pos: [sp.x - 5, sp.y + 2, sp.z - 5], look: [sp.x, sp.y + 1, sp.z], fov: 46 },
      { t: 3, pos: [sp.x - 6, sp.y + 2.6, sp.z - 6], look: [sp.x, sp.y + 1.2, sp.z], fov: 46 },
      { t: 9, pos: [sp.x + 9, sp.y + 22, sp.z + 12], look: [first.x - 22, first.y + 6, first.z - 26], fov: 54 },
    ]),
  });
  const last = shots.at(-1).start;
  overlays.push(caption(last + 0.5, 3.2, 'Without its colours, the whole isle is fading to grey. Heroes — bring the rainbow home!'));
  overlays.push(titleCard(last + 4, 4.8, 'The Rainbow of Adventure Isle', 'Episode 2 · Win back all seven colours — together!', { size: 72 }));
  return { shots, overlays, poster: last + 6.6 };
}

// ------------------------------------------------------------ the ending, episode 2

function ending2() {
  const vale = isle(RAINBOW_FROM + 6, { freed: true });
  const yard = vale.camps.at(-1);
  const happy = isle(1, { freed: true });
  const S = shoreSpots(happy);
  const L = S.light;
  const sp = S.spawn;
  const colors = RAINBOW.map((c) => c.color);
  const shots = [];
  const overlays = [];
  let at = 0;
  const add = (shot) => {
    shot.start = at;
    shots.push(shot);
    at += shot.dur;
    return shot;
  };

  // 1. Castle Drab: the last bop, and Queen Grizzle goes pop, umbrella and all.
  add({
    dur: 6,
    world: vale,
    time: 0.38,
    weather: 'cloudy',
    cut: 'fade',
    setup() {
      monster('grizzle', (t) => ({ x: yard.x, y: yard.y + 1, z: yard.z, yaw: 0.3, state: 'dazed', visible: t < 1.6, scale: 1 + Math.max(0, t - 1.1) * 0.5 }));
      prop(jar(RAINBOW[6].color, 1.4), (t) => ({ x: yard.x, y: yard.y + 2.2 + Math.max(0, t - 1.6) * 1.4, z: yard.z, ry: t * 2.4, visible: t >= 1.6 }));
      for (const [i, look] of KIDS.entries()) {
        const a = -0.5 + i * 0.5;
        const x = yard.x + Math.sin(a) * 4.2;
        const z = yard.z + Math.cos(a) * 4.2;
        kid(look, (t) => ({ x, y: yard.y + 1, z, yaw: a, emote: t < 1.6 ? 'surprise' : 'cheer', anim: ANIM.idle }));
      }
    },
    fx(t) {
      once(shots[0], 'pop', t, 1.6, () => {
        renderer.effects.sparkles(yard.x, yard.y + 2, yard.z, 110, colors);
        renderer.effects.bang(yard.x, yard.y + 2, yard.z);
        renderer.effects.confetti(yard.x, yard.y + 4, yard.z, 120, 1.3);
        renderer.sky.flash = 1;
      });
    },
    camera: keys([
      { t: 0, pos: [yard.x + 3, yard.y + 3, yard.z + 9], look: [yard.x, yard.y + 2.2, yard.z], fov: 48 },
      { t: 6, pos: [yard.x + 5, yard.y + 6, yard.z + 12], look: [yard.x, yard.y + 5, yard.z], fov: 52 },
    ]),
  });
  overlays.push(caption(0.5, 5, 'Pop! Queen Grizzle was popped, umbrella and all!'));

  // 2. The seven colours fly up into the sky, and the rainbow stands again.
  add({
    dur: 7.5,
    world: happy,
    time: 0.33,
    cut: 'flash',
    setup() {
      prop(star(1.1), (t) => ({ x: L[0], y: L[1] + 2.4, z: L[2], ry: t * 0.8 }));
      RAINBOW.forEach(({ color }, i) => {
        prop(jar(color, 1.6), (t) => {
          // Up from behind the isle, one after another, to the top of the bow.
          const u = ease((t - i * 0.25) / 3.4);
          return { x: lerp(118 - i * 6, BOW[0] + (i - 3) * 2.5, u), y: lerp(SEA + 4, BOW[1] + 46, u) + Math.sin(u * Math.PI) * 10, z: lerp(120, BOW[2], u), ry: t * 5, visible: t < 3.6 + i * 0.25 };
        });
      });
      prop(rainbow(), (t) => ({ x: BOW[0], y: BOW[1], z: BOW[2], scale: ease((t - 3.2) / 2.6), visible: t >= 3.2 }));
    },
    fx(t) {
      once(shots[1], 'whole', t, 3.6, () => {
        renderer.effects.sparkles(BOW[0], BOW[1] + 44, BOW[2], 140, colors);
        renderer.sky.flash = 1;
      });
      if (t > 3.2 && Math.random() < 0.5) renderer.effects.add('sparkle', BOW[0] + (Math.random() - 0.5) * 90, BOW[1] + 20 + Math.random() * 28, BOW[2], { size: 0.4, life: 0.9, vy: -1.5, color: colors[Math.floor(Math.random() * 7)] });
    },
    camera: keys([
      { t: 0, pos: [70, SEA + 12, 150], look: [84, SEA + 16, 60], fov: 52 },
      { t: 7.5, pos: [52, SEA + 22, 158], look: [66, SEA + 24, 20], fov: 50 },
    ]),
  });
  overlays.push(caption(shots[1].start + 0.5, 6.4, 'All seven colours flew up into the sky — and the rainbow stood over Adventure Isle again, brighter than ever!'));

  // 3. The party on the beach: everyone there, the Queen's helpers too.
  add({
    dur: 8.5,
    world: happy,
    time: 0.36,
    cut: 'fade',
    setup() {
      prop(rainbow(), () => ({ x: BOW[0], y: BOW[1], z: BOW[2] }));
      prop(star(1.1), (t) => ({ x: L[0], y: L[1] + 2.4, z: L[2], ry: t * 0.8 }));
      for (const [i, look] of KIDS.entries()) {
        const x = sp.x - 1.6 + i * 1.6;
        const z = sp.z + 1.4;
        kid(look, () => ({ x, y: groundY(happy.world, x, z), z, yaw: Math.PI, emote: i === 1 ? 'dance' : 'cheer', anim: ANIM.idle }));
      }
      for (const [i, ch] of RAINBOW_CHAPTERS.slice(0, 6).entries()) {
        const a = -1.25 + i * 0.5;
        const x = sp.x + Math.sin(a) * 8.5;
        const z = sp.z + 1 - Math.cos(a) * 7;
        monster(ch.boss, (t) => ({ x, y: groundY(happy.world, x, z) + Math.abs(Math.sin(t * 5 + i)) * 0.5, z, yaw: -a * 0.5, state: 'giggle', scale: 0.7 }));
      }
    },
    fx(t) {
      if (Math.random() < 0.09) renderer.effects.firework(L[0] - 30 + Math.random() * 50, L[1] + 6 + Math.random() * 10, L[2] + 30 + Math.random() * 30);
      if (t < 0.1) renderer.effects.confetti(sp.x, sp.y + 3, sp.z, 140, 1.4);
    },
    camera: keys([
      { t: 0, pos: [sp.x + 2, sp.y + 2.4, sp.z + 10], look: [sp.x, sp.y + 1.6, sp.z - 2], fov: 54 },
      { t: 8.5, pos: [sp.x - 2, sp.y + 8, sp.z + 17], look: [sp.x + 12, sp.y + 14, sp.z - 40], fov: 56 },
    ]),
  });
  overlays.push(caption(shots.at(-1).start + 0.5, 7.4, 'Even the Queen’s helpers came to see. Thank you, heroes of Adventure Isle!'));

  // 4. The credits, round the lighthouse, the rainbow behind it.
  add({
    dur: 14,
    world: happy,
    time: 0.7,
    cut: 'fade',
    setup() {
      prop(star(1.1), (t) => ({ x: L[0], y: L[1] + 2.4, z: L[2], ry: t * 0.8 }));
      prop(rainbow(), () => ({ x: BOW[0], y: BOW[1], z: BOW[2] }));
    },
    fx() {
      if (Math.random() < 0.03) renderer.effects.firework(L[0] - 20 + Math.random() * 40, L[1] + 8 + Math.random() * 8, L[2] + 10 + Math.random() * 30);
    },
    camera: orbit([L[0], L[1] - 2, L[2]], 34, 7, 0.5, -0.4, 14, 50),
  });
  const cast = RAINBOW_CHAPTERS.map((ch) => BOSSES[ch.boss].icon + ' ' + BOSSES[ch.boss].name);
  overlays.push(
    roll(shots.at(-1).start + 0.3, 13.5, ['#The Rainbow of Adventure Isle', 'Episode 2', '', '#Starring', 'You and your friends', '', '#and', ...cast, '', '#The seven colours', ...RAINBOW_CHAPTERS.map((ch, i) => ch.icon + ' ' + ch.name + ' · ' + RAINBOW[i].name), '', '#Made in Kids World', 'Thank you for playing!']),
  );

  // 5. Far out over the sea, Queen Grizzle floats home under her umbrella.
  const sea = [56, SEA + 8, 136];
  add({
    dur: 7.5,
    world: happy,
    time: 0.74,
    cut: 'fade',
    out: 'fade',
    setup() {
      prop(rainbow(), () => ({ x: BOW[0], y: BOW[1], z: BOW[2] }));
      monster('grizzle', (t) => ({ x: sea[0] - t * 0.5, y: sea[1] + Math.sin(t * 1.3) * 0.5, z: sea[2] + t * 0.7, yaw: -0.45, state: t > 4 ? 'giggle' : 'leap', air: 1 }));
    },
    camera: keys([
      { t: 0, pos: [sea[0] - 4, sea[1] + 0.4, sea[2] + 11], look: [sea[0], sea[1] + 1.6, sea[2]], fov: 46 },
      { t: 7.5, pos: [sea[0] - 6.5, sea[1] + 0.8, sea[2] + 15.5], look: [sea[0] - 3.4, sea[1] + 1.9, sea[2] + 5], fov: 42 },
    ]),
  });
  const teaser = shots.at(-1).start;
  overlays.push(caption(teaser + 0.4, 4, 'Far out over the sea, Queen Grizzle floated home. “Hmph,” she said. “It does look rather nice.”'));
  overlays.push(titleCard(teaser + 4.5, 3, 'The story goes on…', 'Where the rainbow ends: Episode 3, The Wild Isle', { size: 70 }));
  return { shots, overlays, poster: shots[1].start + 7.2 };
}

// ------------------------------------------------------------ the third episode

// A Sunstone (the third episode's): a golden stone, glowing like a little
// sun, a halo round it.
function sunstone(size = 1) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.IcosahedronGeometry(0.42, 1), new THREE.MeshStandardMaterial({ color: '#ffcf4a', emissive: '#ffb020', emissiveIntensity: 2.2, roughness: 0.25, metalness: 0.3, flatShading: true }));
  g.add(body);
  g.add(new THREE.Mesh(new THREE.SphereGeometry(0.95, 16, 12), new THREE.MeshBasicMaterial({ color: '#ffd77a', transparent: true, opacity: 0.22, depthWrite: false, blending: THREE.AdditiveBlending })));
  g.scale.setScalar(size);
  return g;
}

// Where a boss stands in its lair: beside the flag's floor in the middle of
// the yard, as on the isle (adventure.js kingSpot), on the ground there.
function lairSpot(m, dx = 4, dz = 0) {
  const lair = m.camps.at(-1);
  const x = lair.x + dx;
  const z = lair.z + dz;
  return { x, y: groundY(m.world, x, z), z };
}

// The third episode's chapters, and where each starts among the stages.
const WILD_FROM = CHAPTERS.findIndex((ch) => ch.episode === 3) + 1;
const WILD_CHAPTERS = CHAPTERS.filter((ch) => ch.episode === 3);

// ------------------------------------------------------------ the intro, episode 3

// Its intro: the rainbow over the happy isle, its end out to sea; flying in
// out of the fog to the Wild Isle, an island not made of bricks at all; Old
// Murk howling in Murk Fen as the Sunstones scatter; his four big helpers
// each in its lair with one, the last with him in Murk Tower; and you and
// your friends on the beach of Driftwood Bay.
function intro3() {
  const shore = isle(1, { freed: true });
  const cove = isle(WILD_FROM);
  const fen = isle(WILD_FROM + 4);
  const tower = lairSpot(fen);
  const shots = [];
  const overlays = [];
  let at = 0;
  const add = (shot) => {
    shot.start = at;
    shots.push(shot);
    at += shot.dur;
    return shot;
  };

  // 1. The rainbow over the happy isle, its end far out to sea.
  add({
    dur: 6.5,
    world: shore,
    time: 0.32,
    cut: 'fade',
    setup() {
      prop(rainbow(), () => ({ x: BOW[0], y: BOW[1], z: BOW[2] }));
    },
    camera: keys([
      { t: 0, pos: [64, SEA + 30, 150], look: [64, SEA + 18, 10], fov: 50 },
      { t: 6.5, pos: [64, SEA + 14, 110], look: [64, SEA + 8, -60], fov: 50 },
    ]),
  });
  overlays.push(caption(0.6, 5.6, 'The rainbow shone over Adventure Isle again — and one morning, its end pointed far out to sea…'));

  // 2. Out of the fog, the Wild Isle: an island no map shows.
  const sp = cove.world.spawn;
  add({
    dur: 8,
    world: cove,
    time: 0.3,
    weather: 'cloudy',
    cut: 'white',
    camera: keys([
      { t: 0, pos: [64, SEA + 10, 260], look: [64, SEA + 6, 64], fov: 46 },
      { t: 8, pos: [70, SEA + 22, 150], look: [64, SEA + 8, 60], fov: 50 },
    ]),
  });
  overlays.push(caption(shots[1].start + 0.6, 7, '…to an island no map shows: the Wild Isle. It is not made of bricks at all — its rocks are real rocks, its trees real trees and its waves real waves.'));

  // 3. Old Murk, the Fog Wolf, howling in his fen; the five Sunstones flying off.
  add({
    dur: 6.5,
    world: fen,
    time: 0.26,
    weather: 'cloudy',
    cut: 'fade',
    setup() {
      monster('murk', (t) => ({ x: tower.x, y: tower.y, z: tower.z, yaw: 0.6, state: t < 2 ? 'idle' : 'howl' }));
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2 + 0.4;
        prop(sunstone(0.9), (t) => {
          const u = Math.max(0, t - 3.2);
          return { x: tower.x + Math.cos(a) * u * 9, y: tower.y + 4 + u * 3 + Math.sin(t * 3 + i) * 0.2, z: tower.z + Math.sin(a) * u * 9, ry: t * 2, visible: t < 6.3 };
        });
      }
    },
    camera: keys([
      { t: 0, pos: [tower.x + 7, tower.y + 2.5, tower.z + 9], look: [tower.x, tower.y + 2, tower.z], fov: 50 },
      { t: 6.5, pos: [tower.x + 10, tower.y + 7, tower.z + 14], look: [tower.x, tower.y + 5, tower.z], fov: 56 },
    ]),
  });
  overlays.push(caption(shots[2].start + 0.5, 5.8, 'But a cold grey fog hung over it. Old Murk, the Fog Wolf, had stolen its five Sunstones, and his fog made every animal there grumpy.'));

  // 4. His four big helpers, each in its lair with a Sunstone.
  for (const [i, ch] of WILD_CHAPTERS.slice(0, 4).entries()) {
    const m = isle(WILD_FROM + i);
    const spot = lairSpot(m);
    const c = [spot.x, spot.y, spot.z];
    const a0 = 0.6 + i * 0.9;
    const tall = BOSSES[ch.boss].body.height;
    const shot = add({
      dur: 2.6,
      world: m,
      time: dayOf(ch),
      cut: i === 0 ? 'flash' : 'cut',
      setup() {
        monster(ch.boss, (t) => ({ x: c[0], y: c[1], z: c[2], yaw: a0 + 0.3, state: t % 2.6 < 1.3 ? 'idle' : 'chase' }));
        prop(sunstone(1.2), (t) => ({ x: c[0], y: c[1] + tall + 1.6 + Math.sin(t * 3) * 0.15, z: c[2], ry: t * 2 }));
      },
      camera: (t) => orbit([c[0], c[1] + tall * 0.55, c[2]], 6.4 + tall, 1.6, a0, a0 + 0.35, 2.6, 46)(t),
    });
    overlays.push(nameCard(shot.start + 0.15, 2.3, BOSSES[ch.boss].icon + ' ' + BOSSES[ch.boss].name, ch.icon + ' ' + ch.name + ' · ' + ch.lair));
  }

  // 5. The last Sunstone, with Old Murk himself in Murk Tower.
  add({
    dur: 5,
    world: fen,
    time: 0.3,
    weather: 'cloudy',
    cut: 'flash',
    setup() {
      monster('murk', (t) => ({ x: tower.x, y: tower.y, z: tower.z, yaw: 0.4, state: t < 2.4 ? 'idle' : 'howl' }));
      prop(sunstone(1.4), (t) => ({ x: tower.x, y: tower.y + 4.6 + Math.sin(t * 2) * 0.2, z: tower.z, ry: t * 1.5 }));
    },
    camera: keys([
      { t: 0, pos: [tower.x + 2, tower.y + 2.4, tower.z + 8.5], look: [tower.x, tower.y + 2.6, tower.z], fov: 50 },
      { t: 5, pos: [tower.x + 6, tower.y + 11, tower.z + 13], look: [tower.x - 3, tower.y + 3, tower.z - 2], fov: 56 },
    ]),
  });
  overlays.push(caption(shots.at(-1).start + 0.5, 4.3, 'The last one he kept for himself, in Murk Tower.'));

  // 6. The heroes on the beach of Driftwood Bay, and the way ahead.
  const first = cove.camps[0];
  add({
    dur: 9,
    world: cove,
    time: 0.32,
    cut: 'white',
    out: 'fade',
    setup() {
      for (const [i, look] of KIDS.entries()) {
        const x = sp.x - 1.6 + i * 1.6;
        const z = sp.z + 0.6 - Math.abs(i - 1) * 0.5;
        kid(look, (t) => ({ x, y: groundY(cove.world, x, z), z, yaw: Math.atan2(first.x - x, first.z - z) + Math.PI, emote: t < 2.4 ? 'surprise' : t < 5.2 ? 'wave' : 'cheer', anim: ANIM.idle }));
      }
    },
    camera: keys([
      { t: 0, pos: [sp.x + 5, sp.y + 2, sp.z + 5], look: [sp.x, sp.y + 1, sp.z], fov: 46 },
      { t: 3, pos: [sp.x + 6, sp.y + 2.6, sp.z + 6], look: [sp.x, sp.y + 1.2, sp.z], fov: 46 },
      { t: 9, pos: [sp.x + 4, sp.y + 22, sp.z + 22], look: [first.x - 18, first.y + 4, first.z - 30], fov: 54 },
    ]),
  });
  const last = shots.at(-1).start;
  overlays.push(caption(last + 0.5, 3.2, 'Without its Sunstones, the Wild Isle will never see the sun again. Heroes — win them back!'));
  overlays.push(titleCard(last + 4, 4.8, 'The Wild Isle', 'Episode 3 · Win back all five Sunstones — together!', { size: 78 }));
  return { shots, overlays, poster: last + 6.6 };
}

// ------------------------------------------------------------ the ending, episode 3

// Its ending: Old Murk popped in Murk Tower; the five Sunstones flying up
// together and the fog blowing away; the party on the beach of Driftwood Bay
// with the animals, friendly now; the credits round the lighthouse; and Old
// Murk asleep in a sunny spot, only ever cold.
function ending3() {
  const fen = isle(WILD_FROM + 4, { freed: true });
  const tower = lairSpot(fen);
  const cove = isle(WILD_FROM, { freed: true });
  const sp = cove.world.spawn;
  const light = cove.camps[2];
  const gold = ['#ffcf4a', '#ffe08a', '#fff3c4', '#ffb020'];
  const shots = [];
  const overlays = [];
  let at = 0;
  const add = (shot) => {
    shot.start = at;
    shots.push(shot);
    at += shot.dur;
    return shot;
  };

  // 1. Murk Tower: the last bop, and Old Murk goes pop, fog and all.
  add({
    dur: 6,
    world: fen,
    time: 0.34,
    weather: 'cloudy',
    cut: 'fade',
    setup() {
      monster('murk', (t) => ({ x: tower.x, y: tower.y, z: tower.z, yaw: 0.3, state: 'dazed', visible: t < 1.6 }));
      prop(sunstone(1.2), (t) => ({ x: tower.x, y: tower.y + 2 + Math.max(0, t - 1.6) * 1.2, z: tower.z, ry: t * 2.4, visible: t >= 1.6 }));
      for (const [i, look] of KIDS.entries()) {
        const a = -0.5 + i * 0.5;
        const x = tower.x + Math.sin(a) * 5;
        const z = tower.z + Math.cos(a) * 5;
        kid(look, (t) => ({ x, y: tower.y, z, yaw: a + Math.PI, emote: t < 1.6 ? 'surprise' : 'cheer', anim: ANIM.idle }));
      }
    },
    fx(t) {
      once(shots[0], 'pop', t, 1.6, () => {
        renderer.effects.sparkles(tower.x, tower.y + 2, tower.z, 110, gold);
        renderer.effects.bang(tower.x, tower.y + 2, tower.z);
        renderer.effects.spores(tower.x, tower.y, tower.z, 6, 'mist');
        renderer.sky.flash = 1;
      });
    },
    camera: keys([
      { t: 0, pos: [tower.x + 3, tower.y + 3.2, tower.z + 10], look: [tower.x, tower.y + 2, tower.z], fov: 50 },
      { t: 6, pos: [tower.x + 5, tower.y + 6, tower.z + 13], look: [tower.x, tower.y + 4.5, tower.z], fov: 54 },
    ]),
  });
  overlays.push(caption(0.5, 5, 'Pop! Old Murk was popped, fog and all!'));

  // 2. The five Sunstones fly up together, the fog blows away, the sun comes out.
  add({
    dur: 7.5,
    world: fen,
    time: (t) => 0.27 + t * 0.012,
    cut: 'flash',
    setup() {
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2;
        prop(sunstone(1.3), (t) => {
          const u = ease((t - i * 0.2) / 3.6);
          return { x: lerp(tower.x + Math.cos(a) * 30, tower.x, u), y: lerp(tower.y + 2, tower.y + 30, u), z: lerp(tower.z + Math.sin(a) * 30, tower.z, u), ry: t * 4, visible: t < 4.2 + i * 0.1 };
        });
      }
    },
    fx(t) {
      once(shots[1], 'sun', t, 4, () => {
        renderer.effects.sparkles(tower.x, tower.y + 30, tower.z, 160, gold);
        renderer.sky.flash = 1;
      });
    },
    camera: keys([
      { t: 0, pos: [tower.x + 30, tower.y + 14, tower.z + 40], look: [tower.x, tower.y + 10, tower.z], fov: 54 },
      { t: 7.5, pos: [tower.x + 40, tower.y + 30, tower.z + 55], look: [tower.x, tower.y + 22, tower.z], fov: 56 },
    ]),
  });
  overlays.push(caption(shots[1].start + 0.5, 6.4, 'All five Sunstones flew up together, the fog blew away over the sea — and the sun shone on the Wild Isle again!'));

  // 3. The party on the beach, the animals there too, friendly now.
  add({
    dur: 8.5,
    world: cove,
    time: 0.36,
    cut: 'fade',
    setup() {
      for (const [i, look] of KIDS.entries()) {
        const x = sp.x - 1.6 + i * 1.6;
        const z = sp.z + 0.5;
        kid(look, () => ({ x, y: groundY(cove.world, x, z), z, yaw: Math.PI, emote: i === 1 ? 'dance' : 'cheer', anim: ANIM.idle }));
      }
      // (Up the beach behind them, inland: the sea is the other way.)
      for (const [i, ch] of WILD_CHAPTERS.slice(0, 4).entries()) {
        const a = -1.1 + i * 0.75;
        const x = sp.x + Math.sin(a) * 7;
        const z = sp.z - 3 - Math.cos(a) * 4;
        monster(ch.boss, (t) => ({ x, y: groundY(cove.world, x, z), z, yaw: Math.atan2(sp.x - x, sp.z - z), state: t % 3 < 1.5 ? 'idle' : 'giggle', scale: 0.6 }));
      }
    },
    fx(t) {
      if (Math.random() < 0.09) renderer.effects.firework(sp.x - 30 + Math.random() * 50, sp.y + 14 + Math.random() * 10, sp.z + 20 + Math.random() * 30);
      if (t < 0.1) renderer.effects.confetti(sp.x, sp.y + 3, sp.z, 140, 1.4);
    },
    camera: keys([
      { t: 0, pos: [sp.x - 1, sp.y + 2.6, sp.z + 9], look: [sp.x, sp.y + 1.4, sp.z - 3], fov: 56 },
      { t: 8.5, pos: [sp.x + 3, sp.y + 7, sp.z + 15], look: [sp.x - 4, sp.y + 5, sp.z - 30], fov: 58 },
    ]),
  });
  overlays.push(caption(shots.at(-1).start + 0.5, 7.4, 'Every animal on the island came to see — friendly again, every one of them. Thank you, heroes of the Wild Isle!'));

  // 4. The credits, round the lighthouse at sunset.
  const L = [light.x - 6, light.y, light.z - 12];
  add({
    dur: 14,
    world: cove,
    time: 0.71,
    cut: 'fade',
    fx() {
      if (Math.random() < 0.03) renderer.effects.firework(L[0] - 20 + Math.random() * 40, L[1] + 16 + Math.random() * 8, L[2] + 10 + Math.random() * 30);
    },
    camera: orbit([L[0], L[1] + 6, L[2]], 36, 8, 0.5, -0.4, 14, 50),
  });
  const cast = WILD_CHAPTERS.map((ch) => BOSSES[ch.boss].icon + ' ' + BOSSES[ch.boss].name);
  overlays.push(roll(shots.at(-1).start + 0.3, 13.5, ['#The Wild Isle', 'Episode 3', '', '#Starring', 'You and your friends', '', '#and', ...cast, '', '#The five Sunstones', ...WILD_CHAPTERS.map((ch) => ch.icon + ' ' + ch.name), '', '#Made in Kids World', 'Thank you for playing!']));

  // 5. Old Murk, curled up asleep in a sunny spot.
  add({
    dur: 7,
    world: fen,
    time: 0.5,
    cut: 'fade',
    out: 'fade',
    setup() {
      monster('murk', () => ({ x: tower.x, y: tower.y, z: tower.z, yaw: 1.1, state: 'dazed', scale: 0.8 }));
    },
    camera: keys([
      { t: 0, pos: [tower.x + 4, tower.y + 1.6, tower.z + 5], look: [tower.x, tower.y + 0.8, tower.z], fov: 46 },
      { t: 7, pos: [tower.x + 6, tower.y + 3.5, tower.z + 8], look: [tower.x, tower.y + 1, tower.z], fov: 46 },
    ]),
  });
  const teaser = shots.at(-1).start;
  overlays.push(caption(teaser + 0.4, 4, 'And Old Murk? He curled up in a sunny spot and went to sleep. It turns out he was only ever cold.'));
  // (And high over the fen, a magpie flapping off with something shiny: the
  // story goes on, in the fourth episode.)
  overlays.push(titleCard(teaser + 4.4, 2.6, 'The story goes on…', 'A magpie feather floats down: Episode 4, The Golden Bells', { size: 70 }));
  shots.at(-1).setup = () => {
    monster('murk', () => ({ x: tower.x, y: tower.y, z: tower.z, yaw: 1.1, state: 'dazed', scale: 0.8 }));
    critter('magpie', (t) => ({ x: tower.x - 14 + t * 3.4, y: tower.y + 9 + Math.sin(t * 2) * 0.4, z: tower.z - 10 + t * 1.2, yaw: 1.2, state: 'fly', moving: true }));
  };
  return { shots, overlays, poster: shots[1].start + 7 };
}

// ------------------------------------------------------------ the fourth episode

// A Golden Bell (the fourth episode's): gold, flared at its lip, a ring on
// its crown and a clapper inside, hung from the top of it (where the prop
// stands), so it swings from there.
function goldenBell(size = 1) {
  const g = new THREE.Group();
  const hung = new THREE.Group();
  hung.position.y = -1.18;
  g.add(hung);
  const gold = new THREE.MeshStandardMaterial({ color: '#ffcf3a', emissive: '#a8700c', emissiveIntensity: 0.55, roughness: 0.22, metalness: 0.85, side: THREE.DoubleSide });
  const shape = [[0.66, 0], [0.7, 0.04], [0.6, 0.14], [0.48, 0.36], [0.43, 0.62], [0.4, 0.86], [0.3, 1.0], [0.16, 1.06], [0, 1.08]].map(([x, y]) => new THREE.Vector2(x, y));
  hung.add(new THREE.Mesh(new THREE.LatheGeometry(shape, 28), gold));
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.035, 8, 16), gold);
  ring.position.y = 1.14;
  hung.add(ring);
  const clapper = new THREE.Mesh(new THREE.SphereGeometry(0.13, 12, 8), new THREE.MeshStandardMaterial({ color: '#7a4c12', roughness: 0.5 }));
  clapper.position.y = 0.1;
  hung.add(clapper);
  g.scale.setScalar(size);
  return g;
}

// The fourth episode's chapters, where each starts among the stages, and the
// cage of a chapter's bell on its map (isle-bells.js bellCage: where the bell
// hangs, where Jinx perches on its roof).
const BELL_FROM = CHAPTERS.findIndex((ch) => ch.episode === 4) + 1;
const BELL_CHAPTERS = CHAPTERS.filter((ch) => ch.episode === 4);
const cageOf = (m) => ({ bell: m.hub.bell, perch: m.hub.perch ?? [m.hub.bell[0], m.hub.bell[1] + 6, m.hub.bell[2]] });

// ------------------------------------------------------------ the intro, episode 4

// Its intro: dawn over Adventure Isle, its five Golden Bells ringing round
// the lighthouse's lantern; Jinx the Magpie swooping down in the night and
// flying off with them all; each of his Puzzle Isles with a bell locked in a
// cage, and what he has made a game of there; the last bell with him in his
// own nest; and you and your friends by the first cage, in Bellbuoy Bay.
function intro4() {
  const shore = isle(1, { freed: true });
  const { light: L } = shoreSpots(shore);
  const bay = isle(BELL_FROM);
  const nestM = isle(BELL_FROM + 4);
  const nestQ = nestM.quests.find((q) => q.kind === 'jinx');
  const perch = nestQ.perch;
  const shots = [];
  const overlays = [];
  let at = 0;
  const add = (shot) => {
    shot.start = at;
    shots.push(shot);
    at += shot.dur;
    return shot;
  };
  const ringAt = (i, t) => {
    const a = (i / 5) * Math.PI * 2 + 0.3;
    return { x: L[0] + Math.cos(a) * 3.4, y: L[1] - 2.5, z: L[2] + Math.sin(a) * 3.4, rz: Math.sin(t * 3.2 + i) * 0.35 };
  };

  // 1. Dawn: five Golden Bells ringing round the lighthouse's lantern.
  add({
    dur: 7,
    world: shore,
    time: (t) => 0.24 + t * 0.004,
    cut: 'fade',
    setup() {
      for (let i = 0; i < 5; i++) prop(goldenBell(1), (t) => ringAt(i, t));
    },
    fx(t) {
      if (Math.random() < 0.05) renderer.effects.notes(L[0] + (Math.random() - 0.5) * 8, L[1] - 1, L[2] + (Math.random() - 0.5) * 8);
    },
    camera: keys([
      { t: 0, pos: [L[0] + 34, SEA + 6, L[2] - 44], look: [L[0], L[1] - 3, L[2]], fov: 46 },
      { t: 7, pos: [L[0] + 8, L[1] + 1, L[2] - 10], look: [L[0], L[1] - 2.5, L[2]], fov: 46 },
    ]),
  });
  overlays.push(caption(0.8, 5.8, 'Every morning, five Golden Bells rang Adventure Isle awake — ding, dong!'));

  // 2. Night: Jinx swoops down, and off he flies with every one of them.
  add({
    dur: 8,
    world: shore,
    time: 0.03,
    cut: 'fade',
    setup() {
      const jinx = (t) => {
        if (t < 2.4) return { x: L[0] - 30 + t * 12.5, y: L[1] + 8 - t * 3.2, z: L[2] + 18 - t * 7.2 };
        if (t < 3.6) return { x: L[0] + 0.5, y: L[1] + 0.4, z: L[2] + 1 };
        const u = t - 3.6;
        return { x: L[0] + u * 9, y: L[1] + 1 + u * 3, z: L[2] - u * 7 };
      };
      critter('magpie', (t) => ({ ...jinx(t), yaw: t < 2.4 ? 0.9 : t < 3.6 ? 0.2 : 2.2, state: t >= 2.4 && t < 3.6 ? 'idle' : 'fly', moving: true }));
      for (let i = 0; i < 5; i++) {
        prop(goldenBell(1), (t) => {
          const home = ringAt(i, 0);
          if (t < 3.6 + i * 0.12) return { ...home, rz: t > 2.4 ? Math.sin(t * 20) * 0.2 : 0 };
          const j = jinx(t);
          const u = ease((t - 3.6 - i * 0.12) / 0.8);
          return { x: lerp(home.x, j.x - 1 - i * 0.9, u), y: lerp(home.y, j.y - 1.5 - i * 0.35, u), z: lerp(home.z, j.z + i * 0.7, u), rz: Math.sin(t * 8 + i) * 0.4 };
        });
      }
    },
    fx(t) {
      once(shots[1], 'grab', t, 3.4, () => renderer.effects.sparkles(L[0], L[1] - 1, L[2], 60, ['#ffd84d', '#fff3a0', '#ffffff']));
    },
    camera: keys([
      { t: 0, pos: [L[0] - 14, L[1] + 2, L[2] + 16], look: [L[0] - 6, L[1] + 2, L[2] + 6], fov: 52 },
      { t: 3.4, pos: [L[0] - 8, L[1] + 1, L[2] + 10], look: [L[0], L[1] - 1, L[2]], fov: 50 },
      { t: 8, pos: [L[0] - 10, L[1] + 4, L[2] + 14], look: [L[0] + 22, L[1] + 12, L[2] - 22], fov: 54 },
    ]),
  });
  overlays.push(caption(shots[1].start + 0.6, 7, 'Until one night Jinx the Magpie — the cheekiest bird on the seven seas — swooped down and carried them all off. No magpie can leave anything shiny alone!'));

  // 3. His Puzzle Isles: each bell in a cage, Jinx's challenges all round it.
  for (const [i, ch] of BELL_CHAPTERS.slice(0, 4).entries()) {
    const m = isle(BELL_FROM + i);
    const { bell, perch: roof } = cageOf(m);
    const a0 = 0.5 + i * 1.1;
    const shot = add({
      dur: 2.9,
      world: m,
      time: 0.36,
      cut: i === 0 ? 'flash' : 'cut',
      setup() {
        critter('magpie', (t) => ({ x: roof[0] + 0.5, y: roof[1], z: roof[2] + 0.5, yaw: a0 + Math.sin(t * 2) * 0.4, state: 'idle' }));
      },
      camera: (t) => orbit([bell[0] + 0.5, bell[1] + 1, bell[2] + 0.5], 13, 3, a0, a0 + 0.4, 2.9, 48)(t),
    });
    overlays.push(nameCard(shot.start + 0.15, 2.6, `${ch.icon} ${ch.name}`, ch.quests.map((q) => `${questIcon(q)} ${q.name}`).join(' · ')));
  }

  // 4. The last bell, in his own nest, and Jinx chattering on top of it.
  add({
    dur: 5.5,
    world: nestM,
    time: 0.3,
    cut: 'flash',
    setup() {
      critter('magpie', (t) => ({ x: perch[0] + 0.5, y: perch[1], z: perch[2] + 0.5, yaw: 0.2 + Math.sin(t * 3) * 0.3, state: t % 1.6 < 0.3 ? 'hop' : 'idle' }));
      prop(goldenBell(1.1), (t) => ({ x: perch[0] + 3, y: perch[1] + 2.6, z: perch[2] + 1, rz: Math.sin(t * 2.4) * 0.25 }));
    },
    camera: keys([
      { t: 0, pos: [perch[0] + 4, perch[1] + 5, perch[2] + 14], look: [perch[0], perch[1] + 1.4, perch[2]], fov: 48 },
      { t: 5.5, pos: [perch[0] + 12, perch[1] + 11, perch[2] + 22], look: [perch[0], perch[1] + 1, perch[2]], fov: 54 },
    ]),
  });
  overlays.push(caption(shots.at(-1).start + 0.5, 4.8, 'The last bell he keeps in his own nest — and he left a feather, with a note: “Catch me if you can!”'));

  // 5. The heroes by the first cage, in Bellbuoy Bay; and the title.
  const sp = bay.world.spawn;
  const { bell, perch: roof } = cageOf(bay);
  add({
    dur: 9,
    world: bay,
    time: 0.32,
    cut: 'white',
    out: 'fade',
    setup() {
      critter('magpie', (t) => ({ x: roof[0] + 0.5, y: roof[1], z: roof[2] + 0.5, yaw: 1.4 + Math.sin(t * 1.5) * 0.5, state: 'idle' }));
      for (const [i, look] of KIDS.entries()) {
        const x = bell[0] + 6 + i * 1.5;
        const z = bell[2] - 2 + i * 1.6;
        kid(look, (t) => ({ x, y: groundY(bay.world, x, z), z, yaw: Math.atan2(bell[0] - x, bell[2] - z), emote: t < 2.4 ? 'surprise' : t < 5.2 ? 'wave' : 'cheer', anim: ANIM.idle }));
      }
    },
    camera: keys([
      { t: 0, pos: [bell[0] + 13, bell[1] + 1, bell[2] + 5], look: [bell[0] + 2, bell[1], bell[2]], fov: 48 },
      { t: 3.2, pos: [bell[0] + 14, bell[1] + 2.5, bell[2] + 7], look: [bell[0] + 2, bell[1] + 1, bell[2]], fov: 48 },
      { t: 9, pos: [sp.x + 6, sp.y + 24, sp.z + 24], look: [64, sp.y + 2, 50], fov: 56 },
    ]),
  });
  const last = shots.at(-1).start;
  overlays.push(caption(last + 0.5, 3.4, 'No monsters this time — only tricks. Beat his challenges, open every lock, and ring the bells again!'));
  overlays.push(titleCard(last + 4.2, 4.6, 'The Golden Bells', 'Episode 4 · Win back all five bells — together!', { size: 78 }));
  return { shots, overlays, poster: last + 6.4 };
}

// ------------------------------------------------------------ the ending, episode 4

// Its ending: Jinx caught at last, dazzled on the clearing below his nest;
// the five Golden Bells flying home out of it; the party round the open cage
// in Bellbuoy Bay, the monkeys, chicks and sheep there too, the bells ringing
// over it; the credits round the bay's lighthouse; and Jinx at dawn,
// listening to the bells as good as gold — well, almost.
function ending4() {
  const nestM = isle(BELL_FROM + 4);
  const q = nestM.quests.find((o) => o.kind === 'jinx');
  const land = [q.land[0] + 0.5, q.land[1], q.land[2] + 0.5];
  const perch = q.perch;
  // (An island of its own, not the intro's: its cage open, the bars at its
  // front gone, every lock lit.)
  const bay = isle(BELL_FROM, { freed: true });
  if (!bay.opened) {
    for (let k = 0; k < bay.hub.open.length; k += 4) bay.world.set(bay.hub.open[k], bay.hub.open[k + 1], bay.hub.open[k + 2], bay.hub.open[k + 3]);
    for (const [i, c] of bay.hub.locks.entries()) bay.world.set(c[0], c[1], c[2], B.ESCAPE_BUTTONS_ON[i]);
    bay.opened = true;
  }
  const { bell, perch: roof } = cageOf(bay);
  const lighthouseAt = [58.5, groundY(bay.world, 58, 24), 24.5];
  const gold = ['#ffcf4a', '#ffe08a', '#fff3c4', '#ffb020'];
  const shots = [];
  const overlays = [];
  let at = 0;
  const add = (shot) => {
    shot.start = at;
    shots.push(shot);
    at += shot.dur;
    return shot;
  };

  // 1. Jinx, dazzled on the clearing, and caught.
  add({
    dur: 6,
    world: nestM,
    time: 0.34,
    cut: 'fade',
    setup() {
      critter('magpie', (t) => ({ x: land[0], y: land[1], z: land[2], yaw: 0.3, state: 'idle', roll: t < 1.6 ? Math.sin(t * 6) * 0.15 : 0 }));
      for (const [i, look] of KIDS.entries()) {
        const a = -0.6 + i * 0.6;
        const x = land[0] + Math.sin(a) * 3.6;
        const z = land[2] + Math.cos(a) * 3.6;
        kid(look, (t) => ({ x, y: land[1], z, yaw: a + Math.PI, emote: t < 1.6 ? 'surprise' : 'cheer', anim: ANIM.idle }));
      }
    },
    fx(t) {
      if (t < 1.6) renderer.effects.dizzy(land[0], land[1] + 2.3, land[2], t, 0.6);
      once(shots[0], 'caught', t, 1.6, () => {
        renderer.effects.sparkles(land[0], land[1] + 1.4, land[2], 110, gold);
        renderer.effects.stars(land[0], land[1] + 1.6, land[2], 12);
        renderer.sky.flash = 1;
      });
    },
    camera: keys([
      { t: 0, pos: [land[0] + 2, land[1] + 2.4, land[2] + 8.5], look: [land[0], land[1] + 1.2, land[2]], fov: 50 },
      { t: 6, pos: [land[0] + 4, land[1] + 4.5, land[2] + 11], look: [land[0], land[1] + 1.6, land[2]], fov: 54 },
    ]),
  });
  overlays.push(caption(0.5, 5, 'Caught! Jinx the Magpie was caught, fair and square.'));

  // 2. The five Golden Bells, flying home out of his nest.
  add({
    dur: 7.5,
    world: nestM,
    time: 0.36,
    cut: 'flash',
    setup() {
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2;
        prop(goldenBell(1.2), (t) => {
          const u = ease((t - i * 0.25) / 4);
          return { x: perch[0] + Math.cos(a) * (2 + u * 6) + u * 10, y: perch[1] + 1 + u * 16, z: perch[2] + Math.sin(a) * (2 + u * 6) + u * 40, rz: Math.sin(t * 5 + i) * 0.35 };
        });
      }
      critter('magpie', (t) => ({ x: perch[0] + 0.5, y: perch[1], z: perch[2] + 0.5, yaw: 0.2 + Math.sin(t * 1.3) * 0.3, state: 'idle' }));
    },
    fx(t) {
      if (Math.random() < 0.12) renderer.effects.notes(perch[0] + Math.random() * 10, perch[1] + 4 + t * 2, perch[2] + 6 + t * 5);
    },
    camera: keys([
      { t: 0, pos: [perch[0] - 10, perch[1] + 4, perch[2] - 12], look: [perch[0], perch[1] + 2, perch[2]], fov: 52 },
      { t: 7.5, pos: [perch[0] - 14, perch[1] + 10, perch[2] - 10], look: [perch[0] + 8, perch[1] + 14, perch[2] + 30], fov: 56 },
    ]),
  });
  overlays.push(caption(shots[1].start + 0.5, 6.4, 'He fluffed up his feathers and gave back every Golden Bell. All he ever wanted was someone to play with!'));

  // 3. The party round the open cage, the bells ringing over it.
  add({
    dur: 8.5,
    world: bay,
    time: 0.36,
    cut: 'fade',
    setup() {
      for (let i = 0; i < 5; i++) prop(goldenBell(0.9), (t) => ({ x: bell[0] + 0.5 + (i - 2) * 2.2, y: bell[1] + 8.5, z: bell[2] + 0.5, rz: Math.sin(t * 3 + i * 0.9) * 0.4 }));
      critter('magpie', (t) => ({ x: roof[0] + 0.5, y: roof[1], z: roof[2] + 0.5, yaw: 1.6, state: t % 2 < 0.4 ? 'hop' : 'idle' }));
      for (const [i, look] of KIDS.entries()) {
        const x = bell[0] + 7 + i * 1.6;
        const z = bell[2] - 1.5 + i * 1.4;
        kid(look, () => ({ x, y: groundY(bay.world, x, z), z, yaw: -Math.PI / 2, emote: i === 1 ? 'dance' : 'cheer', anim: ANIM.idle }));
      }
      // Coco, Kiki and Bobo, friends now.
      for (let i = 0; i < 3; i++) {
        const x = bell[0] + 5 + i * 1.3;
        const z = bell[2] + 4.5;
        critter('monkey', (t) => ({ x, y: groundY(bay.world, x, z), z, yaw: Math.PI + 0.4, state: (t + i) % 2 < 1 ? 'happy' : 'idle' }));
      }
      for (let i = 0; i < 4; i++) {
        const x = bell[0] + 5 + i * 0.8;
        const z = bell[2] - 5;
        critter('chick', (t) => ({ x: x + Math.sin(t * 2 + i) * 0.3, y: groundY(bay.world, x, z), z, yaw: 0.4 * i, state: 'walk', moving: true }));
      }
      for (let i = 0; i < 2; i++) {
        const x = bell[0] + 10 + i * 1.8;
        const z = bell[2] + 3;
        critter('sheep', () => ({ x, y: groundY(bay.world, x, z), z, yaw: -1.2, state: 'eat' }));
      }
    },
    fx(t) {
      if (Math.random() < 0.09) renderer.effects.firework(bell[0] - 20 + Math.random() * 40, bell[1] + 16 + Math.random() * 10, bell[2] - 20 + Math.random() * 30);
      if (t < 0.1) renderer.effects.confetti(bell[0] + 4, bell[1] + 4, bell[2], 160, 1.5);
      if (Math.random() < 0.1) renderer.effects.notes(bell[0] + (Math.random() - 0.5) * 10, bell[1] + 9, bell[2] + (Math.random() - 0.5) * 3);
    },
    camera: keys([
      { t: 0, pos: [bell[0] + 17, bell[1] - 0.6, bell[2] + 6], look: [bell[0] + 2, bell[1] + 2.4, bell[2]], fov: 54 },
      { t: 8.5, pos: [bell[0] + 21, bell[1] + 4, bell[2] + 10], look: [bell[0], bell[1] + 5, bell[2]], fov: 58 },
    ]),
  });
  overlays.push(caption(shots.at(-1).start + 0.5, 7.4, 'Ding, dong! All five Golden Bells ring out over Adventure Isle again. Thank you, heroes!'));

  // 4. The credits, round the bay's lighthouse at sunset.
  add({
    dur: 14,
    world: bay,
    time: 0.71,
    cut: 'fade',
    fx() {
      if (Math.random() < 0.03) renderer.effects.firework(lighthouseAt[0] - 20 + Math.random() * 40, lighthouseAt[1] + 16 + Math.random() * 8, lighthouseAt[2] + 10 + Math.random() * 30);
    },
    camera: orbit([lighthouseAt[0], lighthouseAt[1] + 6, lighthouseAt[2]], 34, 8, 0.6, -0.3, 14, 50),
  });
  overlays.push(roll(shots.at(-1).start + 0.3, 13.5, ['#The Golden Bells', 'Episode 4', '', '#Starring', 'You and your friends', '', '#and', '🐦 Jinx the Magpie', '🐒 Coco, Kiki and Bobo', '🐥 the chicks of Henhouse Hills', '🐑 the sheep of Kite Cliffs', '', '#The five Puzzle Isles', ...BELL_CHAPTERS.map((ch) => ch.icon + ' ' + ch.name), '', '#Made in Kids World', 'Thank you for playing!']));

  // 5. Dawn: the bells ring, and Jinx listens — as good as gold. Almost.
  add({
    dur: 7,
    world: bay,
    time: 0.26,
    cut: 'fade',
    out: 'fade',
    setup() {
      // (The bells in a row behind him, as the camera sees it.)
      for (let i = 0; i < 5; i++) prop(goldenBell(0.8), (t) => ({ x: roof[0] - 3, y: roof[1] + 4.2, z: roof[2] + 0.5 + (i - 2) * 2.2, rz: Math.sin(t * 2.6 + i * 0.9) * 0.3 }));
      critter('magpie', (t) => ({ x: roof[0] + 0.5, y: roof[1], z: roof[2] + 0.5, yaw: t < 4 ? 1.6 : 1.6 + Math.min(1, (t - 4) * 2) * 1.5, state: 'idle' }));
    },
    camera: keys([
      { t: 0, pos: [roof[0] + 10, roof[1] + 1.5, roof[2] + 2], look: [roof[0], roof[1] + 1.6, roof[2]], fov: 46 },
      { t: 7, pos: [roof[0] + 7.5, roof[1] + 2, roof[2] + 1.5], look: [roof[0], roof[1] + 1.6, roof[2]], fov: 42 },
    ]),
  });
  const teaser = shots.at(-1).start;
  overlays.push(caption(teaser + 0.4, 4, 'Now Jinx perches by the bells every morning to listen, as good as gold. Well — almost…'));
  // (And he has a present for you: an old sea chart. The story goes on, in
  // the fifth episode.)
  overlays.push(titleCard(teaser + 4.4, 2.6, 'The story goes on…', 'An old sea chart from Jinx: Episode 5, Toon Isle', { size: 70 }));
  return { shots, overlays, poster: shots[2].start + 6 };
}

// ------------------------------------------------------------ the fifth episode

// A Sky Lantern (the fifth episode's): a big red paper lantern, ribbed, gold
// at its top and foot, glowing from inside while it is lit; lit: a function
// of the shot's time saying whether it is.
function skyLantern(size = 1, lit = () => true) {
  const g = new THREE.Group();
  const paper = toonMat('#ff5a4a', 0.9);
  const dark = toonMat('#c8463c', 0);
  const gold = toonMat('#ffcf4a', 0.2);
  const shape = [0, 0.15, 0.55, 0.85, 1.0, 1.02, 1.0, 0.85, 0.55, 0.15, 0].map((r, i) => new THREE.Vector2(Math.max(0.01, r * 1.05), i * 0.26));
  const shell = new THREE.Mesh(new THREE.LatheGeometry(shape, 24), paper);
  shell.position.y = -1.3;
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.55, 0.28, 16), gold);
  cap.position.y = 1.45;
  const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.42, 0.28, 16), gold);
  foot.position.y = -1.42;
  g.add(shell, cap, foot);
  g.scale.setScalar(size);
  g.userData.light = (t) => {
    shell.material = lit(t) ? paper : dark;
  };
  return g;
}
const toonMat = (color, glow) => toon(color, glow ? { emissive: glow } : {});

// The Cloud Blanket over the whole of a Toon Isle island, as the game draws
// it (isle-battles-view.js readFog, render/cartoon-clouds.js): every tile
// hidden but those round `clear` ([x, z, r] each).
function blanket(world, clear = []) {
  const tile = 8;
  const w = Math.ceil(world.W / tile);
  const h = Math.ceil(world.D / tile);
  const fog = { tile, w, h, seen: new Uint8Array(w * h), at: new Float64Array(w * h).fill(Infinity), count: 0 };
  for (const [x, z, r] of clear) unveil(fog, x, z, r);
  return fog;
}

// The clouds rolled back round (x, z), as far as r: the tiles newly seen.
function unveil(fog, x, z, r) {
  const out = [];
  for (let i = 0; i < fog.w; i++) {
    for (let j = 0; j < fog.h; j++) {
      const k = i * fog.h + j;
      if (fog.seen[k]) continue;
      const dx = Math.max(i * fog.tile - x, 0, x - (i + 1) * fog.tile);
      const dz = Math.max(j * fog.tile - z, 0, z - (j + 1) * fog.tile);
      if (dx * dx + dz * dz > r * r) continue;
      fog.seen[k] = 1;
      fog.count++;
      out.push(k);
    }
  }
  return out;
}

const TOON_FROM = CHAPTERS.findIndex((ch) => ch.episode === 5) + 1;
const TOON_CHAPTERS = CHAPTERS.filter((ch) => ch.episode === 5);

// ------------------------------------------------------------ the intro, episode 5

// Its intro: a little boat out at sea, sailing up to a mountain of cloud —
// Toon Isle under Baron Bluster's Cloud Blanket; the Baron himself, laughing
// over it, blowing out its five Sky Lanterns; under the clouds, the Big Bads
// of its corners; the Baron waiting on Thunder Top; and you and your friends
// on the beach of Lollipop Bay, the clouds rolling back as you go.
function intro5() {
  const bay = isle(TOON_FROM);
  const top = isle(TOON_FROM + 4);
  const sp = bay.world.spawn;
  const lantern = bay.hub.lantern;
  const shots = [];
  const overlays = [];
  let at = 0;
  const add = (shot) => {
    shot.start = at;
    shots.push(shot);
    at += shot.dur;
    return shot;
  };

  // 1. Out at sea, sailing up to a mountain of cloud.
  add({
    dur: 8,
    world: bay,
    time: 0.3,
    cut: 'fade',
    setup() {
      renderer.setFog(blanket(bay.world));
      critter('boat', (t) => ({ x: sp.x + 4, y: SEA + 0.9, z: sp.z + 40 - t * 2.6, yaw: Math.PI, moving: true }));
    },
    camera: keys([
      { t: 0, pos: [sp.x + 26, SEA + 5, sp.z + 92], look: [sp.x, SEA + 14, sp.z - 40], fov: 50 },
      { t: 8, pos: [sp.x + 12, SEA + 4, sp.z + 66], look: [sp.x, SEA + 12, sp.z - 30], fov: 50 },
    ]),
  });
  overlays.push(caption(0.7, 7, 'Jinx was so sorry for his tricks that he gave you his best shiny of all: an old sea chart of Toon Isle, the biggest island on the seven seas — where everything looks like a cartoon!'));

  // 2. Baron Bluster over the clouds, blowing out the Sky Lanterns.
  const cx = 128;
  const cz = 120;
  const cy = SEA + 30;
  add({
    dur: 8,
    world: bay,
    time: 0.34,
    cut: 'cut',
    setup() {
      renderer.setFog(blanket(bay.world));
      monster('bluster', (t) => ({ x: cx, y: cy + Math.sin(t * 1.3) * 0.4, z: cz, yaw: 0.4 + Math.sin(t * 0.8) * 0.3, state: Math.floor(t / 1.6) % 2 ? 'puff' : 'giggle', scale: 1.4 }));
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2;
        const out = 1.4 + i * 1.3;
        const l = skyLantern(0.9, (t) => t < out);
        prop(l, (t) => {
          l.userData.light(t);
          return { x: cx + Math.cos(a + t * 0.2) * 7, y: cy - 1 + Math.sin(t * 1.6 + i) * 0.5, z: cz + Math.sin(a + t * 0.2) * 7 };
        });
      }
    },
    fx(t) {
      for (let i = 0; i < 5; i++) {
        once(shots[1], `out${i}`, t, 1.4 + i * 1.3, () => {
          const a = (i / 5) * Math.PI * 2 + (1.4 + i * 1.3) * 0.2;
          for (let k = 0; k < 6; k++) renderer.effects.add('puff', cx + Math.cos(a) * 7, cy - 0.5, cz + Math.sin(a) * 7, { vy: 1, size: 0.6, life: 0.8, grow: 1.4, color: '#e6defa', delay: k * 0.03 });
        });
      }
    },
    camera: orbit([cx, cy - 1, cz], 17, 2, 0.3, 1.1, 8, 50),
  });
  overlays.push(caption(shots[1].start + 0.6, 7, 'But Baron Bluster, a puffed-up storm cloud in a top hat, blew out its five Sky Lanterns — and pulled his Cloud Blanket over the whole island!'));

  // 3. Under the clouds: the Big Bad of each corner, and its battles.
  for (const [i, ch] of TOON_CHAPTERS.slice(0, 4).entries()) {
    const m = isle(TOON_FROM + i);
    const hunt = m.battles.find((b) => b.kind === 'hunt');
    const [hx, hz] = hunt.range[4];
    const beast = ch.battles.find((b) => b.kind === 'hunt').beast;
    const a0 = 0.6 + i * 1.3;
    const shot = add({
      dur: 3,
      world: m,
      time: 0.38,
      cut: i === 0 ? 'flash' : 'cut',
      setup() {
        renderer.setFog(null);
        monster(beast, (t) => ({ x: hx, y: groundY(m.world, hx, hz), z: hz, yaw: a0 + Math.PI + Math.sin(t) * 0.3, state: t % 2.4 < 1.2 ? 'chase' : 'idle' }));
      },
      camera: (t) => orbit([hx, groundY(m.world, hx, hz) + 2, hz], 11, 2.5, a0, a0 + 0.45, 3, 48)(t),
    });
    overlays.push(nameCard(shot.start + 0.15, 2.7, `${ch.icon} ${ch.name}`, ch.battles.map((b) => `${BATTLE_ICONS[b.kind]} ${b.name}`).join(' · ')));
  }

  // 4. Thunder Top: the Baron over his arena, lightning all round.
  const arena = top.battles.find((b) => b.kind === 'showdown');
  add({
    dur: 6,
    world: top,
    time: 0.4,
    weather: 'cloudy',
    cut: 'flash',
    setup() {
      renderer.setFog(null);
      monster('bluster', (t) => ({ x: arena.x + Math.sin(t * 0.5) * 3, y: arena.y + 8 + Math.sin(t * 1.3) * 0.4, z: arena.z + Math.cos(t * 0.5) * 3, yaw: 2.6, state: t % 2 < 1 ? 'hurl' : 'giggle' }));
    },
    fx(t) {
      for (const k of [1.2, 3, 4.6]) once(shots.at(-1), `bolt${k}`, t, k, () => strike(top.world, arena.x + Math.sin(k * 3) * 9, arena.z + Math.cos(k * 3) * 9, [arena.x + 18, 0, arena.z + 22]));
    },
    camera: keys([
      { t: 0, pos: [arena.x + 16, arena.y + 4, arena.z + 22], look: [arena.x, arena.y + 6, arena.z], fov: 50 },
      { t: 6, pos: [arena.x + 10, arena.y + 3, arena.z + 15], look: [arena.x, arena.y + 7, arena.z], fov: 48 },
    ]),
  });
  overlays.push(caption(shots.at(-1).start + 0.5, 5.2, 'He waits on Thunder Top — and his Storm Gang is everywhere under the clouds: roaming in gangs, springing traps, storming beacons, hatching out of nests!'));

  // 5. The heroes on the beach of Lollipop Bay, the clouds rolling back as
  // they go; and the title.
  const fog = blanket(bay.world, [[sp.x, sp.z, 22]]);
  const way = bay.roads[0];
  const walkAt = (t, lag) => {
    const s = Math.max(0, t * 2.6 - lag);
    let i = 0;
    let left = s;
    while (i < way.length - 2 && left > Math.hypot(way[i + 1][0] - way[i][0], way[i + 1][1] - way[i][1])) {
      left -= Math.hypot(way[i + 1][0] - way[i][0], way[i + 1][1] - way[i][1]);
      i++;
    }
    const [ax, az] = way[i];
    const [bx, bz] = way[i + 1];
    const d = Math.hypot(bx - ax, bz - az) || 1;
    const k = Math.min(1, left / d);
    return { x: ax + (bx - ax) * k, z: az + (bz - az) * k, yaw: Math.atan2(bx - ax, bz - az) };
  };
  add({
    dur: 10,
    world: bay,
    time: 0.3,
    cut: 'white',
    out: 'fade',
    setup() {
      renderer.setFog(fog);
      for (const [i, look] of KIDS.entries()) {
        kid(look, (t) => {
          const p = walkAt(t, i * 1.6);
          const x = p.x + (i - 1) * 1.2;
          return { x, y: groundY(bay.world, x, p.z), z: p.z, yaw: p.yaw, anim: t > 0.3 ? ANIM.walk : ANIM.idle, speed: 2.6, emote: t > 7.5 ? 'cheer' : undefined };
        });
      }
      prop(skyLantern(1, () => false), () => ({ x: lantern[0] + 0.5, y: lantern[1] + 2.6, z: lantern[2] + 0.5 }));
    },
    fx(t) {
      const lead = walkAt(t, 0);
      const fresh = unveil(fog, lead.x, lead.z, 22);
      if (fresh.length) renderer.fogChanged(fog, fresh);
    },
    camera: keys([
      { t: 0, pos: [sp.x + 9, sp.y + 4, sp.z + 12], look: [sp.x, sp.y + 1.5, sp.z - 4], fov: 50 },
      { t: 10, pos: [sp.x + 16, sp.y + 22, sp.z + 26], look: [sp.x - 4, sp.y + 2, sp.z - 40], fov: 56 },
    ]),
  });
  const last = shots.at(-1).start;
  overlays.push(caption(last + 0.5, 4.2, 'Wherever you go, the clouds roll back — for everyone. Find every battle, win them all, and light the Sky Lanterns again!'));
  overlays.push(titleCard(last + 5, 4.6, 'Toon Isle', 'Episode 5 · Light all five Sky Lanterns — together!', { size: 84 }));
  return { shots, overlays, poster: last + 7 };
}

// ------------------------------------------------------------ the ending, episode 5

// Its ending: Baron Bluster popped on his arena, whizzing round and round
// and shrinking to a little white cloud; the five Sky Lanterns floating up
// together; the Cloud Blanket blowing away off Lollipop Bay; everyone on the
// beach under the lanterns, with fireworks; the credits; and the little cloud
// watering the toadstools, politely.
function ending5() {
  const top = isle(TOON_FROM + 4);
  const bay = isle(TOON_FROM);
  const woods = isle(TOON_FROM + 1);
  const arena = top.battles.find((b) => b.kind === 'showdown');
  const lantern = bay.hub.lantern;
  const sp = bay.world.spawn;
  const shots = [];
  const overlays = [];
  let at = 0;
  const add = (shot) => {
    shot.start = at;
    shots.push(shot);
    at += shot.dur;
    return shot;
  };

  // 1. Pop! The Baron whizzes round and round over his arena, shrinking.
  add({
    dur: 7,
    world: top,
    time: 0.42,
    cut: 'fade',
    setup() {
      renderer.setFog(null);
      monster('bluster', (t) => {
        const k = ease(Math.min(1, t / 5));
        const a = t * (3 + t * 1.2);
        const r = t < 1.2 ? 0 : 6 * Math.sin(Math.min(1, (t - 1.2) / 4.5) * Math.PI);
        return { x: arena.x + Math.cos(a) * r, y: arena.y + 3 + k * 5, z: arena.z + Math.sin(a) * r, yaw: a + Math.PI / 2, state: t < 1.2 ? 'dazed' : 'giggle', scale: 1 - 0.72 * k };
      });
      for (const [i, look] of KIDS.entries()) {
        const x = arena.x + 7 + i * 1.6;
        const z = arena.z + 6 - i;
        kid(look, (t) => ({ x, y: groundY(top.world, x, z), z, yaw: Math.atan2(arena.x - x, arena.z - z), emote: t > 1.4 ? 'cheer' : 'surprise', anim: ANIM.idle }));
      }
    },
    fx(t) {
      once(shots[0], 'pop', t, 1, () => {
        renderer.effects.confetti(arena.x, arena.y + 4, arena.z, 160, 1.6);
        renderer.effects.sparkles(arena.x, arena.y + 4, arena.z, 60, ['#ffffff', '#e6defa', '#fff3a0']);
      });
    },
    camera: keys([
      { t: 0, pos: [arena.x + 14, arena.y + 4, arena.z + 14], look: [arena.x, arena.y + 3, arena.z], fov: 50 },
      { t: 7, pos: [arena.x + 18, arena.y + 6, arena.z + 18], look: [arena.x, arena.y + 7, arena.z], fov: 54 },
    ]),
  });
  overlays.push(caption(0.8, 6, 'Baron Bluster is popped, top hat and all! He goes off like a burst balloon, whizzing round and round, shrinking as he goes…'));

  // 2. The five Sky Lanterns float up together.
  add({
    dur: 7,
    world: top,
    time: 0.74,
    cut: 'cut',
    setup() {
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2;
        const l = skyLantern(1, () => true);
        prop(l, (t) => ({ x: arena.x + Math.cos(a + t * 0.15) * (3 + t * 0.8), y: arena.y + 2 + t * 2.4 + Math.sin(t * 2 + i) * 0.3, z: arena.z + Math.sin(a + t * 0.15) * (3 + t * 0.8), rz: Math.sin(t * 1.5 + i) * 0.1 }));
      }
    },
    fx() {
      if (Math.random() < 0.3) renderer.effects.sparkles(arena.x + (Math.random() - 0.5) * 10, arena.y + 6 + Math.random() * 10, arena.z + (Math.random() - 0.5) * 10, 4, ['#fff3a0', '#ffd84d', '#ffffff']);
    },
    camera: keys([
      { t: 0, pos: [arena.x + 16, arena.y + 2, arena.z + 16], look: [arena.x, arena.y + 4, arena.z], fov: 52 },
      { t: 7, pos: [arena.x + 20, arena.y + 4, arena.z + 22], look: [arena.x, arena.y + 16, arena.z], fov: 56 },
    ]),
  });
  overlays.push(caption(shots[1].start + 0.5, 6, 'All five Sky Lanterns float up together, brighter than ever…'));

  // 3. …and the Cloud Blanket blows away, from the middle out.
  const fog = blanket(bay.world, [[sp.x, sp.z, 30]]);
  add({
    dur: 8,
    world: bay,
    time: 0.36,
    cut: 'flash',
    setup() {
      renderer.setFog(fog);
    },
    fx(t) {
      const fresh = unveil(fog, 128, 124, Math.max(0, (t - 0.6) * 26));
      if (fresh.length) renderer.fogChanged(fog, fresh);
    },
    camera: keys([
      { t: 0, pos: [128 + 60, SEA + 70, 124 + 120], look: [128, SEA + 6, 118], fov: 54 },
      { t: 8, pos: [128 + 80, SEA + 90, 124 + 140], look: [128, SEA + 4, 112], fov: 56 },
    ]),
  });
  overlays.push(caption(shots[2].start + 0.6, 7, 'And the Cloud Blanket blows away for good: Toon Isle shines in the sun from end to end, brighter than any cartoon!'));

  // 4. Everyone on the beach of Lollipop Bay, the Sky Lantern lit, fireworks.
  add({
    dur: 8,
    world: bay,
    time: 0.3,
    cut: 'fade',
    setup() {
      renderer.setFog(null);
      prop(skyLantern(1, () => true), (t) => ({ x: lantern[0] + 0.5, y: lantern[1] + 2.6 + Math.sin(t * 2) * 0.1, z: lantern[2] + 0.5 }));
      for (const [i, look] of KIDS.entries()) {
        const x = lantern[0] + 4 + i * 1.6;
        const z = lantern[2] + 5 - i * 0.6;
        kid(look, (t) => ({ x, y: groundY(bay.world, x, z), z, yaw: Math.PI + 0.5, emote: (t + i) % 3 < 1.5 ? 'cheer' : 'wave', anim: ANIM.idle }));
      }
      for (let i = 0; i < 3; i++) {
        const x = lantern[0] - 4 - i * 1.4;
        const z = lantern[2] + 4 + i;
        critter('bunny', (t) => ({ x: x + Math.sin(t * 2 + i) * 0.4, y: groundY(bay.world, x, z), z, yaw: 0.5 * i, state: 'hop', moving: true }));
      }
    },
    fx(t) {
      if (Math.random() < 0.09) renderer.effects.firework(lantern[0] - 20 + Math.random() * 40, lantern[1] + 18 + Math.random() * 10, lantern[2] - 30 + Math.random() * 30);
      if (t < 0.1) renderer.effects.confetti(lantern[0] + 3, lantern[1] + 4, lantern[2] + 3, 160, 1.5);
    },
    camera: keys([
      { t: 0, pos: [lantern[0] + 10, lantern[1] + 2.5, lantern[2] + 16], look: [lantern[0] + 1, lantern[1] + 2.5, lantern[2]], fov: 54 },
      { t: 8, pos: [lantern[0] + 14, lantern[1] + 6, lantern[2] + 22], look: [lantern[0], lantern[1] + 6, lantern[2]], fov: 58 },
    ]),
  });
  overlays.push(caption(shots[3].start + 0.5, 7.2, 'The Sky Lanterns shine over Toon Isle again. Thank you, heroes!'));

  // 5. The credits, over the island at sunset.
  add({
    dur: 14,
    world: bay,
    time: 0.71,
    cut: 'fade',
    fx() {
      if (Math.random() < 0.03) renderer.effects.firework(100 + Math.random() * 60, SEA + 30 + Math.random() * 10, 100 + Math.random() * 40);
    },
    camera: orbit([128, SEA + 6, 124], 120, 60, 0.6, -0.2, 14, 50),
  });
  const cast = TOON_CHAPTERS.flatMap((ch) => ch.battles.filter((b) => b.kind === 'hunt').map((b) => `🐾 ${b.who}`));
  overlays.push(roll(shots.at(-1).start + 0.3, 13.5, ['#Toon Isle', 'Episode 5', '', '#Starring', 'You and your friends', '', '#and', '🎩 Baron Bluster', ...cast, '🥚 the Storm Nests', '', '#The five Sky Lanterns', ...TOON_CHAPTERS.map((ch) => ch.icon + ' ' + ch.name), '', '#Made in Kids World', 'Thank you for playing!']));

  // 6. The little cloud, watering the toadstools. Politely.
  const shroomAt = (() => {
    const { world } = woods;
    for (let x = 60; x < 200; x++) for (let z = 60; z < 200; z++) for (let y = world.H - 2; y > SEA; y--) if (world.get(x, y, z) === B.TOON_SHROOM) return [x + 0.5, y, z + 0.5];
    return [128, SEA + 4, 128];
  })();
  add({
    dur: 7,
    world: woods,
    time: 0.3,
    cut: 'fade',
    out: 'fade',
    setup() {
      renderer.setFog(null);
      monster('bluster', (t) => ({ x: shroomAt[0] + Math.sin(t * 0.6) * 0.6, y: shroomAt[1] + 6.5 + Math.sin(t * 1.4) * 0.2, z: shroomAt[2], yaw: 1.2, state: 'idle', scale: 0.32 }));
    },
    fx() {
      if (Math.random() < 0.6) renderer.effects.add('drop', shroomAt[0] + (Math.random() - 0.5) * 1.2, shroomAt[1] + 6, shroomAt[2] + (Math.random() - 0.5) * 1.2, { vy: -6, size: 0.12, life: 0.7, color: '#8fc9ff' });
    },
    camera: keys([
      { t: 0, pos: [shroomAt[0] + 8, shroomAt[1] + 4, shroomAt[2] + 6], look: [shroomAt[0], shroomAt[1] + 4, shroomAt[2]], fov: 46 },
      { t: 7, pos: [shroomAt[0] + 6, shroomAt[1] + 4.5, shroomAt[2] + 5], look: [shroomAt[0], shroomAt[1] + 4.5, shroomAt[2]], fov: 44 },
    ]),
  });
  const teaser = shots.at(-1).start;
  overlays.push(caption(teaser + 0.4, 4, 'And the Baron? He is a little white cloud now, and every morning he waters the toadstools. Politely.'));
  overlays.push(titleCard(teaser + 4.4, 2.6, 'A new journey begins!', 'Come back to Adventure Isle!', { size: 70 }));
  return { shots, overlays, poster: shots[3].start + 5 };
}

export const films = { intro, ending, intro2, ending2, intro3, ending3, intro4, ending4, intro5, ending5 };
