// Every kind of block in the world, as data. The id is what the world stores
// (one byte per cell); everything else — how it looks, sounds, collides and
// lights up — hangs off the definition.
//
// kinds:
//   solid  an opaque cube you can stand on
//   glass  a see-through cube you can stand on
//   water  see-through, and you swim in it
//   lava   see-through and glowing, swum in as water is — but it burns
//          (a volcano island's own, worldgen.js; shared/room.js)
//   plant  drawn as crossed pictures, stands on a solid block (crops stand
//          on farmland, and are drawn crossed in a #)
//   item   a little collectable (fruit, vegetables, shells, star pieces,
//          jewels), drawn facing you
//   furniture  a little model of boxes inside its cell (shared/furniture.js),
//          most of them turned to face whoever put them down
//   tree   a real tree, not made of blocks: its foot is the block a model of
//          it grows from (render/katsura.js, drawn by render/mesher.js), and
//          the cells of its trunk just above are solid but not drawn, to
//          bump into. It lets the light through.

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
  d.solid = d.kind === 'solid' || d.kind === 'glass' || d.kind === 'tree' || (d.kind === 'furniture' && d.solid !== false);
  d.opaque = d.kind === 'solid';
  d.cube = d.kind === 'solid' || d.kind === 'glass' || d.kind === 'water' || d.kind === 'lava';
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
// A katsura tree's (Cercidiphyllum): its little round heart-shaped leaves,
// turned for autumn — gold all over, apricot and red in patches where the
// sun reaches, still a little green underneath (`autumn`: the colours
// render/mesher.js gives each corner) — and its grey-brown shaggy bark,
// bark all round, as the trunks lean and climb in steps.
export const KATSURA_LEAVES = def(46, 'katsura-leaves', { name: 'Katsura Leaves', category: 'nature', after: 48, tiles: 'katsura-leaves', sound: 'leaves', autumn: true });
export const KATSURA_WOOD = def(48, 'katsura-wood', { name: 'Katsura Trunk', category: 'nature', after: 9, tiles: 'katsura-bark', sound: 'wood' });
// A real katsura tree: the foot it grows from, a giant's (the stamp's), and
// the inside of a real tree's trunk above its foot (see `tree` above). The
// tiles are only for the map and an icon: none of them is drawn as a block.
export const KATSURA_TREE = def(49, 'katsura-tree', { name: 'Katsura Tree', kind: 'tree', model: 'katsura', tiles: 'katsura-leaves', sound: 'wood' });
export const KATSURA_GIANT = def(67, 'katsura-giant', { name: 'Giant Katsura Tree', kind: 'tree', model: 'katsura', giant: true, tiles: 'katsura-leaves', sound: 'wood' });
export const TREE_CORE = def(68, 'tree-core', { name: 'Tree Trunk', kind: 'tree', tiles: 'katsura-bark', sound: 'wood' });
export const WATER = def(10, 'water', { name: 'Water', kind: 'water', category: 'nature', tiles: 'water', sound: 'water' });
export const ICE = def(11, 'ice', { name: 'Ice', category: 'nature', tiles: 'ice', sound: 'glass' });
// Volcano rock, dark and dusty: the ground of a volcano island
// (worldgen.js), in and round the mountain's crater.
export const BASALT = def(28, 'basalt', { name: 'Basalt', category: 'nature', tiles: 'basalt', studs: true, sound: 'stone', under: 5 });
// Molten rock. You can swim in it as in water (physics.js), but it burns
// hard (room.js, LAVA_HP in monsters.js): a volcano island's sea, lakes and
// crater are made of it, and it glows in the dark.
export const LAVA = def(29, 'lava', { name: 'Lava', kind: 'lava', category: 'nature', tiles: 'lava', light: 12, sound: 'water' });
export const CLOUD = def(18, 'cloud', { name: 'Cloud', category: 'nature', tiles: 'cloud', sound: 'soft' });
export const SNOWY_LEAVES = def(24, 'snowy-leaves', { name: 'Snowy Leaves', category: 'nature', tiles: { top: 'snow', side: 'snowy-leaves', bottom: 'pine-leaves' }, sound: 'snow' });
// The grumpy monsters' ground, round their camps on an adventure island
// (shared/adventure.js): dark and gloomy until the camp is freed, when it
// turns back into the island's own grass, snow or frosting. Natural ground,
// not something to build with.
export const GLOOM = def(27, 'gloom', { name: 'Gloomy Ground', tiles: { top: 'gloom-top', side: 'gloom-side', bottom: 'dirt' }, studs: true, sound: 'grass', under: 3 });

// ---------------------------------------------------------------- building
export const PLANKS = def(12, 'planks', { name: 'Planks', category: 'building', tiles: 'planks', studs: true, sound: 'wood' });
export const PEBBLES = def(13, 'pebbles', { name: 'Pebbles', category: 'building', tiles: 'pebbles', studs: true, sound: 'stone' });
export const BRICK_WALL = def(14, 'brick-wall', { name: 'Brick Wall', category: 'building', tiles: 'brick-wall', studs: true, sound: 'stone' });
export const GLASS = def(15, 'glass', { name: 'Window Glass', kind: 'glass', category: 'building', tiles: 'glass', sound: 'glass' });
export const LAMP = def(16, 'lamp', { name: 'Lamp', category: 'building', tiles: 'lamp', light: 15, sound: 'glass' });
export const STAR_BLOCK = def(17, 'star-block', { name: 'Star Block', category: 'building', tiles: 'star-block', light: 13, sound: 'glass' });
export const HAY = def(26, 'hay', { name: 'Hay Bale', category: 'building', tiles: { top: 'hay-top', side: 'hay-side' }, sound: 'grass' });
// An elevator pad: stand on it and jump to glide up to the next pad above in
// the same column, or go down to the one below (shared/elevator.js).
export const ELEVATOR = def(91, 'elevator', { name: 'Elevator', category: 'building', tiles: { top: 'elevator-top', side: 'elevator' }, sound: 'stone' });
// A trampoline: land on it and you bounce back up, higher and higher while
// jump is held (shared/physics.js).
export const TRAMPOLINE = def(92, 'trampoline', { name: 'Trampoline', category: 'building', tiles: { top: 'trampoline-top', side: 'trampoline' }, sound: 'soft' });
// Rails lie flat on the ground, like a plant growing on it, for a mine cart
// to roll along: straight, round a corner, or up a step to the next rail
// (render/mesher.js works out which from the rails beside it, and draws a
// corner with the side tile). Every mine has a line of them.
export const RAIL = def(90, 'rail', { name: 'Rails', kind: 'plant', category: 'building', tiles: { top: 'rail', side: 'rail-curve' }, sound: 'stone' });
// Tent cloth: soft, with no studs, in the bright colours of a circus. The
// huge tent stamps are made of it, and anywhere under it is in a tent
// (shared/tents.js).
export const CLOTH_COLORS = [
  ['red', 'Red', '#e8453c'],
  ['orange', 'Orange', '#f59331'],
  ['yellow', 'Yellow', '#fcd535'],
  ['green', 'Green', '#35a852'],
  ['blue', 'Blue', '#3a73d8'],
  ['purple', 'Purple', '#8c5bd6'],
  ['pink', 'Pink', '#f47fb8'],
  ['white', 'White', '#f7f5ef'],
];
export const CLOTHS = CLOTH_COLORS.map(([key, name, color], i) => def(93 + i, `cloth-${key}`, { name: `${name} Tent Cloth`, category: 'building', color, tiles: 'cloth', sound: 'cloth' }));

// ---------------------------------------------------------------- home
// For inside a house: floors and wallpaper (plain blocks), and furniture.
export const CARPET_COLORS = [
  ['red', 'Red', '#d9534f'],
  ['blue', 'Blue', '#5b8fd9'],
  ['pink', 'Pink', '#f29bc4'],
  ['green', 'Green', '#6cbf6a'],
];
export const CARPETS = CARPET_COLORS.map(([key, name, color], i) => def(144 + i, `carpet-${key}`, { name: `${name} Carpet`, category: 'home', color, tiles: 'carpet', sound: 'cloth' }));
export const PARQUET = def(148, 'parquet', { name: 'Wood Floor', category: 'home', tiles: 'parquet', sound: 'wood' });
export const CHECKER_FLOOR = def(149, 'checker-floor', { name: 'Checked Tiles', category: 'home', tiles: 'checker', sound: 'stone' });
export const WALLPAPERS = [
  ['stripes', 'Striped Wallpaper'],
  ['flowers', 'Flower Wallpaper'],
  ['dots', 'Dotty Wallpaper'],
  ['stars', 'Starry Wallpaper'],
].map(([key, name], i) => def(150 + i, `wallpaper-${key}`, { name, category: 'home', tiles: `wallpaper-${key}`, sound: 'wood' }));

// Furniture: a little model in its cell (shared/furniture.js draws it from
// `model`). One that turns is four blocks in a row, one per way its front
// can face (`front`, numbered as RAIL_DIRS: 0 +x, 1 +z, 2 -x, 3 -z); only
// the first, facing -z, is in the toy box, and putting it down turns it to
// face you. `color` is its main colour, for the map. It is solid unless it
// says not, but never opaque: light and the view pass round it.
export const FURNITURE = [];
function furniture(id, key, props) {
  const turns = props.turns !== false;
  const ids = [];
  for (let k = 0; k < (turns ? 4 : 1); k++) {
    ids.push(
      def(id + k, k === 0 ? key : `${key}-${k}`, {
        kind: 'furniture',
        tiles: 'plain',
        model: key,
        turns,
        front: turns ? (3 + k) % 4 : 3,
        base: id,
        ...props,
        category: k === 0 ? (props.category ?? 'home') : null,
      }),
    );
  }
  FURNITURE.push(...ids);
  return id;
}
export const CHAIR = furniture(101, 'chair', { name: 'Chair', color: '#c98a52', sound: 'wood' });
export const SOFA = furniture(105, 'sofa', { name: 'Sofa', color: '#5b8fd9', sound: 'cloth' });
export const BED = furniture(109, 'bed', { name: 'Bed', color: '#f29bc4', sound: 'cloth' });
export const BOOKSHELF = furniture(113, 'bookshelf', { name: 'Bookshelf', color: '#a8703f', sound: 'wood' });
export const COUNTER = furniture(117, 'counter', { name: 'Kitchen Counter', color: '#f3efe6', sound: 'wood' });
export const STOVE = furniture(121, 'stove', { name: 'Stove', color: '#e7e9ec', sound: 'stone' });
export const FRIDGE = furniture(125, 'fridge', { name: 'Fridge', color: '#cfe7f5', sound: 'stone' });
// TVs (shared/tv.js): walk up, press Q and watch. Their screens glow.
export const TV = furniture(129, 'tv', { name: 'TV', color: '#3a3f4a', light: 5, sound: 'glass' });
export const RETRO_TV = furniture(216, 'retro-tv', { name: 'Retro TV', color: '#a8703f', after: 129, light: 5, sound: 'wood' });
// Hangs on a wall, like a picture.
export const WALL_TV = furniture(220, 'wall-tv', { name: 'Wall TV', color: '#2c2f36', after: 216, solid: false, wall: true, light: 5, sound: 'glass' });
// A broadcast station (shared/station.js): a TV camera on a tripod. Walk
// up, press Q and go live: your camera and microphone on every TV on the island.
export const BROADCAST_STATION = furniture(224, 'broadcast-station', { name: 'Broadcast Station', color: '#4a4f5a', after: 220, sound: 'stone' });
// School things (shared/school.js): a school desk with its chair, to sit
// at, and a chalkboard that hangs on the wall (side by side, one long one):
// walk up to it and press Q for a class. After the broadcast station.
export const SCHOOL_DESK = furniture(228, 'school-desk', { name: 'School Desk', color: '#d9a066', after: 224, sound: 'wood' });
export const CHALKBOARD = furniture(232, 'chalkboard', { name: 'Chalkboard', color: '#2f5d46', after: 228, solid: false, wall: true, sound: 'wood' });
export const FIREPLACE = furniture(133, 'fireplace', { name: 'Fireplace', color: '#b55d45', light: 12, sound: 'stone' });
// Hangs on a wall: put it against one and it faces out from it.
export const PICTURE = furniture(137, 'picture', { name: 'Picture', color: '#f5c542', solid: false, wall: true, sound: 'wood' });
export const TABLE = furniture(141, 'table', { name: 'Table', color: '#c98a52', turns: false, sound: 'wood' });
export const FLOOR_LAMP = furniture(142, 'floor-lamp', { name: 'Floor Lamp', color: '#fbe7a1', turns: false, light: 14, sound: 'glass' });
export const POTTED_PLANT = furniture(143, 'potted-plant', { name: 'Potted Plant', color: '#4caf50', turns: false, sound: 'plant' });
// A little table set for tea: a cloth, a teapot, cups and a plate of cookies
// (shared/furniture.js). Pull chairs up to it and sit down to tea together.
export const TEA_TABLE = furniture(154, 'tea-table', { name: 'Tea Table', color: '#f29bc4', sound: 'wood' });
// Arcade machines, each running a mini-game everyone at it plays together
// (shared/arcade.js): walk up and press Q to play. Their screens glow and
// light the room a little.
export const ARCADE_BLOB = furniture(158, 'arcade-blob', { name: 'Bop-a-Blob Machine', color: '#8c5bd6', light: 7, sound: 'stone' });
export const ARCADE_PAIRS = furniture(162, 'arcade-pairs', { name: 'Picture Pairs Machine', color: '#2fc1b3', light: 7, sound: 'stone' });
// A gashapon, a capsule toy machine (shared/gashapon.js): walk up, press Q
// and turn its handle for a capsule toy. Beside the arcade machines.
export const GASHAPON = furniture(204, 'gashapon', { name: 'Gashapon Machine', color: '#e8453c', after: 162, sound: 'stone' });
// Pianos (shared/piano.js): walk up, press Q and play. After the gashapon.
export const PIANO = furniture(208, 'piano', { name: 'Piano', color: '#3b2a24', after: 204, sound: 'wood' });
export const GRAND_PIANO = furniture(212, 'grand-piano', { name: 'Grand Piano', color: '#23252b', after: 208, sound: 'wood' });

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
export const KATSURA_SPROUT = def(47, 'katsura-sprout', { name: 'Katsura Sprout', kind: 'plant', category: 'plants', after: 58, tiles: 'katsura-sprout', grows: 'katsura', sound: 'plant' });
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

// ---------------------------------------------------------------- jewels
// Jewels sit in gem rocks, deep in the stone of the island and in the walls
// of the mines. Tapping a gem rock digs its jewel out into your basket; a
// jewel from the basket can be put down as a little sparkling jewel, and
// picked up again. A gem rock is natural ground, not something to build with.
export const GEMS = [
  ['ruby', 'Ruby', 'Rubies', '#e8344e'],
  ['sapphire', 'Sapphire', 'Sapphires', '#2f6fe4'],
  ['emerald', 'Emerald', 'Emeralds', '#22b45a'],
  ['amethyst', 'Amethyst', 'Amethysts', '#9b4fe0'],
  ['diamond', 'Diamond', 'Diamonds', '#bff3ff'],
];
export const GEM_ROCKS = GEMS.map(([key, name], i) => def(80 + i, `${key}-rock`, { name: `${name} Rock`, tiles: `${key}-rock`, sound: 'stone', collect: key }));
export const GEM_ITEMS = GEMS.map(([key, name], i) => def(85 + i, key, { name, kind: 'item', tiles: key, collect: key, light: 6, sound: 'glass' }));
export const DIAMOND_ROCK = GEM_ROCKS[4];

// ---------------------------------------------------------------- farm
// Farmland: soil turned over in furrows, for crops to grow in. Watered — by
// the watering can, the rain, or water close by — it turns dark, and what
// grows in it grows twice as fast; it dries out again after a while
// (shared/room.js). Planting a vegetable on grass, dirt, snow, frosting or
// basalt turns the ground over into farmland first (tools.js).
export const FARMLAND = def(166, 'farmland', { name: 'Farmland', category: 'farm', tiles: { top: 'farmland', side: 'dirt', bottom: 'dirt' }, sound: 'dirt', under: 3 });
export const WET_FARMLAND = def(167, 'wet-farmland', { name: 'Watered Farmland', color: '#b49c8c', tiles: { top: 'farmland-wet', side: 'dirt', bottom: 'dirt' }, sound: 'dirt', under: 3 });

// Crops: vegetables to grow on farmland, each in four stages — just
// planted, a sprout, growing and ripe — one block each (plants drawn
// crossed in a #, render/mesher.js). The host moves each on a stage at a
// time (room.js): `stage` is the seconds a stage takes on watered farmland,
// twice that on dry. A ripe one, tapped with any tool, is picked into the
// basket (tools.js harvestEdit), `gives` of it: some grow back (`regrows`,
// back to a sprout), the rest leave the farmland bare to plant again.
// Planting one from the basket starts a new one, as a fruit grows a tree,
// and the shop sells a few of each to start with (shop.js).
export const CROPS = [
  { key: 'carrot', name: 'Carrot', plural: 'Carrots', icon: '🥕', color: '#ff8a1f', stage: 20, gives: 2, regrows: false },
  { key: 'strawberry', name: 'Strawberry', plural: 'Strawberries', icon: '🍓', color: '#ef3b4a', stage: 25, gives: 2, regrows: true },
  { key: 'tomato', name: 'Tomato', plural: 'Tomatoes', icon: '🍅', color: '#e8382c', stage: 30, gives: 2, regrows: true },
  { key: 'corn', name: 'Corn Cob', plural: 'Corn Cobs', icon: '🌽', color: '#ffd23a', stage: 35, gives: 2, regrows: true },
  { key: 'pumpkin', name: 'Pumpkin', plural: 'Pumpkins', icon: '🎃', color: '#ff9420', stage: 45, gives: 2, regrows: false },
  { key: 'watermelon', name: 'Watermelon', plural: 'Watermelons', icon: '🍉', color: '#3fae4a', stage: 50, gives: 2, regrows: false },
];
export const RIPE = 3;
const STAGE_NAMES = ['Planted', 'Sprouting', 'Growing', 'Ripe'];
// [crop][stage]: the block of each stage of each crop.
export const CROP_STAGES = CROPS.map((c, i) =>
  STAGE_NAMES.map((word, s) =>
    def(168 + i * 4 + s, `${c.key}-${word.toLowerCase()}`, {
      name: `${word} ${c.name}`,
      kind: 'plant',
      // Just planted, every crop looks alike: a little mound with shoots.
      tiles: s === 0 ? 'crop-planted' : `crop-${c.key}-${s}`,
      crop: c.key,
      stage: s,
      collect: s === RIPE ? c.key : null,
      sound: 'plant',
    }),
  ),
);
// Vegetables as they go in the basket, and as the basket shows them.
export const CROP_ITEMS = CROPS.map((c, i) => def(192 + i, c.key, { name: c.name, kind: 'item', tiles: c.key, collect: c.key, sound: 'plant' }));
// The watering can: pick it in the toy box and tap farmland (or what grows
// in it) to water it, a patch at a time with a big brush. Never put down
// itself (tools.js waterEdit; the host turns one away).
export const WATERING_CAN = def(198, 'watering-can', { name: 'Watering Can', kind: 'plant', category: 'farm', tiles: 'watering-can', sound: 'water' });
// A scarecrow to stand watch over the crops, with a pumpkin for a head and
// a straw hat, turned to face whoever put it down; and a wooden fence that
// joins up with the fence beside it (shared/furniture.js).
export const SCARECROW = furniture(199, 'scarecrow', { name: 'Scarecrow', color: '#e8453c', category: 'farm', sound: 'wood' });
export const FENCE = furniture(203, 'fence', { name: 'Fence', color: '#c98a52', turns: false, category: 'farm', sound: 'wood' });

// Things that go in the basket, in the order the basket shows them.
export const COLLECTABLES = [
  ...FRUITS.map(([key, name, plural]) => ({ key, name, plural, item: byKey[key].id, sprout: byKey[`${key}-sprout`].id })),
  ...CROPS.map((c, i) => ({ key: c.key, name: c.name, plural: c.plural, item: CROP_ITEMS[i], sprout: CROP_STAGES[i][0], crop: true })),
  { key: 'shell', name: 'Seashell', plural: 'Seashells', item: SHELL, sprout: 0 },
  { key: 'star', name: 'Star Piece', plural: 'Star Pieces', item: STAR_PIECE, sprout: 0 },
  ...GEMS.map(([key, name, plural], i) => ({ key, name, plural, item: GEM_ITEMS[i], sprout: 0 })),
];

export const BLOCKS = defs;
export const blockByKey = (key) => byKey[key] ?? null;
export const block = (id) => defs[id] ?? defs[0];
export const isKnown = (id) => Number.isInteger(id) && id >= 0 && id < 256 && defs[id] !== undefined;

// Lookup tables, so hot loops (meshing, physics, light) avoid property access.
export const SOLID = new Uint8Array(256);
export const OPAQUE = new Uint8Array(256);
export const EMIT = new Uint8Array(256);
export const KIND = new Uint8Array(256); // 0 air, 1 solid, 2 glass, 3 water, 4 plant, 5 item, 6 furniture, 7 lava, 8 tree
const KIND_CODE = { air: 0, solid: 1, glass: 2, water: 3, plant: 4, item: 5, furniture: 6, lava: 7, tree: 8 };
for (const d of defs) {
  if (!d) continue;
  SOLID[d.id] = d.solid ? 1 : 0;
  OPAQUE[d.id] = d.opaque ? 1 : 0;
  EMIT[d.id] = d.light;
  KIND[d.id] = KIND_CODE[d.kind];
}
// Natural ground, which the hills tool shapes (farmland is ground too).
export const TERRAIN = new Uint8Array(256);
for (const id of [2, 3, 4, 5, 6, 11, 13, 19, 20, 21, 22, 25, 27, 28, FARMLAND, WET_FARMLAND, ...GEM_ROCKS]) TERRAIN[id] = 1;
// Farmland, dry (1) or watered (2): what crops grow in.
export const SOIL = new Uint8Array(256);
SOIL[FARMLAND] = 1;
SOIL[WET_FARMLAND] = 2;
// Ground that planting a vegetable on turns over into farmland.
export const TILLS = new Uint8Array(256);
for (const id of [GRASS, DIRT, SNOW, FROSTING, BASALT]) TILLS[id] = 1;
// Which crop a block is a stage of (its index in CROPS, plus one; 0 for
// anything else), and which stage.
export const CROP_OF = new Uint8Array(256);
export const STAGE_OF = new Uint8Array(256);
CROP_STAGES.forEach((stages, i) => stages.forEach((id, s) => ((CROP_OF[id] = i + 1), (STAGE_OF[id] = s))));
export const isCrop = (id) => CROP_OF[id] > 0;
export const isRipe = (id) => CROP_OF[id] > 0 && STAGE_OF[id] === RIPE;
export const cropOf = (id) => CROPS[CROP_OF[id] - 1] ?? null;
export const cropByKey = (key) => CROPS.find((c) => c.key === key) ?? null;
// What animals and pets will eat from your basket: fruit and vegetables.
export const FOODS = [...FRUITS.map(([key]) => key), ...CROPS.map((c) => c.key)];
export const isFood = (key) => FOODS.includes(key);
// Gem rocks, which a tap digs a jewel out of.
export const GEM_ROCK = new Uint8Array(256);
for (const id of GEM_ROCKS) GEM_ROCK[id] = 1;
// Jewels, dug or put down, and gem rocks: what counts as finding a jewel.
export const isJewel = (id) => GEM_ROCK[id] === 1 || GEM_ITEMS.includes(id);
// What fruit can hang from.
export const TREE_PART = new Uint8Array(256);
for (const id of [7, 8, 9, 24, 25, 46, 48, 49, 67, 68]) TREE_PART[id] = 1;
// Tent cloth, what makes a tent.
export const CLOTH = new Uint8Array(256);
for (const id of CLOTHS) CLOTH[id] = 1;

export const K_AIR = 0;
export const K_SOLID = 1;
export const K_GLASS = 2;
export const K_WATER = 3;
export const K_PLANT = 4;
export const K_ITEM = 5;
export const K_FURNITURE = 6;
export const K_LAVA = 7;
export const K_TREE = 8;
// The foot of a real tree, which its model grows from.
export const isTreeFoot = (id) => KIND[id] === K_TREE && id !== TREE_CORE;

// The block in the toy box a turned piece of furniture is one of.
export const baseOf = (id) => defs[id]?.base ?? id;
// A piece of furniture turned so its front faces way `front` (0-3, as
// RAIL_DIRS); anything else stays as it is.
export const turnedTo = (id, front) => {
  const d = defs[id];
  if (!d?.turns) return id;
  return d.base + ((((front - 3) % 4) + 4) % 4);
};

export const isSolid = (id) => SOLID[id] === 1;
export const isWater = (id) => id === WATER;
export const isLava = (id) => id === LAVA;
// Cells a build can go into: empty space, water or lava, and the little
// things that get pushed aside (flowers, grass).
export const isReplaceable = (id) => id === AIR || id === WATER || id === LAVA || KIND[id] === K_PLANT;

// What lies under the top block of a column, for the hills tool.
export const underOf = (id) => defs[id]?.under || id;

// The toy box: what can be picked and placed freely, by tab.
export const CATEGORIES = [
  { key: 'bricks', name: 'Toy Bricks', icon: '🧱' },
  { key: 'nature', name: 'Nature', icon: '🌳' },
  { key: 'building', name: 'Building', icon: '🏠' },
  { key: 'candy', name: 'Candy', icon: '🍭' },
  { key: 'plants', name: 'Plants', icon: '🌷' },
  { key: 'farm', name: 'Farm', icon: '🌾' },
  { key: 'home', name: 'Home', icon: '🛋️' },
];
// A tab's blocks in order of id, except that one with `after` comes right
// after the block it names, to sit with its own kind (a katsura's).
export const blocksIn = (category) => {
  const all = defs.filter((d) => d && d.category === category);
  const ids = all.filter((d) => d.after == null).map((d) => d.id);
  const rest = all.filter((d) => d.after != null);
  // One pass for every one waiting, at most: a long chain of them, each after
  // the one before, takes a pass each.
  for (let pass = 0, passes = rest.length; rest.length && pass <= passes; pass++) {
    for (let i = rest.length - 1; i >= 0; i--) {
      const at = ids.indexOf(rest[i].after);
      if (at < 0) continue;
      ids.splice(at + 1, 0, rest[i].id);
      rest.splice(i, 1);
    }
  }
  return [...ids, ...rest.map((d) => d.id)];
};

export const SAPLING_FOR = Object.fromEntries(COLLECTABLES.filter((c) => c.sprout).map((c) => [c.key, c.sprout]));
