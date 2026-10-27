// What's new in the game, newest first, for the 📰 What's new window on the
// title screen. Each update has an id of its own that never changes: this
// device remembers the newest one each player has seen (storage key
// 'seenNews'), and the window opens by itself with the ones that came after
// it. Add a new update at the top; never reuse or reorder an id.

export const NEWS = [
  { id: 'lightning', date: '2026-10-31', icon: '⛈️', title: 'Thunderstorms', text: 'Now and then the rain comes as a ⛈️ thunderstorm: lightning flashes across the sky and the thunder rumbles. It waters your farm too!' },
  { id: 'real-kitchen', date: '2026-10-31', icon: '🍳', title: 'A real kitchen', text: 'Cooking classes happen in a real-looking 3D kitchen now: crack eggs into a glazed bowl, fry pancakes on a gas hob, bake pizza in a glowing oven — and see a picture of your dish at the end!' },
  { id: 'cook-by-hand', date: '2026-10-31', icon: '🥞', title: 'Cook with your own hands', text: 'Cooking classes are hands-on now: take what comes next off the shelf, then crack eggs into the bowl, pour, stir, chop, spread the sauce and take it off the heat when it is golden!' },
  { id: 'real-coaster', date: '2026-10-31', icon: '🎢', title: 'A real roller coaster', text: 'Fun parks have a real roller coaster now: up the lift hill, down the drop and round the loop!' },
  { id: 'typing', date: '2026-10-28', icon: '⌨️', title: 'Typing at computers', text: 'Walk up to a 💻 Computer and tap ⌨️ Type: learn to type row by row with the next key lit up, then play 🌧️ Word Rain — type the falling words to pop them before they land!' },
  { id: 'snow', date: '2026-10-28', icon: '❄️', title: 'Snow piles up', text: 'Snow can fall on any island now, not only snowy ones, and it piles up little by little: white patches first, then a thick blanket over everything. When it stops, it slowly melts away.' },
  { id: 'tornado', date: '2026-10-28', icon: '🌪️', title: 'Tornadoes', text: 'Now and then a cloudy sky spins up a 🌪️ tornado that wanders over the island. Hide indoors — or run into it for a wild spin up the funnel, and the new 🌪️ Storm Chaser sticker!' },
  { id: 'monster-book', date: '2026-10-28', icon: '👾', title: 'Monster collection', text: 'Every monster you meet on an adventure island goes in your 👾 Monster collection (in ⭐ Stickers, or the island window): 👀 Seen, and 🏆 Defeated with each one\'s name and stats.' },
  { id: 'stats', date: '2026-10-28', icon: '⚔️', title: 'Your stats', text: 'Open your 🎒 backpack to see your stats: ❤️ HP, ⚔️ AP, 🛡️ DEF, 👟 SPD and 🦘 JMP. Put something on and watch them go up!' },
  { id: 'races', date: '2026-10-28', icon: '🏆', title: 'Go-kart races', text: 'On a 🏁 Racing Island, tap 🏁 Race! in a go-kart: line up with your friends and the computer\'s robot drivers, and three laps after GO, the first over the line wins!' },
  { id: 'racing', date: '2026-10-28', icon: '🏁', title: 'Racing islands', text: 'Make a 🏁 Racing Island: jump in a 🏎️ go-kart, race round the track and beat your best lap time!' },
  { id: 'pompeii', date: '2026-10-28', icon: '🌋', title: 'The Pompeii sticker', text: 'Stamp 10 cozy houses on a 🌋 volcano island for the new 🌋 Pompeii sticker!' },
  { id: 'hot-tub', date: '2026-10-27', icon: '♨️', title: 'Hot tubs', text: 'A Hot Tub in the toy box\'s 🛋️ Home tab: slip in up to your shoulders and soak with your friends — the steam rises, and hearts show when you share it!' },
  { id: 'pet-bed', date: '2026-10-26', icon: '🛏️', title: 'Pet beds', text: 'Put a Pet Bed down from the toy box\'s 🛋️ Home tab, and at night your pet walks over, curls up in it and sleeps!' },
  { id: 'ctb-tab', date: '2026-10-25', icon: '🏢', title: 'Visit CTB', text: 'Tap 🏢 CTB on the title screen to visit CTB\'s helpers at their desks.' },
  { id: 'computer', date: '2026-10-25', icon: '💻', title: 'Computers', text: 'A Computer in the toy box\'s 🛋️ Home tab, glowing with code like the ones at CTB.' },
  { id: 'gomoku', date: '2026-10-24', icon: '⭕', title: 'Gomoku', text: 'Five in a row at any Go board: tap ⭕ Gomoku, and play a friend or Pip!' },
  { id: 'go-board', date: '2026-10-24', icon: '⚫', title: 'Go boards', text: 'Play Go on a small board with a friend, or with Pip, who teaches you the rules as you play!' },
  { id: 'fun-park', date: '2026-10-24', icon: '🎡', title: 'Fun park islands', text: 'Make a Fun Park Island: a roller coaster, a Ferris wheel and a merry-go-round to ride!' },
  { id: 'skates', date: '2026-10-24', icon: '🛼', title: 'Roller skates', text: 'Buy Roller Skates in the 🛒 shop: push off, let go and glide!' },
  { id: 'study-desk', date: '2026-10-24', icon: '📚', title: 'Study desks', text: 'Sit at a Study Desk for adding, times tables, spelling and more, and learn them by heart!' },
  { id: 'hide-and-seek', date: '2026-10-24', icon: '🙈', title: 'Hide and seek', text: 'Play hide and seek with your friends: tap 😊 or the island\'s name, then 🙈 I\'ll be it!' },
  { id: 'cooking', date: '2026-10-24', icon: '🍳', title: 'Cooking classes', text: 'Walk up to any stove for a cooking class, and stamp a whole Cooking School!' },
  { id: 'fans', date: '2026-10-24', icon: '🌀', title: 'Fans', text: 'An Electric Fan and a Ceiling Fan in the toy box\'s 🛋️ Home tab, with spinning blades.' },
  { id: 'weapon-wear', date: '2026-10-24', icon: '🔧', title: 'Weapons wear out', text: 'Toy weapons wear out as they bop. Fix them in the 🛒 shop before they break!' },
  { id: 'monster-gasha', date: '2026-10-24', icon: '👾', title: 'Monster Gashapon', text: 'Follow the beam of light on adventure islands and turn it for a figure of a real monster.' },
  { id: 'gasha-3d', date: '2026-10-24', icon: '🎁', title: 'Capsule toys in 3D', text: 'Capsules drop, wobble and pop open, and your toys show how rare they are. Six more to find!' },
  { id: 'hard-stickers', date: '2026-10-23', icon: '⭐', title: '16 harder stickers', text: 'Sixteen new stickers for the biggest builders and explorers.' },
  { id: 'gear-shows', date: '2026-10-22', icon: '👟', title: 'Shoes and wings show', text: 'Running shoes, wings and jet packs show on you, so your friends see them too.' },
  { id: 'backpack', date: '2026-10-21', icon: '🎒', title: 'A backpack', text: 'Everything you buy in the 🛒 shop goes in your backpack, and on you straight away.' },
  { id: 'piano-bench', date: '2026-10-20', icon: '🎹', title: 'Piano benches', text: 'Sit down on a bench to play the piano, just like a real pianist.' },
  { id: 'toy-look', date: '2026-10-19', icon: '🧸', title: 'Glossy toys', text: 'Everything that moves is a shiny toy now. Try 🖼️ Picture in Settings!' },
  { id: 'gallery', date: '2026-10-19', icon: '🖼️', title: 'My gallery', text: 'Save your drawings to a gallery of your own, and put them up on a board again.' },
  { id: 'drawing', date: '2026-10-18', icon: '🎨', title: 'Drawing boards', text: 'Draw pictures together with your friends on a Drawing Board.' },
  { id: 'ideas', date: '2026-10-18', icon: '💌', title: 'Ideas & problems', text: 'Have an idea for the game, or found a problem? Tell us with 💌 on the title screen.' },
  { id: 'school', date: '2026-10-17', icon: '🏫', title: 'School', text: 'Stamp a School and take a class at the chalkboard: right answers earn coins!' },
  { id: 'dragon', date: '2026-10-17', icon: '🐲', title: 'The volcano dragon', text: 'A great green dragon sleeps on volcano islands. Tame it and fly!' },
  { id: 'broadcast', date: '2026-10-17', icon: '📹', title: 'Broadcast Station', text: 'Go live with a TV camera and be on every TV on every island.' },
  { id: 'tvs', date: '2026-10-17', icon: '📺', title: 'TVs', text: 'Watch TV: flip through the channels for fish, a bunny, a rocket and a dance party.' },
  { id: 'pianos', date: '2026-10-17', icon: '🎵', title: 'Pianos', text: 'Play a piano or a grand piano, and friends nearby hear you.' },
  { id: 'gashapon', date: '2026-10-17', icon: '🪀', title: 'Gashapon machines', text: 'Put in coins and turn the handle for a surprise toy.' },
  { id: 'alien', date: '2026-10-17', icon: '👽', title: 'Be an alien', text: 'A round green head and big shiny eyes: pick it in 🎨 Change me.' },
];

// The updates after the newest one seen, newest first: all of them for an id
// this list does not have.
export function newsSince(seen) {
  const i = NEWS.findIndex((n) => n.id === seen);
  return i < 0 ? [...NEWS] : NEWS.slice(0, i);
}

export const latestNews = () => NEWS[0]?.id ?? '';
