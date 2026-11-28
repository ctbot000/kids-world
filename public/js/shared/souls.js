// The soul weapons of Adventure Isle: seven weapons no shop sells, one for each
// episode of the isle's story (isle-story.js), each with a soul of its own.
//
// A soul weapon lies in pieces, all of them different, in the golden chests of
// its episode's stages (treasure.js): a golden chest holds one for whoever opens
// it — any of them, so now and then one they have already — but only the first
// golden chest they open on each island (a stage of one game), so it takes going
// through the episode more than once to find them all (drawPart). Very rarely a
// wooden chest holds one too, over and above (woodPartRoll). With every part
// found, the Soul Forge puts them together (ui-souls.js) — and then its soul wakes,
// which must be beaten, alone, on a little world of its own (nod/duel.js), before
// the weapon is yours (won). It never wears out.
//
// Two soul weapons that are yours can be combined at the forge into one of both
// souls, mightier than either (fuse) — and that with a third, and so on until all
// seven are one. It keeps the form of the first and strikes with every soul in it.
// Nothing is lost by it: any can be taken apart again (split).
//
// What someone has of all this is in the isle's own gear of theirs (shop.js
// cleanGear, gear.souls): see emptySouls.
import { episodeOf, stagesOf } from './isle-story.js';

// What is in hand is said in a look by its key (look.weapon): this, and the
// souls in it, its form's first.
export const SOUL_KEY = 'soul:';

// How many of one part anyone keeps, and what one to spare melts down for.
export const PART_MAX = 99;
export const MELT_COINS = 60;
// A part they have already comes at most this many times running while there is
// still one they lack: the next is one of those.
const UNLUCKY = 4;
// How many of the islands where they found a weapon's parts are remembered (the
// last ones: each gives only one).
const GOT_MAX = 60;

// The weapons, in the order of their episodes. key; episode; icon, name and what
// it is (title); form: how it is held and swung (render/avatar.js SWINGS); color
// and glow: what its light is like (render/soul-weapons.js); parts: what it is
// made of, each { icon, name }, in the order they are put together; soul: who
// is in it, { name, title, lines (what it says as it is fought, and as it gathers
// itself), yields (and when it is beaten) }; does: what a swing of it does. How it strikes:
// sweep, how much further than an arm it reaches in front of you, as far round as
// arc (the cosine of it); line, through everything in a line that far in front;
// round, all the way round you that far; chain, how many more it leaps on to;
// daze, how long (ms) whoever it bops sits dizzy, if not popped; end, a monster
// it leaves with no more hearts than one more blow would take is popped there and
// then (not a boss).
export const SOULS = [
  {
    key: 'star',
    episode: 1,
    icon: '🌠',
    name: 'Starfall',
    title: 'the Star Sword',
    form: 'starsword',
    color: '#ffd84d',
    glow: '#8fd8ff',
    parts: [
      { icon: '☄️', name: 'Comet Pommel' },
      { icon: '🌌', name: 'Midnight Grip' },
      { icon: '🕊️', name: 'Dawn Wing' },
      { icon: '🪽', name: 'Dusk Wing' },
      { icon: '⭐', name: 'Star Core' },
      { icon: '🌅', name: 'Sunrise Edge' },
      { icon: '🌃', name: 'Nightfall Edge' },
      { icon: '🧭', name: 'North Star Tip' },
    ],
    soul: { name: 'Astra', title: 'the Star Knight', lines: ['Who woke me? Then show me how bright you shine!', 'Brighter! Shine brighter!', 'Now — with every star there is!'], yields: 'You shine brighter than I do. My blade is yours.' },
    does: 'Every swing lets fly a great crescent of starlight, through everything in front of you.',
    sweep: 1.4,
    line: 6.6,
  },
  {
    key: 'rainbow',
    episode: 2,
    icon: '🌈',
    name: 'Prisma',
    title: 'the Rainbow Ring',
    form: 'ring',
    color: '#ff7ad9',
    glow: '#7affd0',
    parts: [
      { icon: '🌷', name: 'Red Tulip Arc' },
      { icon: '🍁', name: 'Orange Maple Arc' },
      { icon: '🍯', name: 'Yellow Honey Arc' },
      { icon: '🌴', name: 'Green Jungle Arc' },
      { icon: '🫧', name: 'Blue Lagoon Arc' },
      { icon: '🌜', name: 'Indigo Moonbeam Arc' },
      { icon: '🪻', name: 'Violet Vale Arc' },
    ],
    soul: { name: 'Iris', title: 'the Rainbow Serpent', lines: ['Nobody holds a rainbow. Catch me if you can!', 'Round and round — can you keep up?', 'All seven colours, all at once!'], yields: 'So somebody can catch a rainbow! Then I shall go round and round for you.' },
    does: 'Throw it: round it spins in every colour, out through them all and back to your hand.',
    sweep: 1.2,
    line: 5.8,
    wide: 1.1,
  },
  {
    key: 'wild',
    episode: 3,
    icon: '🪓',
    name: 'Wildheart',
    title: 'the Sunstone Axe',
    form: 'axe',
    color: '#7fd35a',
    glow: '#ffb547',
    parts: [
      { icon: '🪵', name: 'Driftwood Haft' },
      { icon: '🌿', name: 'Deepwood Vine' },
      { icon: '💧', name: 'Thunder Falls Blade' },
      { icon: '🏔️', name: 'Snowcap Blade' },
      { icon: '🦷', name: 'Murkfang Spike' },
      { icon: '☀️', name: 'Sunstone Heart' },
    ],
    soul: { name: 'Rowan', title: 'the Wild Wolf', lines: ['Run with me, little cub, if you dare!', 'Good. Now run for real!', 'AWOOOO! Show me your wild heart!'], yields: 'You run like one of the pack. Where you go, I go.' },
    does: 'A spirit wolf springs out of every blow, and on from one monster to the next.',
    sweep: 1.9,
    chain: 4,
  },
  {
    key: 'bells',
    episode: 4,
    icon: '🔔',
    name: 'Clarion',
    title: 'the Bell Hammer',
    form: 'hammer',
    color: '#ffc23d',
    glow: '#fff3b0',
    parts: [
      { icon: '🥢', name: 'Bellbuoy Handle' },
      { icon: '🪢', name: 'Henhouse Rope' },
      { icon: '👑', name: 'Topsy Crown' },
      { icon: '🔔', name: 'Great Golden Bell' },
      { icon: '🥁', name: 'Kite Cliffs Clapper' },
      { icon: '🪶', name: 'Magpie Plume' },
    ],
    soul: { name: 'Carillon', title: 'the Bell Giant', lines: ['DONG. WHO RINGS ME?', 'LOUDER. I CAN HARDLY HEAR YOU!', 'NOW: THE GREAT PEAL!'], yields: 'AT LAST, SOMEONE WHO CAN RING ME. RING AWAY!' },
    does: 'DONG! It rings out all round you, and whoever it does not pop sits dizzy from the din.',
    sweep: 1.4,
    round: 3.2,
    daze: 1700,
  },
  {
    key: 'toon',
    episode: 5,
    icon: '🖌️',
    name: 'Doodle',
    title: 'the Storm Brush',
    form: 'brush',
    color: '#ff5cb0',
    glow: '#3ad0ff',
    parts: [
      { icon: '🍭', name: 'Lollipop Handle' },
      { icon: '🍄', name: 'Toadstool Knob' },
      { icon: '⚙️', name: 'Rumble Ring' },
      { icon: '⛄', name: 'Snowball Gem' },
      { icon: '⚡', name: 'Thunder Bristles' },
      { icon: '🎨', name: 'Everycolour Ink' },
    ],
    soul: { name: 'Scrawl', title: 'the Living Doodle', lines: ['Ooh, a blank page! Let me draw on YOU!', 'Scribble-scrabble! More colours!', 'Out of the lines! Out of ALL the lines!'], yields: 'Oh, you draw better than me! Can I be your brush? Pleeease?' },
    does: 'Paints a huge wet stroke through the air, right across everything in front of you. SPLAT!',
    sweep: 4.2,
    arc: -0.45,
  },
  {
    key: 'nod',
    episode: 6,
    icon: '🌙',
    name: 'Lullaby',
    title: 'the Moon Scythe',
    form: 'scythe',
    color: '#b98cff',
    glow: '#e6e0ff',
    parts: [
      { icon: '🛏️', name: 'Pillow Pole' },
      { icon: '🎃', name: 'Pumpkin Lantern' },
      { icon: '🎼', name: 'Music Box Crank' },
      { icon: '🕰️', name: 'Clock Hand Spine' },
      { icon: '🌘', name: 'Dark Side Blade' },
      { icon: '💡', name: 'Night-light Gem' },
    ],
    soul: { name: 'Nocturne', title: 'the Moon Owl', lines: ['Hoo… who is still awake?', 'Hush. The night has only begun.', 'Then dream with your eyes wide open!'], yields: 'Hoo. Wide awake after all. Sleep well: I shall keep watch.' },
    does: 'A crescent moon sweeps right round you, and whoever it does not pop nods off to sleep.',
    sweep: 1.4,
    round: 3,
    daze: 2200,
  },
  {
    key: 'book',
    episode: 7,
    icon: '✒️',
    name: 'Fable',
    title: 'the Story Quill',
    form: 'quill',
    color: '#4f7dff',
    glow: '#ffe9b0',
    parts: [
      { icon: '🎀', name: 'Meadow Ribbon' },
      { icon: '📜', name: 'Harbor Map Grip' },
      { icon: '📖', name: 'Turret Storybook Guard' },
      { icon: '💧', name: 'Starry Ink Drop' },
      { icon: '🪶', name: 'Paper Dragon Plume' },
      { icon: '✒️', name: 'Inkwell Nib' },
    ],
    soul: { name: 'Folio', title: 'the Paper Phoenix', lines: ['Who opened my book? Then come — let us write a story!', 'Turn the page! This story is not over yet!', 'The last chapter now — with every word I know!'], yields: 'What a story you write! Let me be your quill, and we shall write the rest together.' },
    does: 'Every stroke writes in golden ink, and a monster it leaves nearly beaten gets THE END written on it, there and then!',
    sweep: 3,
    arc: -0.3,
    end: true,
  },
];

export const SOUL_KEYS = SOULS.map((w) => w.key);
export const soulOf = (key) => SOULS.find((w) => w.key === key) ?? null;
export const soulOfEpisode = (n) => SOULS.find((w) => w.episode === n) ?? null;
// What its soul is called on its own: "Astra, the Star Knight".
export const soulName = (w) => `${w.soul.name}, ${w.soul.title}`;

// ---------------------------------------------------------------- in hand

// The souls in a weapon, by its id ('star', or 'nod+star+wild': its form's soul
// first, the rest in the order of their episodes), or null for nonsense.
export function soulsIn(id) {
  if (typeof id !== 'string' || id.length > 60) return null;
  const list = id.split('+');
  if (!list.length || !list.every((k) => SOUL_KEYS.includes(k)) || new Set(list).size !== list.length) return null;
  const [form, ...rest] = list;
  return [form, ...SOUL_KEYS.filter((k) => rest.includes(k))];
}
export const idOf = (souls) => soulsIn(souls.join('+'))?.join('+') ?? '';

// What two weapons are called as one; with three souls or more it goes by how
// many, and with all seven it has a name of its own.
const PAIRS = {
  'star+rainbow': 'Starbow',
  'star+wild': 'Wildstar',
  'star+bells': 'Starchime',
  'star+toon': 'Starburst',
  'star+nod': 'Moonstar',
  'rainbow+wild': 'Wildbow',
  'rainbow+bells': 'Rainchime',
  'rainbow+toon': 'Technicolor',
  'rainbow+nod': 'Moonbow',
  'wild+bells': 'Wildchime',
  'wild+toon': 'Wildstroke',
  'wild+nod': 'Howlmoon',
  'bells+toon': 'Dingdoodle',
  'bells+nod': 'Nightchime',
  'toon+nod': 'Daydream',
  'star+book': 'Starquill',
  'rainbow+book': 'Rainquill',
  'wild+book': 'Wolftale',
  'bells+book': 'Chimetale',
  'toon+book': 'Inkdoodle',
  'nod+book': 'Bedtime Story',
};
export const EVERHEART = 'Everheart';
const HOW_MANY = { 3: 'Three-Soul', 4: 'Four-Soul', 5: 'Five-Soul', 6: 'Six-Soul' };

// Hearts off a monster with each blow, and how many times over a boss feels
// it, by how many souls are in it.
export const SOUL_POWER = [13, 16, 19, 22, 25, 30, 35];
export const SOUL_KING = [9, 10, 11, 12, 13, 15, 17];
// Each more soul in it carries every strike this much further, and leaps on to
// one monster more.
const FURTHER = 0.25;

const specs = new Map();

// A soul weapon as what is in hand (shop.js weaponOf), by its key in a look
// ('soul:star+wild'), or null: { key, id, souls, name, title, icon, does, power,
// king, push, reach, sweep, arc, line, wide, round, chain, daze, end }, reach
// being the furthest it strikes.
export function soulWeapon(key) {
  if (typeof key !== 'string' || !key.startsWith(SOUL_KEY)) return null;
  if (specs.has(key)) return specs.get(key);
  const souls = soulsIn(key.slice(SOUL_KEY.length));
  // (Said only the one way: the form's soul first, and the rest in order.)
  if (!souls || `${SOUL_KEY}${souls.join('+')}` !== key) return null;
  const spec = makeSpec(souls);
  specs.set(key, spec);
  return spec;
}

function makeSpec(souls) {
  const all = souls.map(soulOf);
  const [base] = all;
  const n = all.length;
  const sorted = SOUL_KEYS.filter((k) => souls.includes(k));
  const most = (what) => {
    const best = Math.max(0, ...all.map((w) => w[what] ?? 0));
    return best ? +(best + (n - 1) * FURTHER).toFixed(2) : 0;
  };
  const sweep = most('sweep');
  const line = most('line');
  const round = most('round');
  const chain = all.some((w) => w.chain) ? Math.max(...all.map((w) => w.chain ?? 0)) + n - 1 : 0;
  const daze = Math.max(0, ...all.map((w) => w.daze ?? 0));
  const name = n === 1 ? base.name : n === SOUL_KEYS.length ? EVERHEART : n === 2 ? PAIRS[sorted.join('+')] : `${HOW_MANY[n]} ${base.name}`;
  const title = n === 1 ? base.title : n === SOUL_KEYS.length ? 'all seven souls in one' : `${base.title} with the ${n === 2 ? 'soul' : 'souls'} of ${listed(all.slice(1).map((w) => w.name))}`;
  return Object.freeze({
    key: `${SOUL_KEY}${souls.join('+')}`,
    id: souls.join('+'),
    soul: true,
    souls: Object.freeze([...souls]),
    form: base.form,
    icon: base.icon,
    name,
    title,
    does: n === 1 ? base.does : `${base.does} And with it: ${all.slice(1).map((w) => SHORT[w.key]).join(', ')}.`,
    power: SOUL_POWER[n - 1],
    king: SOUL_KING[n - 1],
    push: 13,
    uses: Infinity,
    price: 0,
    reach: Math.max(sweep, line, round),
    sweep,
    arc: Math.min(...all.map((w) => w.arc ?? -0.17)),
    ...(line ? { line, wide: Math.max(0.8, ...all.map((w) => w.wide ?? 0)) } : {}),
    ...(round ? { round } : {}),
    ...(chain ? { chain } : {}),
    ...(daze ? { daze } : {}),
    ...(all.some((w) => w.end) ? { end: true } : {}),
  });
}

// What each soul adds to a weapon it is combined into, in a few words.
const SHORT = {
  star: 'a crescent of starlight',
  rainbow: 'a ring of every colour, out and back',
  wild: 'a spirit wolf leaping on from one to the next',
  bells: 'a din that leaves them dizzy',
  toon: 'a huge stroke of paint',
  nod: 'a moon that sends them to sleep',
  book: 'THE END for whatever it leaves nearly beaten',
};

// "a", "a and b", "a, b and c".
export const listed = (list) => (list.length < 2 ? (list[0] ?? '') : `${list.slice(0, -1).join(', ')} and ${list.at(-1)}`);

// ---------------------------------------------------------------- what you have

// What someone has of soul weapons: parts, how many of each part of each weapon
// (those they have any of); made, the weapons put together whose souls they have
// still to beat; held, the ones that are theirs, each by its id (its souls);
// pick, the one of those in their hand, or ''; dupes, how many parts running of
// each weapon they had already; got, the islands they found parts of each on
// (placeOf), the last ones.
export const emptySouls = () => ({ parts: {}, made: [], held: [], pick: '', dupes: {}, got: {} });

const isPlace = (p) => typeof p === 'string' && /^[a-z0-9/]{1,24}:w?\d{1,4}$/.test(p);

export function cleanSouls(raw) {
  const p = raw && typeof raw === 'object' ? raw : {};
  const out = emptySouls();
  for (const w of SOULS) {
    const list = Array.isArray(p.parts?.[w.key]) ? p.parts[w.key] : [];
    const counts = w.parts.map((_, i) => (Number.isInteger(list[i]) && list[i] > 0 ? Math.min(PART_MAX, list[i]) : 0));
    if (counts.some(Boolean)) out.parts[w.key] = counts;
    const n = p.dupes?.[w.key];
    if (Number.isInteger(n) && n > 0) out.dupes[w.key] = Math.min(UNLUCKY, n);
    const got = Array.isArray(p.got?.[w.key]) ? [...new Set(p.got[w.key].filter(isPlace))].slice(-GOT_MAX) : [];
    if (got.length) out.got[w.key] = got;
  }
  // (Each soul is only ever in one weapon.)
  const taken = new Set();
  for (const id of Array.isArray(p.held) ? p.held.slice(0, 12) : []) {
    const souls = soulsIn(id);
    if (!souls || souls.some((k) => taken.has(k))) continue;
    for (const k of souls) taken.add(k);
    out.held.push(souls.join('+'));
  }
  for (const key of Array.isArray(p.made) ? p.made : []) {
    if (!soulOf(key) || taken.has(key)) continue;
    taken.add(key);
    out.made.push(key);
  }
  out.pick = out.held.includes(p.pick) ? p.pick : '';
  return out;
}

// Two of these put together (a guest's and the player's they were: keeper.js
// addProgress): every part of both, and every weapon of either.
export function addSouls(mine, theirs) {
  const a = cleanSouls(mine);
  const b = cleanSouls(theirs);
  const out = cleanSouls(a);
  for (const w of SOULS) {
    const x = a.parts[w.key];
    const y = b.parts[w.key];
    if (x || y) out.parts[w.key] = w.parts.map((_, i) => Math.min(PART_MAX, (x?.[i] ?? 0) + (y?.[i] ?? 0)));
    const got = [...new Set([...(a.got[w.key] ?? []), ...(b.got[w.key] ?? [])])].slice(-GOT_MAX);
    if (got.length) out.got[w.key] = got;
  }
  for (const id of b.held) {
    const souls = soulsIn(id);
    const fresh = souls.filter((k) => !ownsSoul(out, k));
    if (!fresh.length) continue;
    out.made = out.made.filter((k) => !fresh.includes(k));
    if (fresh.length === souls.length) out.held.push(id);
    else out.held.push(...fresh);
  }
  for (const key of b.made) if (!ownsSoul(out, key) && !out.made.includes(key)) out.made.push(key);
  return cleanSouls(out);
}

// How many of each of a weapon's parts someone has.
export const partsOf = (souls, key) => souls?.parts?.[key] ?? soulOf(key)?.parts.map(() => 0) ?? [];
export const partsFound = (souls, key) => partsOf(souls, key).filter((n) => n > 0).length;
// Whether a weapon is theirs (its soul beaten), in one by itself or combined.
export const ownsSoul = (souls, key) => Boolean(souls?.held?.some((id) => soulsIn(id)?.includes(key)));
export const isMade = (souls, key) => Boolean(souls?.made?.includes(key));
// Whether any of its parts are still wanted: it is not put together yet.
export const wantsParts = (souls, key) => !ownsSoul(souls, key) && !isMade(souls, key);
// Whether anything at all has been found yet.
export const anySouls = (souls) => Boolean(souls && (souls.held.length || souls.made.length || Object.keys(souls.parts).length));
export const ownedCount = (souls) => (souls?.held ?? []).reduce((n, id) => n + (soulsIn(id)?.length ?? 0), 0);

// ------------------------------------------------ parts out of chests

// The island a golden chest is on, as it is remembered by: which of the isle's
// games it is (server/adventure.js: its run, or the island's code with none said)
// and journey, and which stage. Those of one game and journey have the same game.
export const placeOf = ({ run = 0, journey = 1, stage = 1, code = '' }) => `${run > 0 ? `${run}/${journey}` : `c${String(code).replace(/[^a-z0-9]/gi, '').toLowerCase().slice(0, 12)}`}:${stage}`;
const gameOf = (place) => place.slice(0, place.lastIndexOf(':'));

// A wooden chest holds a part too, very rarely: one in fifty (WOOD_PART_CHANCE),
// and only one of an island's — over and above the part in its golden chest,
// which still waits for them. Such a part is remembered by its island marked as a
// wooden chest's (woodOf: '2/1:w20'), of the same game. A test that needs to know
// sets globalThis.kidsWorldLuck to the chance it wants (0: never, 1: always), as
// for critical hits (crits.js).
export const WOOD_PART_CHANCE = 1 / 50;
export const woodOf = (place) => place.replace(/:(\d+)$/, ':w$1');
export function woodPartRoll(rand = Math.random) {
  const chance = typeof globalThis.kidsWorldLuck === 'number' ? globalThis.kidsWorldLuck : WOOD_PART_CHANCE;
  return rand() < chance;
}

// Whether the golden chests of an island hold a part for them still (one each
// island), of the weapon of its episode; or, by woodOf(place), its wooden ones.
export const partWaits = (souls, key, place) => Boolean(soulOf(key)) && !(souls?.got?.[key] ?? []).includes(place);

// The part a golden chest on an island (place) holds for someone — or one of its
// wooden chests, by woodOf(place) — of the weapon with this key, or null when it
// holds none for them (any more): { i (which part), fresh (one they had none of),
// spare (they have no need of it: the weapon is made already) }. Any of them is as
// likely as another — but they never get ones they have for ever (UNLUCKY), and
// the last they lack is never in the chests of the one game that had all the
// rest: an episode is always gone through twice.
export function drawPart(souls, key, place, rand = Math.random) {
  const w = soulOf(key);
  if (!w || !partWaits(souls, key, place)) return null;
  const have = partsOf(souls, key);
  const pick = (list) => list[Math.min(list.length - 1, Math.floor(rand() * list.length))];
  const all = w.parts.map((_, i) => i);
  if (!wantsParts(souls, key)) return { i: pick(all), fresh: false, spare: true };
  const lack = all.filter((i) => !have[i]);
  const owned = all.filter((i) => have[i]);
  if (!lack.length) return { i: pick(all), fresh: false, spare: false };
  const games = new Set([...(souls?.got?.[key] ?? []), place].map(gameOf));
  const lastOfAll = lack.length === 1 && games.size < 2;
  if (lastOfAll) return { i: pick(owned), fresh: false, spare: false };
  const i = (souls?.dupes?.[key] ?? 0) >= UNLUCKY ? pick(lack) : pick(all);
  return { i, fresh: !have[i], spare: false };
}

// That part theirs (souls is changed). Returns how many of it they have now.
export function takePart(souls, key, i, place) {
  const w = soulOf(key);
  if (!w?.parts[i]) return 0;
  const counts = [...partsOf(souls, key)];
  const fresh = !counts[i];
  counts[i] = Math.min(PART_MAX, counts[i] + 1);
  souls.parts[key] = counts;
  souls.got[key] = [...(souls.got[key] ?? []).filter((p) => p !== place), place].slice(-GOT_MAX);
  if (fresh || !wantsParts(souls, key)) delete souls.dupes[key];
  else souls.dupes[key] = Math.min(UNLUCKY, (souls.dupes[key] ?? 0) + 1);
  return counts[i];
}

// How many of a part they have to spare: all but the one the weapon still wants.
export const spareOf = (souls, key, i) => Math.max(0, partsOf(souls, key)[i] - (wantsParts(souls, key) ? 1 : 0));

// A part to spare melted down (souls is changed): whether it was.
export function meltPart(souls, key, i) {
  if (!spareOf(souls, key, i)) return false;
  const counts = [...partsOf(souls, key)];
  counts[i]--;
  if (counts.some(Boolean)) souls.parts[key] = counts;
  else delete souls.parts[key];
  return true;
}

// ---------------------------------------------------------------- the forge

// Every part of a weapon there, and it not put together yet.
export const canForge = (souls, key) => Boolean(soulOf(key)) && wantsParts(souls, key) && partsOf(souls, key).every((n) => n > 0);

// Put together (souls is changed), one of each of its parts used up: its soul is
// awake, and has still to be beaten. Whether it was.
export function forge(souls, key) {
  if (!canForge(souls, key)) return false;
  const counts = partsOf(souls, key).map((n) => n - 1);
  if (counts.some(Boolean)) souls.parts[key] = counts;
  else delete souls.parts[key];
  delete souls.dupes[key];
  souls.made.push(key);
  return true;
}

// Its soul beaten: theirs, and in their hand.
export function winSoul(souls, key) {
  if (!isMade(souls, key)) return false;
  souls.made = souls.made.filter((k) => k !== key);
  souls.held.push(key);
  souls.pick = key;
  return true;
}

// What two of theirs would be as one: its id, or '' when they cannot be combined.
// It keeps the form of the first.
export function fusionOf(souls, a, b) {
  if (a === b || !souls?.held?.includes(a) || !souls.held.includes(b)) return '';
  return idOf([...soulsIn(a), ...soulsIn(b)]);
}

// Combined (souls is changed), and in their hand: the new one's id, or ''.
export function fuse(souls, a, b) {
  const id = fusionOf(souls, a, b);
  if (!id) return '';
  const at = souls.held.indexOf(a);
  souls.held[at] = id;
  souls.held = souls.held.filter((h) => h !== b);
  souls.pick = id;
  return id;
}

// One of more souls than one taken apart again into those it was made of: their
// ids, or null when it cannot be.
export function split(souls, id) {
  const list = soulsIn(id);
  const at = souls?.held?.indexOf(id) ?? -1;
  if (!list || list.length < 2 || at < 0) return null;
  souls.held.splice(at, 1, ...list);
  if (souls.pick === id) [souls.pick] = list;
  return list;
}

// Which of theirs is in their hand: its spec, or null for none (or one put away).
export const pickedSoul = (souls) => (souls?.pick && souls.held.includes(souls.pick) ? soulWeapon(`${SOUL_KEY}${souls.pick}`) : null);

// Where a weapon's parts are found, in words.
export function whereFound(w) {
  const ep = episodeOf(w.episode);
  return `in the golden chests of Episode ${ep.n}, ${ep.title}: one on each of its ${stagesOf(ep.n)} stages, each time you go through it — and, very rarely, in a wooden chest too`;
}
