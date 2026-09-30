// Every kind of block in the world, as data. The id is what the world stores
// (one byte per cell); everything else — how it looks, sounds, collides and
// lights up — hangs off the definition.
//
// kinds:
//   solid  an opaque cube you can stand on
//   glass  a see-through cube you can stand on
//   water  see-through, and you swim in it
//   plant  drawn as crossed pictures, stands on a solid block
//   item   a little collectable (fruit, shells, star pieces), drawn facing you

export const AIR = 0;

const defs = [];
const byKey = {};

function def(id, key, props) {
  const d = {
    id,
    key,
    name: key,
    kind: 'solid',
    category: null,
    color: '#ffffff',
    tiles: null,
    studs: false,
    light: 0,
    sound: 'brick',
    under: 0,
    unbreakable: false,
    grows: null,
    collect: null,
    ...props,
  };
  if (typeof d.tiles === 'string') d.tiles = { top: d.tiles, side: d.tiles, bottom: d.tiles };
  else if (d.tiles) d.tiles = { top: d.tiles.top, side: d.tiles.side ?? d.tiles.top, bottom: d.tiles.bottom ?? d.tiles.top };
  d.solid = d.kind === 'solid' || d.kind === 'glass';
  d.opaque = d.kind === 'solid';
  d.cube = d.kind === 'solid' || d.kind === 'glass' || d.kind === 'water';
  defs[id] = d;
  byKey[key] = d;
  return id;
}

def(0, 'air', { kind: 'air', name: 'Air', sound: 'soft' });
export const MAGIC_FLOOR = def(1, 'magic-floor', { name: 'Magic Floor', tiles: 'magic', unbreakable: true, sound: 'stone' });

// ---------------------------------------------------------------- nature
export const GRASS = def(2, 'grass', { name: 'Grass', category: 'nature', tiles: { top: 'grass-top', side: 'grass-side', bottom: 'dirt' }, studs: true, sound: 'grass', under: 3 });
export const DIRT = def(3, 'dirt', { name: 'Dirt', category: 'nature', tiles: 'dirt', studs: true, sound: 'dirt' });
export const SAND = def(4, 'sand', { name: 'Sand', category: 'nature', tiles: 'sand', studs: true, sound: 'sand' });
export const STONE = def(5, 'stone', { name: 'Stone', category: 'nature', tiles: 'stone', studs: true, sound: 'stone' });
export const SNOW = def(6, 'snow', { name: 'Snow', category: 'nature', tiles: { top: 'snow', side: 'snow-side', bottom: 'dirt' }, studs: true, sound: 'snow', under: 3 });
export const WOOD = def(7, 'wood', { name: 'Tree Trunk', category: 'nature', tiles: { top: 'wood-top', side: 'wood-side' }, sound: 'wood' });
export const LEAVES = def(8, 'leaves', { name: 'Leaves', category: 'nature', tiles: 'leaves', sound: 'leaves' });
export const PINE_LEAVES = def(9, 'pine-leaves', { name: 'Pine Leaves', category: 'nature', tiles: 'pine-leaves', sound: 'leaves' });
export const WATER = def(10, 'water', { name: 'Water', kind: 'water', category: 'nature', tiles: 'water', sound: 'water' });
export const ICE = def(11, 'ice', { name: 'Ice', category: 'nature', tiles: 'ice', sound: 'glass' });
export const CLOUD = def(18, 'cloud', { name: 'Cloud', category: 'nature', tiles: 'cloud', sound: 'soft' });
export const SNOWY_LEAVES = def(24, 'snowy-leaves', { name: 'Snowy Leaves', category: 'nature', tiles: { top: 'snow', side: 'snowy-leaves', bottom: 'pine-leaves' }, sound: 'snow' });

// ---------------------------------------------------------------- building
export const PLANKS = def(12, 'planks', { name: 'Planks', category: 'building', tiles: 'planks', studs: true, sound: 'wood' });
export const PEBBLES = def(13, 'pebbles', { name: 'Pebbles', category: 'building', tiles: 'pebbles', studs: true, sound: 'stone' });
export const BRICK_WALL = def(14, 'brick-wall', { name: 'Brick Wall', category: 'building', tiles: 'brick-wall', studs: true, sound: 'stone' });
export const GLASS = def(15, 'glass', { name: 'Window Glass', kind: 'glass', category: 'building', tiles: 'glass', sound: 'glass' });
export const LAMP = def(16, 'lamp', { name: 'Lamp', category: 'building', tiles: 'lamp', light: 15, sound: 'glass' });
export const STAR_BLOCK = def(17, 'star-block', { name: 'Star Block', category: 'building', tiles: 'star-block', light: 13, sound: 'glass' });
export const HAY = def(26, 'hay', { name: 'Hay Bale', category: 'building', tiles: { top: 'hay-top', side: 'hay-side' }, sound: 'grass' });

// ---------------------------------------------------------------- candy
export const FROSTING = def(19, 'frosting', { name: 'Frosting', category: 'candy', tiles: { top: 'frosting', side: 'frosting-side', bottom: 'cookie' }, studs: true, sound: 'candy', under: 20 });
export const COOKIE = def(20, 'cookie', { name: 'Cookie', category: 'candy', tiles: 'cookie', studs: true, sound: 'candy' });
export const CANDY_CANE = def(21, 'candy-cane', { name: 'Candy Cane', category: 'candy', tiles: 'candy-cane', studs: true, sound: 'candy' });
export const CHOCOLATE = def(22, 'chocolate', { name: 'Chocolate', category: 'candy', tiles: 'chocolate', studs: true, sound: 'candy' });
export const GUMMY = def(23, 'gummy', { name: 'Gummy', category: 'candy', tiles: 'gummy', sound: 'candy' });
export const COTTON_CANDY = def(25, 'cotton-candy', { name: 'Cotton Candy', category: 'candy', tiles: 'cotton-candy', sound: 'soft' });

// ---------------------------------------------------------------- toy bricks
export const BRICK_COLORS = [
  ['red', 'Red', '#e8453c'],
  ['orange', 'Orange', '#f59331'],
  ['yellow', 'Yellow', '#fcd535'],
  ['lime', 'Lime', '#9bd44a'],
  ['green', 'Green', '#35a852'],
  ['teal', 'Teal', '#2fc1b3'],
  ['sky', 'Sky Blue', '#62c4f5'],
  ['blue', 'Blue', '#3a73d8'],
  ['purple', 'Purple', '#8c5bd6'],
  ['lavender', 'Lavender', '#c3a9f2'],
  ['pink', 'Pink', '#f47fb8'],
  ['white', 'White', '#f7f5ef'],
  ['gray', 'Gray', '#a3a7ad'],
  ['charcoal', 'Charcoal', '#4a4e57'],
  ['brown', 'Brown', '#8b5a3c'],
  ['tan', 'Tan', '#e2c393'],
];
export const TOY_BRICKS = BRICK_COLORS.map(([key, name, color], i) =>
  def(30 + i, `brick-${key}`, { name: `${name} Brick`, category: 'bricks', color, tiles: 'toy', studs: true, sound: 'brick' }),
);

// ---------------------------------------------------------------- plants
export const TULIP = def(50, 'tulip', { name: 'Tulip', kind: 'plant', category: 'plants', tiles: 'tulip', sound: 'plant' });
export const DAISY = def(51, 'daisy', { name: 'Daisy', kind: 'plant', category: 'plants', tiles: 'daisy', sound: 'plant' });
export const BLUEBELL = def(52, 'bluebell', { name: 'Bluebell', kind: 'plant', category: 'plants', tiles: 'bluebell', sound: 'plant' });
export const COSMOS = def(53, 'cosmos', { name: 'Pink Flower', kind: 'plant', category: 'plants', tiles: 'cosmos', sound: 'plant' });
export const SUNFLOWER = def(54, 'sunflower', { name: 'Sunflower', kind: 'plant', category: 'plants', tiles: 'sunflower', sound: 'plant' });
export const TALL_GRASS = def(55, 'tall-grass', { name: 'Tall Grass', kind: 'plant', category: 'plants', tiles: 'tall-grass', sound: 'plant' });
export const MUSHROOM = def(56, 'mushroom', { name: 'Mushroom', kind: 'plant', category: 'plants', tiles: 'mushroom', sound: 'plant' });
export const OAK_SPROUT = def(57, 'oak-sprout', { name: 'Tree Sprout', kind: 'plant', category: 'plants', tiles: 'sprout', grows: 'oak', sound: 'plant' });
export const PINE_SPROUT = def(58, 'pine-sprout', { name: 'Pine Sprout', kind: 'plant', category: 'plants', tiles: 'pine-sprout', grows: 'pine', sound: 'plant' });
export const GUMDROP = def(64, 'gumdrop', { name: 'Gumdrop', kind: 'plant', category: 'plants', tiles: 'gumdrop', sound: 'candy' });
export const LOLLIPOP = def(65, 'lollipop', { name: 'Lollipop', kind: 'plant', category: 'plants', tiles: 'lollipop', sound: 'candy' });
export const CANDY_SPROUT = def(66, 'candy-sprout', { name: 'Candy Sprout', kind: 'plant', category: 'plants', tiles: 'candy-sprout', grows: 'candy', sound: 'candy' });

// ---------------------------------------------------------------- fruit, shells and stars
// Fruit hangs on fruit trees. Picked fruit goes in your basket; planting one
// grows a tree of that fruit, like the sprouts above.
export const FRUITS = [
  ['apple', 'Apple', 'Apples'],
  ['orange', 'Orange', 'Oranges'],
  ['peach', 'Peach', 'Peaches'],
  ['pear', 'Pear', 'Pears'],
  ['cherry', 'Cherries', 'Cherries'],
];
export const FRUIT_ITEMS = FRUITS.map(([key, name], i) => def(70 + i, key, { name, kind: 'item', tiles: key, collect: key, sound: 'plant' }));
export const FRUIT_SPROUTS = FRUITS.map(([key, name], i) =>
  def(59 + i, `${key}-sprout`, { name: `${name.replace(/ies$/, 'y')} Sprout`, kind: 'plant', tiles: 'sprout', grows: `fruit-${key}`, sound: 'plant' }),
);
export const SHELL = def(75, 'shell', { name: 'Seashell', kind: 'item', tiles: 'shell', collect: 'shell', sound: 'plant' });
export const STAR_PIECE = def(76, 'star-piece', { name: 'Star Piece', kind: 'item', tiles: 'star-piece', collect: 'star', light: 10, sound: 'glass' });

// Things that go in the basket, in the order the basket shows them.
export const COLLECTABLES = [
  ...FRUITS.map(([key, name, plural]) => ({ key, name, plural, item: byKey[key].id, sprout: byKey[`${key}-sprout`].id })),
  { key: 'shell', name: 'Seashell', plural: 'Seashells', item: SHELL, sprout: 0 },
  { key: 'star', name: 'Star Piece', plural: 'Star Pieces', item: STAR_PIECE, sprout: 0 },
];

export const BLOCKS = defs;
export const blockByKey = (key) => byKey[key] ?? null;
export const block = (id) => defs[id] ?? defs[0];
export const isKnown = (id) => Number.isInteger(id) && id >= 0 && id < 256 && defs[id] !== undefined;

// Lookup tables, so hot loops (meshing, physics, light) avoid property access.
export const SOLID = new Uint8Array(256);
export const OPAQUE = new Uint8Array(256);
export const EMIT = new Uint8Array(256);
export const KIND = new Uint8Array(256); // 0 air, 1 solid, 2 glass, 3 water, 4 plant, 5 item
const KIND_CODE = { air: 0, solid: 1, glass: 2, water: 3, plant: 4, item: 5 };
for (const d of defs) {
  if (!d) continue;
  SOLID[d.id] = d.solid ? 1 : 0;
  OPAQUE[d.id] = d.opaque ? 1 : 0;
  EMIT[d.id] = d.light;
  KIND[d.id] = KIND_CODE[d.kind];
}
// Natural ground, which the hills tool shapes.
export const TERRAIN = new Uint8Array(256);
for (const id of [2, 3, 4, 5, 6, 11, 13, 19, 20, 21, 22, 25]) TERRAIN[id] = 1;
// What fruit can hang from.
export const TREE_PART = new Uint8Array(256);
for (const id of [7, 8, 9, 24, 25]) TREE_PART[id] = 1;

export const K_AIR = 0;
export const K_SOLID = 1;
export const K_GLASS = 2;
export const K_WATER = 3;
export const K_PLANT = 4;
export const K_ITEM = 5;

export const isSolid = (id) => SOLID[id] === 1;
export const isWater = (id) => id === WATER;
// Cells a build can go into: empty space, water, and the little things that
// get pushed aside (flowers, grass).
export const isReplaceable = (id) => id === AIR || id === WATER || KIND[id] === K_PLANT;

// What lies under the top block of a column, for the hills tool.
export const underOf = (id) => defs[id]?.under || id;

// The toy box: what can be picked and placed freely, by tab.
export const CATEGORIES = [
  { key: 'bricks', name: 'Toy Bricks', icon: '🧱' },
  { key: 'nature', name: 'Nature', icon: '🌳' },
  { key: 'building', name: 'Building', icon: '🏠' },
  { key: 'candy', name: 'Candy', icon: '🍭' },
  { key: 'plants', name: 'Plants', icon: '🌷' },
];
export const blocksIn = (category) => defs.filter((d) => d && d.category === category).map((d) => d.id);

export const SAPLING_FOR = Object.fromEntries(COLLECTABLES.filter((c) => c.sprout).map((c) => [c.key, c.sprout]));
