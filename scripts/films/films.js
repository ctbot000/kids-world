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
//   say it looks rather nice.
import { BOSSES } from '/js/shared/bosses.js';
import { CHAPTERS, RAINBOW } from '/js/shared/isle-story.js';
import { ANIM, B, caption, critter, isle, kid, monster, nameCard, prop, renderer, roll, star, THREE, titleCard } from './stage.js';

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
  overlays.push(titleCard(teaser + 4.5, 3, 'A new journey begins!', 'Come back to Adventure Isle!', { size: 70 }));
  return { shots, overlays, poster: shots[1].start + 7.2 };
}

export const films = { intro, ending, intro2, ending2 };
