// The stickers you earn for what you do, and the things the game counts
// that earn them. Shared, so the keeper can tell real stickers from made-up
// ones when it ranks players (see ranking.js).
export const STICKERS = [
  { key: 'first-block', icon: '🧱', name: 'First Brick', text: 'Put your first block down', test: (s) => s.placed >= 1 },
  { key: 'builder', icon: '🏗️', name: 'Builder', text: 'Put down 100 blocks', test: (s) => s.placed >= 100 },
  { key: 'master-builder', icon: '🏰', name: 'Master Builder', text: 'Put down 1,000 blocks', test: (s) => s.placed >= 1000 },
  { key: 'tidy', icon: '✋', name: 'Tidy Up', text: 'Pick up 50 blocks', test: (s) => s.picked >= 50 },
  { key: 'painter', icon: '🎨', name: 'Painter', text: 'Paint 30 blocks', test: (s) => s.painted >= 30 },
  { key: 'hill-maker', icon: '⛰️', name: 'Hill Maker', text: 'Shape the land 10 times', test: (s) => s.hills >= 10 },
  { key: 'stamp', icon: '🏠', name: 'Quick Builder', text: 'Use a stamp', test: (s) => s.stamps >= 1 },
  { key: 'green-thumb', icon: '🌷', name: 'Green Thumb', text: 'Plant 10 flowers', test: (s) => s.planted >= 10 },
  { key: 'gardener', icon: '🌳', name: 'Gardener', text: 'Plant a tree sprout', test: (s) => s.sprouts >= 1 },
  { key: 'fruit-picker', icon: '🍎', name: 'Fruit Picker', text: 'Collect 10 fruit', test: (s) => s.fruit >= 10 },
  { key: 'beachcomber', icon: '🐚', name: 'Beachcomber', text: 'Find 5 seashells', test: (s) => s.shells >= 5 },
  { key: 'star-catcher', icon: '⭐', name: 'Star Catcher', text: 'Catch a star piece', test: (s) => s.stars >= 1 },
  { key: 'animal-friend', icon: '🐰', name: 'Animal Friend', text: 'Pet 10 animals', test: (s) => s.petted >= 10 },
  { key: 'snack-time', icon: '🍑', name: 'Snack Time', text: 'Feed an animal some fruit', test: (s) => s.fed >= 1 },
  { key: 'welcome', icon: '🐣', name: 'Welcome Party', text: 'Invite an animal friend', test: (s) => s.invited >= 1 },
  { key: 'bird-buddy', icon: '🐦', name: 'Bird Buddy', text: 'Have a flying friend sit on your head', test: (s) => s.perched >= 1 },
  { key: 'whale-watcher', icon: '🐳', name: 'Whale Watcher', text: 'See a whale blow water', test: (s) => s.spouts >= 1 },
  { key: 'belly-slide', icon: '🐧', name: 'Belly Slide', text: 'See a penguin slide on its tummy', test: (s) => s.slides >= 1 },
  { key: 'giddy-up', icon: '🏇', name: 'Giddy-Up!', text: 'Ride a big animal', test: (s) => s.rides >= 1 },
  { key: 'sea-rider', icon: '🌊', name: 'Sea Rider', text: 'Ride a dolphin or the whale', test: (s) => s.searides >= 1 },
  { key: 'chatty', icon: '💬', name: 'Chatty', text: 'Say 10 things to friends', test: (s) => s.said >= 10 },
  { key: 'dancer', icon: '💃', name: 'Dancer', text: 'Dance 5 times', test: (s) => s.danced >= 5 },
  { key: 'visitor', icon: '✈️', name: 'Visitor', text: "Visit a friend's island", test: (s) => s.visits >= 1 },
  { key: 'party-host', icon: '🏝️', name: 'Party Host', text: 'Have a friend visit your island', test: (s) => s.guests >= 1 },
  { key: 'swimmer', icon: '🏊', name: 'Swimmer', text: 'Go for a swim', test: (s) => s.swims >= 1 },
  { key: 'high-flyer', icon: '🎈', name: 'High Flyer', text: 'Fly way up high', test: (s) => s.highest >= 60 },
  { key: 'night-owl', icon: '🦉', name: 'Night Owl', text: 'Stay up to see the stars', test: (s) => s.nights >= 1 },
  { key: 'rainbow', icon: '🌈', name: 'Rainbow Watcher', text: 'See a rainbow', test: (s) => s.rainbows >= 1 },
  { key: 'explorer', icon: '🧭', name: 'Explorer', text: 'Walk 1,000 steps', test: (s) => s.steps >= 1000 },
];

export const STAT_KEYS = ['placed', 'picked', 'painted', 'hills', 'stamps', 'planted', 'sprouts', 'fruit', 'shells', 'stars', 'petted', 'fed', 'invited', 'perched', 'spouts', 'slides', 'rides', 'searides', 'said', 'danced', 'visits', 'guests', 'swims', 'highest', 'nights', 'rainbows', 'steps'];
